// lib/oddspapi.js
const BASE = 'https://api.oddspapi.io/v4';
const ODDS_CACHE_TTL_MS = 4 * 60 * 1000;       // 4 min — matches your other WA caches
const REFERENCE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — markets/participants are near-static
const CALL_DELAY_MS = 1500;

const KEY_ENV_NAMES = [
  'ODDSPAPI_KEY', 'ODDSPAPI_KEY_2', 'ODDSPAPI_KEY_3',
  'ODDSPAPI_KEY_4', 'ODDSPAPI_KEY_5', 'ODDSPAPI_KEY_6',
];

let currentKeyIndex = 0;
const oddsCache = new Map();        // "bookmaker:tournamentId" -> { data, expiresAt }
const marketsCache = new Map();     // sportId -> { data: Map(marketId -> marketDef), expiresAt }
const participantsCache = new Map(); // sportId -> { data: Map(id -> name), expiresAt }

function getKeys() {
  return KEY_ENV_NAMES.map(n => process.env[n]).filter(Boolean);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const KEY_EXHAUSTED_STATUSES = [401, 403, 429];

async function fetchWithKeyRotation(path) {
  const keys = getKeys();
  if (keys.length === 0) throw new Error('No OddsPapi keys configured');

  let lastError = null;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (currentKeyIndex + attempt) % keys.length;
    const key = keys[idx];
    const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}apiKey=${key}`;
    try {
      const res = await fetch(url);
      console.log(`[OddsPapi] key ${idx} -> status ${res.status} for ${path}`);

      if (KEY_EXHAUSTED_STATUSES.includes(res.status)) {
        currentKeyIndex = (idx + 1) % keys.length;
        lastError = `key ${idx} status ${res.status}`;
        continue;
      }
      if (!res.ok) {
        throw new Error(`OddsPapi ${res.status}: ${await res.text()}`);
      }
      currentKeyIndex = idx;
      return await res.json();
    } catch (err) {
      lastError = err.message;
      currentKeyIndex = (idx + 1) % keys.length;
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

        // Translate OddsPapi's generic 1/X/2 labels into real team names for h2h
        let name = outcomeDef.outcomeName;
        if (marketDef.marketType === '1x2') {
          name = name === '1' ? homeTeam : name === '2' ? awayTeam : 'Draw';
        }
        outcomes.push({ name, price: priceEntry.price, point: marketDef.handicap || undefined });
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
      bookmakers: [{ key: bookmaker, title: bookmaker, markets, _wa: true }],
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

module.exports = { fetchOddsPapiOdds };
