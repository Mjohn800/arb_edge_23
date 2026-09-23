// lib/oddspapi.js
const BASE = 'https://api.oddspapi.io/v4';
const ODDS_CACHE_TTL_MS = 4 * 60 * 1000;       // 4 min — matches your other WA caches
const REFERENCE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — markets/participants are near-static

const KEY_ENV_NAMES = [
  'ODDSPAPI_KEY', 'ODDSPAPI_KEY_2', 'ODDSPAPI_KEY_3',
  'ODDSPAPI_KEY_4', 'ODDSPAPI_KEY_5', 'ODDSPAPI_KEY_6',
];

let currentKeyIndex = 0;
const MIN_GAP_MS = 1200; // stays above OddsPapi's documented 1000ms endpoint cooldown

// ─── SHARED KEY POINTER (Supabase) ──────────────────────────────────────────
// currentKeyIndex above is just a local cache — the real source of truth is
// this row in Supabase, since separate concurrent Vercel invocations do NOT
// share memory with each other (confirmed from real logs: keys 0, 2, 3, 5
// all getting hit within milliseconds, across different sports at once —
// each instance was starting fresh at index 0 with no idea another instance
// had already advanced past a dead key). Every instance reads this row
// (cached locally for SHARED_INDEX_CACHE_MS to avoid hammering Supabase on
// every call) and only WRITES to it when a key actually gets marked
// exhausted — so in the common case (current key still works) there's no
// extra Supabase round-trip at all.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHARED_INDEX_CACHE_MS = 30 * 1000;
let sharedIndexCachedAt = 0;

async function getSharedKeyIndex() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return currentKeyIndex; // not configured — fall back to local-only
  if (Date.now() - sharedIndexCachedAt < SHARED_INDEX_CACHE_MS) return currentKeyIndex;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/oddspapi_key_state?id=eq.1&select=current_index`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const rows = await res.json();
    if (Array.isArray(rows) && rows[0]) currentKeyIndex = rows[0].current_index;
    sharedIndexCachedAt = Date.now();
  } catch (err) {
    console.warn('[OddsPapi] failed to read shared key index, using local cache:', err.message);
  }
  return currentKeyIndex;
}

async function advanceSharedKeyIndex(newIdx) {
  currentKeyIndex = newIdx; // update local immediately so THIS call's retry loop sees it
  sharedIndexCachedAt = Date.now();
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/oddspapi_key_state?id=eq.1`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ current_index: newIdx, updated_at: new Date().toISOString() }),
    });
  } catch (err) {
    console.warn('[OddsPapi] failed to persist shared key index (other instances may lag):', err.message);
  }
}


// Global serialization: every OddsPapi call, from every bookmaker and every
// sport, gets funneled through this one chain — so concurrent scans (betano,
// 22bet, melbet all racing via Promise.allSettled, across multiple sports at
// once) never fire simultaneous requests or race on currentKeyIndex.
// (msport, mozzartbet dropped 23 Sep 2026; betway reverted to the-odds-api
// same date — none of these three route through this file anymore.)
// Previously nothing enforced spacing between calls at all — CALL_DELAY_MS
// existed but was never actually used anywhere in this file.
let requestQueue = Promise.resolve();

function enqueue(fn) {
  const result = requestQueue.then(async () => {
    const value = await fn();
    await sleep(MIN_GAP_MS); // enforced gap BEFORE the next queued call runs
    return value;
  });
  // Swallow errors here so one failed call doesn't break the chain for
  // everyone queued behind it — each caller still gets their own rejection
  // via `result`, which is untouched by this catch.
  requestQueue = result.catch(() => {});
  return result;
}

const oddsCache = new Map();        // "bookmaker:tournamentId" -> { data, expiresAt }
const marketsCache = new Map();     // sportId -> { data: Map(marketId -> marketDef), expiresAt }
const participantsCache = new Map(); // sportId -> { data: Map(id -> name), expiresAt }
let _loggedSpreadsShape = false; // one-shot debug log, see normaliseFixture

