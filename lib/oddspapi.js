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

function getKeys() {
  return KEY_ENV_NAMES.map(n => process.env[n]).filter(Boolean);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const KEY_EXHAUSTED_STATUSES = [401, 403, 429];

// ─── KEY COOLDOWN ───────────────────────────────────────────────────────────
// A key that answers 401/403/429 is benched for a while instead of being retried
// by every later call. Without this, a dead-quota scan re-tried all 6 keys for
// every bookmaker x league (dozens of doomed calls, each also holding the queue
// for MIN_GAP_MS). 429 is benched briefly in case it was only a rate limit;
// 401/403 (bad/expired key) longer. When EVERY key is benched, calls fail
// immediately with no network request and no queue delay.
// Memory is per serverless instance: a cold instance starts with nothing benched
// and will spend at most one round of key attempts to rediscover the state.
// Deliberately NOT done: serving expired cached odds while keys are down —
// stale prices are how fake arbs get shown as live.
const KEY_COOLDOWN_MS = { 429: 5 * 60 * 1000, 401: 30 * 60 * 1000, 403: 30 * 60 * 1000 };
const keyCooldownUntil = new Map(); // key index -> timestamp (ms) it may be tried again

function isKeyCooling(idx) { return (keyCooldownUntil.get(idx) || 0) > Date.now(); }

// Returns ms until the first key comes back if ALL keys are benched, else 0.
function msUntilAnyKeyReturns(keyCount) {
  const now = Date.now();
  let soonest = Infinity;
  for (let i = 0; i < keyCount; i++) {
    const until = keyCooldownUntil.get(i) || 0;
    if (until <= now) return 0;
    soonest = Math.min(soonest, until);
  }
  return soonest === Infinity ? 0 : soonest - now;
}

async function fetchWithKeyRotation(path) {
  const keyCount = getKeys().length;
  if (keyCount > 0) {
    const waitMs = msUntilAnyKeyReturns(keyCount);
    if (waitMs > 0) {
      // Fail fast — outside enqueue() so a skipped call doesn't cost a queue slot.
      throw new Error(`All ${keyCount} OddsPapi keys cooling down after quota/rate-limit errors (retry in ~${Math.ceil(waitMs / 1000)}s) - call skipped`);
    }
  }
  return enqueue(() => fetchWithKeyRotationInner(path));
}

async function fetchWithKeyRotationInner(path) {
  const keys = getKeys();
  if (keys.length === 0) throw new Error('No OddsPapi keys configured');

  const startIdx = await getSharedKeyIndex(); // consult the shared pointer, not just local memory

  let lastError = null;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (startIdx + attempt) % keys.length;
    if (isKeyCooling(idx)) continue; // benched — don't spend a call on it
    const key = keys[idx];
    const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}apiKey=${key}`;
    try {
      const res = await fetch(url);
      console.log(`[OddsPapi] key ${idx} -> status ${res.status} for ${path}`);

      if (KEY_EXHAUSTED_STATUSES.includes(res.status)) {
        const cooldownMs = KEY_COOLDOWN_MS[res.status] || KEY_COOLDOWN_MS[429];
        keyCooldownUntil.set(idx, Date.now() + cooldownMs);
        // Log the response body once per benching so quota vs rate-limit is visible.
        let body = '';
        try { body = (await res.text()).slice(0, 160); } catch (_) {}
        console.warn(`[OddsPapi] key ${idx} benched for ${Math.round(cooldownMs / 60000)} min after ${res.status}${body ? ': ' + body : ''}`);
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
  console.warn(`[OddsPapi] ALL KEYS FAILED for ${path}. Last: ${lastError || 'all keys cooling down'}`);
  throw new Error(`All ${keys.length} OddsPapi keys failed. Last: ${lastError || 'all keys cooling down'}`);
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
// ─── CONFIRMED MARKET WHITELIST (fail-closed) ───────────────────────────────
// OddsPapi tags MANY different markets with the same marketType — the full-time
// 1X2, but also "1X2 - 1UP / 2UP" (early payout), half/period results, corner
// and card markets, team totals, etc. Feeding all of them into h2h / totals /
// spreads let a variant's price pose as the full-time price, and because
// findArbs() keeps the highest price per side, those variant prices won.
//
// Guessing which market is "the real one" from its name is how that happened, so
// there is NO guessing here: a 1x2 / totals / spreads market is only used if its
// exact marketName is listed below, and a name only goes in this list after it
// has been compared against the bookmaker's own page for the same match
// (use /api/oddspapi-debug, which prints every candidate market with its
// prices). Anything not listed is skipped and logged, so nothing is ever
// silently trusted.
//
// Empty set = that market type contributes NOTHING from OddsPapi (fewer arbs,
// never fabricated ones).
// Keyed by the catalogue's sportId (each sport has its own market catalogue,
// shared by every bookmaker and league of that sport), then by marketType.
// A market is used only if its exact name is listed AND its catalogue `period`
// tag matches. A sport with no entry contributes nothing from OddsPapi until it
// has been verified — nothing is inherited from soccer by assumption.
// Verification is PER BOOKMAKER: each market type has a `default` rule (applies
// to every bookmaker) and an optional `byBookmaker` map that overrides it for one
// bookmaker. The `default` rules below were verified against BETANO only — a
// bookmaker whose catalogue names differ needs its own byBookmaker entry, and an
// entry with an empty names Set means "contributes nothing until verified".
const CONFIRMED_MARKETS = {
  // 10 = soccer (all 18 soccer leagues). Verified 24 Sep 2026 against betano's own
  // page (Man Utd vs Tottenham, Nottingham Forest vs Arsenal, Lens vs Lyon) via
  // /api/oddspapi-debug.
  10: {
    '1x2': {
      // id 101: 1.70 / 4.15 / 4.55 = betano page. NOT First/Second Half Result
      default: { period: 'fulltime', names: new Set(['full time result']) },
    },
    totals: {
      // O/U 2.5 1.52/2.55, 3.5 2.25/1.65, 4.5 3.75/1.27 = betano page. NOT First/Second Half
      default: { period: 'fulltime', names: new Set(['over under full time']) },
      // 22bet has TWO distinct totals markets on its own site (whole/half-line
      // "Total" vs quarter-line "Asian Total") with different prices. Which
      // OddsPapi catalogue name(s) correspond to which was never confirmed for
      // 22bet — only for betano. Nothing is used for 22bet totals until each
      // name is verified against 22bet's OWN page via /api/oddspapi-debug.
      // Found 24 Sep 2026: app showed 22bet Under 4 = 2.14 / Under 4.25 = 1.92,
      // live site showed 1.571 / 1.46 — neither matched.
      byBookmaker: { '22bet': { period: 'fulltime', names: new Set() } },
    },
    spreads: {
      // -0.5 home 1.70 = 1X2 home, as it must be. NOT "Asian Handicap First Half"
      default: { period: 'fulltime', names: new Set(['asian handicap']) },
    },
  },
  // 11 = basketball (NBA). NOT VERIFIED YET, so nothing from OddsPapi is used.
  // Fill in after checking /api/feed-audit?sport=basketball_nba (catalogue section)
  // and comparing one game's prices with the bookmaker's page. NBA from the
  // Odds API is unaffected by this list.
  11: {},
};
const CORE_TYPES = new Set(['1x2', 'totals', 'spreads', 'moneyline']);
const _unconfirmedSeen = new Set();
const _loggedCore = new Set();
function isWhitelisted(marketDef, bookmaker) {
  if (!CORE_TYPES.has(marketDef.marketType)) return true; // other market types are untouched by this rule
  const rules = (CONFIRMED_MARKETS[marketDef.sportId] || {})[marketDef.marketType];
  if (!rules) return false;
  // A per-bookmaker rule (even one with an empty names Set) wins over the default.
  const rule = (rules.byBookmaker && rules.byBookmaker[bookmaker]) || rules.default;
  if (!rule) return false;
  const name = String(marketDef.marketName || '').trim().toLowerCase();
  // Both must hold: the exact confirmed name AND the catalogue's own period tag.
  return rule.names.has(name) && marketDef.period === rule.period;
}
function isConfirmedMarket(marketDef, bookmaker) {
  if (isWhitelisted(marketDef, bookmaker)) return true;
  const tag = bookmaker + ' | ' + marketDef.marketType + ' | ' + marketDef.marketId + ' | ' + marketDef.marketName + ' | period=' + marketDef.period;
  if (!_unconfirmedSeen.has(tag) && _unconfirmedSeen.size < 80) {
    _unconfirmedSeen.add(tag);
    console.log('[OddsPapi] UNCONFIRMED market skipped (' + tag + ')');
  }
  return false;
}

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
      if (!isConfirmedMarket(marketDef, bookmaker)) continue; // fail-closed: only whitelisted full-time markets feed h2h/totals/spreads

      const outcomes = [];
      for (const [outcomeIdStr, outcomeData] of Object.entries(marketData.outcomes || {})) {
        const outcomeDef = marketDef.outcomes.find(o => o.outcomeId === Number(outcomeIdStr));
        if (!outcomeDef) continue;
        const priceEntry = outcomeData.players?.['0'];
        if (!priceEntry || !priceEntry.active || !priceEntry.price) continue;

        // Asian Handicap: marketDef.handicap is defined from outcome "1"
        // (home)'s perspective — a single market carries exactly one line
        // pair, e.g. marketId 1056 = "AH -2 / +2" (marketLength: 2, no draw).
        // Outcome "2" (away) isn't given its own field; it's implicitly the
        // sign-flipped mirror. Confirmed 23 Sep 2026 from raw OddsPapi shape:
        // { marketName: "Asian Handicap", handicap: -2, marketType: "spreads",
        //   outcomes: [{ outcomeName: "1" }, { outcomeName: "2" }] }.
        // Previously this applied the same unflipped value to both sides,
        // producing impossible same-sign "pairs" (e.g. both teams at +0.25)
        // that findArbs() (index.js) then reported as fake arbs.
        let name = outcomeDef.outcomeName;
        let point = marketDef.handicap ?? undefined;
        if (marketDef.marketType === '1x2') {
          name = name === '1' ? homeTeam : name === '2' ? awayTeam : 'Draw';
        } else if (marketDef.marketType === 'moneyline') {
          // two-way winner market: only '1'/'2' are understood; anything else is skipped, never guessed
          if (name === '1') name = homeTeam; else if (name === '2') name = awayTeam; else continue;
        } else if (marketDef.marketType === 'spreads') {
          if (name === '1') { name = homeTeam; }
          else if (name === '2') { name = awayTeam; point = typeof point === 'number' ? -point : undefined; }
          else { continue; } // AH shouldn't have a draw-like third outcome — skip anything unexpected
          if (point == null) continue;
        }
        outcomes.push({ name, price: priceEntry.price, point });
      }
      if (outcomes.length === 0) continue;

      // Map OddsPapi market types to your app's standard market keys
      const keyMap = { '1x2': 'h2h', 'moneyline': 'h2h', 'totals': 'totals', 'bothteamsscore': 'btts' };
      const key = keyMap[marketDef.marketType] || marketDef.marketType;
      if (CORE_TYPES.has(marketDef.marketType) && !_loggedCore.has(bookmaker + ':' + marketDef.marketId) && _loggedCore.size < 60) {
        _loggedCore.add(bookmaker + ':' + marketDef.marketId);
        console.log('[OddsPapi][' + bookmaker + '] using market ' + marketDef.marketId + ' "' + marketDef.marketName + '" (' + marketDef.marketType + ', line ' + (marketDef.handicap ?? '-') + ')');
      }
      markets.push({ key, outcomes, marketName: marketDef.marketName });
    }
    if (markets.length === 0) return null;

    return {
      id: `oddspapi_${bookmaker}_${fixture.fixtureId}`,
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: fixture.startTime,
      // identifiers kept so duplicate / mis-linked fixtures can be detected (see dropAmbiguousFixtures)
      oddspapi: { fixtureId: fixture.fixtureId, p1: fixture.participant1Id, p2: fixture.participant2Id, bookmakerFixtureId: bookOdds.bookmakerFixtureId != null ? String(bookOdds.bookmakerFixtureId) : null },
      bookmakers: [{ key: bookmaker, title: bookmaker, markets, url: bookOdds.fixturePath || null, _wa: true }],
    };
  } catch {
    return null;
  }
}


// OddsPapi can list the SAME match more than once for a bookmaker (two fixture
// records, or two bookmaker events attached to one match). The two records carry
// different prices — seen on 22bet Lens vs Lyon, where one set matched the site
// and betano and the other (Under 3.5 at 1.85, Under 4 at 1.53) did not — and
// there is no way to tell from the data which one is real. So every fixture in
// such a group is dropped. Fewer arbs, never a coin-flip between two feeds.
function dropAmbiguousFixtures(events, bookmaker) {
  const groups = [];
  for (const ev of events) {
    const o = ev.oddspapi || {};
    const key = [String(o.p1), String(o.p2)].sort().join('|');
    const t = new Date(ev.commence_time).getTime();
    const g = groups.find(x => x.key === key && Math.abs(x.t - t) < 36 * 3600 * 1000);
    if (g) g.items.push(ev); else groups.push({ key, t, items: [ev] });
  }
  const kept = []; let dropped = 0;
  for (const g of groups) {
    if (g.items.length === 1) { kept.push(g.items[0]); continue; }
    dropped += g.items.length;
    console.warn('[OddsPapi][' + bookmaker + '] ' + g.items.length + ' fixture records for one match (' + g.items[0].home_team + ' vs ' + g.items[0].away_team + ', OddsPapi ids ' + g.items.map(e => e.oddspapi && e.oddspapi.fixtureId).join(', ') + ') — all dropped, cannot tell which is real');
  }
  return { kept, dropped };
}

/**
 * Main entry point: fetch + normalize odds for one bookmaker + one sportKey's
 * mapped tournament. Returns { events: [...], status: {ok, reason, fetchedAt} }
 * matching the shape your other scrapers use.
 */
async function fetchOddsPapiOdds(bookmaker, tournamentId, sportId, sportKey, opts = {}) {
  const cacheKey = `${bookmaker}:${tournamentId}`;
  const cached = oddsCache.get(cacheKey);

  try {
    let raw;
    // opts.bypassCache: used by /api/verify-arb to get a fresh price for one
    // arb's legs. Still WRITES the fresh result back to the cache.
    if (!opts.bypassCache && cached && cached.expiresAt > Date.now()) {
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

    const normalised = raw
      .map(fixture => normaliseFixture(fixture, bookmaker, sportKey, marketsMap, participantsMap))
      .filter(Boolean);
    const { kept: events, dropped: duplicatesDropped } = dropAmbiguousFixtures(normalised, bookmaker);

    console.log(`[OddsPapi][${bookmaker}] ${sportKey} -> normalised events: ${events.length}`);

    return { events, status: { ok: true, reason: null, fetchedAt: new Date().toISOString(), duplicatesDropped } };
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

/**
 * Diagnostic: lists every 1x2 / totals / spreads market OddsPapi returns for ONE
 * fixture (matched by a team-name fragment), with marketId, exact marketName,
 * line and prices, and whether it is currently whitelisted. Used by
 * /api/oddspapi-debug so market names can be verified against the bookmaker's
 * own page before being added to CONFIRMED_MARKETS. Reuses the cached
 * fixture pull when fresh, otherwise costs one OddsPapi call.
 */
async function debugFixtureMarkets(bookmaker, tournamentId, sportId, teamQuery, rawLine, filter = {}) {
  const cacheKey = `${bookmaker}:${tournamentId}`;
  const cached = oddsCache.get(cacheKey);
  let raw;
  if (cached && cached.expiresAt > Date.now()) raw = cached.data;
  else {
    raw = await fetchWithKeyRotation(`/odds-by-tournaments?tournamentIds=${tournamentId}&bookmaker=${bookmaker}`);
    oddsCache.set(cacheKey, { data: raw, expiresAt: Date.now() + ODDS_CACHE_TTL_MS });
  }
  const [marketsMap, participantsMap] = await Promise.all([getMarketsMap(sportId), getParticipantsMap(sportId)]);
  const nameOf = id => String(participantsMap.get(String(id)) || '');
  const q = String(teamQuery || '').toLowerCase();
  const hasOdds = f => f.bookmakerOdds && f.bookmakerOdds[bookmaker] && Object.keys(f.bookmakerOdds[bookmaker].markets || {}).length > 0;
  const fixture = (q && q !== 'first')
    ? raw.find(f => (nameOf(f.participant1Id) + ' ' + nameOf(f.participant2Id)).toLowerCase().includes(q))
    : raw.find(hasOdds);
  if (!fixture) {
    return { error: 'fixture_not_found', available: raw.filter(hasOdds).slice(0, 20).map(f => nameOf(f.participant1Id) + ' vs ' + nameOf(f.participant2Id)) };
  }
  const samePair = raw.filter(f => [String(f.participant1Id), String(f.participant2Id)].sort().join('|') === [String(fixture.participant1Id), String(fixture.participant2Id)].sort().join('|'))
    .map(f => {
      const b = f.bookmakerOdds && f.bookmakerOdds[bookmaker];
      const fm = b && b.markets && b.markets['101'];
      const px = fm && fm.outcomes ? Object.entries(fm.outcomes).map(([oid, od]) => (od.players && od.players['0'] && od.players['0'].price) || '-').join(' / ') : null;
      return { oddspapiFixtureId: f.fixtureId, home: nameOf(f.participant1Id), away: nameOf(f.participant2Id), startTime: f.startTime, bookmakerFixtureId: b ? b.bookmakerFixtureId : null, fixturePath: b ? b.fixturePath : null, fullTimeResultPrices: px };
    });
  const bookOdds = fixture.bookmakerOdds?.[bookmaker];
  const rows = [];
  for (const [marketIdStr, marketData] of Object.entries(bookOdds?.markets || {})) {
    const def = marketsMap.get(Number(marketIdStr));
    if (!def || !CORE_TYPES.has(def.marketType)) continue;
    // optional narrowing so the output fits a phone screen: type=totals & lines=2.75,3,3.5
    if (filter.type && def.marketType !== filter.type) continue;
    if (filter.lines && filter.lines.length && !filter.lines.includes(def.handicap)) continue;
    const prices = Object.entries(marketData.outcomes || {}).map(([oid, od]) => {
      const oDef = def.outcomes.find(o => o.outcomeId === Number(oid));
      const p = od.players?.['0'];
      return (oDef ? oDef.outcomeName : oid) + ':' + (p && p.active ? p.price : 'inactive');
    });
    const extra = {};
    for (const [k, v] of Object.entries(def)) if (!['marketId', 'marketName', 'marketType', 'handicap', 'outcomes'].includes(k)) extra[k] = v;
    const row = { marketId: def.marketId, marketName: def.marketName, marketType: def.marketType, line: def.handicap ?? null, whitelisted: isConfirmedMarket(def, bookmaker), otherFields: extra, prices: prices.join(' | ') };
    // rawLine: also return the untouched OddsPapi entry (every field, incl. any timestamps) for markets on that line
    if ((rawLine !== undefined && rawLine !== null && rawLine !== '' && def.handicap === Number(rawLine)) || filter.raw) row.raw = marketData;
    rows.push(row);
  }
  rows.sort((a, b) => (a.marketType + a.marketName + (a.line ?? '')).localeCompare(b.marketType + b.marketName + (b.line ?? ''), undefined, { numeric: true }));
  const bookMeta = {};
  for (const [k, v] of Object.entries(bookOdds || {})) if (k !== 'markets') bookMeta[k] = v;
  return { match: nameOf(fixture.participant1Id) + ' vs ' + nameOf(fixture.participant2Id), oddspapiFixtureId: fixture.fixtureId, fixturesForThisPairInFeed: samePair.length, sameTeamFixtures: samePair, startTime: fixture.startTime, bookmaker, bookmakerFields: bookMeta, marketCount: rows.length, markets: rows };
}

/**
 * Lists, for one sport's OddsPapi market catalogue, every 1x2 / totals / spreads
 * market NAME + period and whether it is whitelisted, plus which OTHER market
 * types exist (e.g. a basketball "moneyline"). The catalogue is per sportId and
 * shared by every bookmaker and league of that sport.
 */
async function catalogueSummary(sportId) {
  const map = await getMarketsMap(sportId);
  // NOTE: /markets returns the catalogue for ALL sports (tens of thousands of
  // markets); each market carries its own sportId. Only this sport's markets are
  // summarised, plus a count of which sportIds are present.
  const core = {}; const other = {}; const samples = {}; const sportIds = {};
  let mine = 0;
  for (const def of map.values()) {
    sportIds[def.sportId] = (sportIds[def.sportId] || 0) + 1;
    if (Number(def.sportId) !== Number(sportId)) continue;
    mine++;
    if (CORE_TYPES.has(def.marketType)) {
      const key = def.marketType + ' | ' + def.marketName + ' | period=' + def.period;
      core[key] = core[key] || { count: 0, whitelisted: isWhitelisted(def) };
      core[key].count++;
    } else {
      other[def.marketType] = (other[def.marketType] || 0) + 1;
      samples[def.marketType] = samples[def.marketType] || [];
      if (samples[def.marketType].length < 2 && !samples[def.marketType].includes(def.marketName)) samples[def.marketType].push(def.marketName);
    }
  }
  return {
    catalogueSize: map.size,
    marketsForThisSport: mine,
    marketsPerSportIdInCatalogue: sportIds,
    core: Object.entries(core).map(([market, v]) => ({ market, ...v })).sort((a, b) => a.market.localeCompare(b.market)),
    otherTypes: Object.fromEntries(Object.entries(other).filter(([t]) => !/^(players?|playertotals)/.test(t)).slice(0, 40).map(([t, n]) => [t, { count: n, exampleNames: samples[t] }])),
  };
}

module.exports = { fetchOddsPapiOdds, listTournaments, debugFixtureMarkets, catalogueSummary };