function getKeys() {
  return KEY_ENV_NAMES.map(n => process.env[n]).filter(Boolean);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const KEY_EXHAUSTED_STATUSES = [401, 403, 429];

async function fetchWithKeyRotation(path) {
  return enqueue(() => fetchWithKeyRotationInner(path));
}

async function fetchWithKeyRotationInner(path) {
  const keys = getKeys();
  if (keys.length === 0) throw new Error('No OddsPapi keys configured');

  const startIdx = await getSharedKeyIndex(); // consult the shared pointer, not just local memory

  let lastError = null;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (startIdx + attempt) % keys.length;
    const key = keys[idx];
    const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}apiKey=${key}`;
    try {
      const res = await fetch(url);
      console.log(`[OddsPapi] key ${idx} -> status ${res.status} for ${path}`);

      if (KEY_EXHAUSTED_STATUSES.includes(res.status)) {
        await advanceSharedKeyIndex((idx + 1) % keys.length);
        lastError = `key ${idx} status ${res.status}`;
        continue;
      }
      if (!res.ok) {
        throw new Error(`OddsPapi ${res.status}: ${await res.text()}`);
      }
      // Success — no Supabase write needed. The pointer only needs to
      // advance when a key dies; every instance reading the same
      // still-valid pointer will naturally try this same key first anyway.
      currentKeyIndex = idx;
      return await res.json();
    } catch (err) {
      lastError = err.message;
      await advanceSharedKeyIndex((idx + 1) % keys.length);
    }
  }
  console.warn(`[OddsPapi] ALL KEYS FAILED for ${path}. Last: ${lastError}`);
  throw new Error(`All ${keys.length} OddsPapi keys failed. Last: ${lastError}`);
}


// ─── Reference data (markets + participants), cached long-term ─────────────
async function getMarketsMap(sportId) {
  const cached = marketsCache.get(sportId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const raw = await fetchWithKeyRotation(`/markets?sportId=${sportId}`);
  const map = new Map();
  for (const m of raw) {
    map.set(m.marketId, m); // marketId -> { marketType, marketName, handicap, outcomes: [{outcomeId, outcomeName}] }
  }
  marketsCache.set(sportId, { data: map, expiresAt: Date.now() + REFERENCE_CACHE_TTL_MS });
  return map;
}

async function getParticipantsMap(sportId) {
  const cached = participantsCache.get(sportId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const raw = await fetchWithKeyRotation(`/participants?sportId=${sportId}`);
  const map = new Map(Object.entries(raw)); // "42" -> "Arsenal FC"
  participantsCache.set(sportId, { data: map, expiresAt: Date.now() + REFERENCE_CACHE_TTL_MS });
  return map;
}

// ─── Normalizer: OddsPapi fixture -> your app's standard event shape ───────
// Matches the shape produced by your other scrapers (see betfox normalizer):
// { id, sport_key, home_team, away_team, commence_time, bookmakers: [{key, title, markets, _wa:true}] }
function normaliseFixture(fixture, bookmaker, sportKey, marketsMap, participantsMap) {
  try {
    const homeTeam = participantsMap.get(String(fixture.participant1Id));
    const awayTeam = participantsMap.get(String(fixture.participant2Id));
    if (!homeTeam || !awayTeam) return null;

    const bookOdds = fixture.bookmakerOdds?.[bookmaker];
    if (!bookOdds || bookOdds.suspended) return null;

    const markets = [];
    for (const [marketIdStr, marketData] of Object.entries(bookOdds.markets || {})) {
      const marketDef = marketsMap.get(Number(marketIdStr));
      if (!marketDef) continue; // unknown market code — skip rather than guess

      const outcomes = [];
      for (const [outcomeIdStr, outcomeData] of Object.entries(marketData.outcomes || {})) {
        const outcomeDef = marketDef.outcomes.find(o => o.outcomeId === Number(outcomeIdStr));
        if (!outcomeDef) continue;
        const priceEntry = outcomeData.players?.['0'];
        if (!priceEntry || !priceEntry.active || !priceEntry.price) continue;

        // ⚠️ SPREADS/HANDICAP: marketDef.handicap is ONE value on the market
        // definition, shared by every outcome in it. That's fine for totals
        // (Over/Under genuinely share one boundary) but CANNOT be correct for
        // Asian Handicap — a real AH pair is always opposite-signed (home
        // +0.25 pairs with away -0.25, never away +0.25). Applying one shared
        // value to both sides is structurally guaranteed to produce same-sign
        // "pairs" that don't exist on any real book — confirmed 23 Sep 2026
        // from prod screenshots (Aston Villa +0.25 paired with Brentford
        // +0.25). findArbs() (index.js) then treats these as a genuine
        // complementary pair and reports a fake arb.
        //
        // Rather than guess which field carries the real per-side signed line
        // (outcomeDef/outcomeData aren't inspected for one yet), drop spreads
        // outcomes entirely for now and log the raw shape ONCE per cold start
        // so the real field can be identified from prod logs instead of guessed.
        if (marketDef.marketType === 'spreads' || marketDef.marketType === 'handicap') {
          if (!_loggedSpreadsShape) {
            _loggedSpreadsShape = true;
            console.log('[OddsPapi] spreads market shape — marketDef:', JSON.stringify(marketDef).slice(0, 500));
            console.log('[OddsPapi] spreads outcomeDef:', JSON.stringify(outcomeDef).slice(0, 300), '| outcomeData:', JSON.stringify(outcomeData).slice(0, 300));
          }
          continue; // drop rather than emit a fabricated same-sign pair
        }

        // Translate OddsPapi's generic 1/X/2 labels into real team names for h2h
        let name = outcomeDef.outcomeName;
        if (marketDef.marketType === '1x2') {
          name = name === '1' ? homeTeam : name === '2' ? awayTeam : 'Draw';
        }
        outcomes.push({ name, price: priceEntry.price, point: marketDef.handicap ?? undefined });
      }
      if (outcomes.length === 0) continue;

      // Map OddsPapi market types to your app's standard market keys
      const keyMap = { '1x2': 'h2h', 'totals': 'totals', 'bothteamsscore': 'btts' };
      const key = keyMap[marketDef.marketType] || marketDef.marketType;
      markets.push({ key, outcomes });
    }
    if (markets.length === 0) return null;

    return {
      id: `oddspapi_${bookmaker}_${fixture.fixtureId}`,
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: fixture.startTime,
      bookmakers: [{ key: bookmaker, title: bookmaker, markets, url: bookOdds.fixturePath || null, _wa: true }],
    };
  } catch {
    return null;
  }
}

/**
 * Main entry point: fetch + normalize odds for one bookmaker + one sportKey's
 * mapped tournament. Returns { events: [...], status: {ok, reason, fetchedAt} }
 * matching the shape your other scrapers use.
 */
async function fetchOddsPapiOdds(bookmaker, tournamentId, sportId, sportKey) {
  const cacheKey = `${bookmaker}:${tournamentId}`;
  const cached = oddsCache.get(cacheKey);

  try {
    let raw;
    if (cached && cached.expiresAt > Date.now()) {
      raw = cached.data;
    } else {
      raw = await fetchWithKeyRotation(`/odds-by-tournaments?tournamentIds=${tournamentId}&bookmaker=${bookmaker}`);
      oddsCache.set(cacheKey, { data: raw, expiresAt: Date.now() + ODDS_CACHE_TTL_MS });
    }

    console.log(`[OddsPapi][${bookmaker}] ${sportKey} (tournament ${tournamentId}) -> raw fixtures: ${raw.length}, fromCache: ${!!cached}`);

    const [marketsMap, participantsMap] = await Promise.all([
      getMarketsMap(sportId),
      getParticipantsMap(sportId),
    ]);

    const events = raw
      .map(fixture => normaliseFixture(fixture, bookmaker, sportKey, marketsMap, participantsMap))
      .filter(Boolean);

    console.log(`[OddsPapi][${bookmaker}] ${sportKey} -> normalised events: ${events.length}`);

    return { events, status: { ok: true, reason: null, fetchedAt: new Date().toISOString() } };
  } catch (err) {
    console.warn(`[OddsPapi][${bookmaker}] ${sportKey} ERROR: ${err.message}`);
    return { events: [], status: { ok: false, reason: err.message, fetchedAt: new Date().toISOString() } };
  }
}

// Discovery helper — not used in the hot path. Powers
// pages/api/debug-oddspapi-tournaments.js for resolving real tournamentIds.
async function listTournaments(sportId) {
  return fetchWithKeyRotation(`/tournaments?sportId=${sportId}`);
}

module.exports = { fetchOddsPapiOdds, listTournaments };
