/**
 * scrapers/betfox.js
 *
 * CONFIRMED via DevTools capture (17-18 Sep 2026):
 *
 *   GET https://www.betfox.com.gh/api/client/v4/offer/competitions
 *       ?ids={sr:tournament ids, comma-separated}&enriched=2&sport=Football
 *
 * With enriched=2, the response embeds full fixtures (incl. markets + odds)
 * directly inside each competition object — no separate events endpoint needed.
 * Tournament IDs are the same Sportradar sr:tournament:* scheme SportyBet uses,
 * so SPORT_MAP below reuses those values directly (cross-checked against
 * sportybet.js — LaLiga:8, Bundesliga:35, Serie A:23, Ligue 1:34, Portugal:238,
 * Eredivisie:37, Champions League:7, Allsvenskan:40, Eliteserien:20,
 * Scottish Premiership:36, EPL:17 all confirmed identical on both books).
 *
 * BATCHING CONFIRMED (18 Sep 2026): Betfox's own frontend requests all
 * tournament IDs in a single comma-separated `ids=` call. This scraper does
 * the same — one upstream call fetches every mapped league, cached in-memory
 * for CACHE_TTL_MS so repeated fetchBetfoxOdds() calls within that window
 * (one per sportKey from api/odds.js) don't re-hit the API each time. Same
 * module-scope caching pattern as api/team-form.js, just a much shorter TTL
 * since odds move fast and team form doesn't.
 *
 * REQUIRED HEADERS (confirmed 18 Sep 2026 — request fails with
 * "Invalid value for: header X-Betr-Brand" without these):
 *   X-Betr-Brand:    betfox.com.gh   (static)
 *   X-Betr-Operator: bf-group        (static)
 *   X-Correlation-Id, X-Request-Id, X-Session-Id — all UUIDs, generated fresh
 *   per request by the real client; we do the same via crypto.randomUUID()
 *   rather than reusing static values, since it's unclear whether the API
 *   rate-limits or flags repeated IDs.
 *
 * Response shape (per competition in `enriched`):
 *   { id, name, category: { name, translation }, fixtures: [
 *       { id, sport, external: { id, provider }, startTime, status,
 *         totalMarkets, live, includesLiveCoverage,
 *         markets: [ { type, boosted, properties, outcomes: [
 *             { id, name, value, valueDetails, odds, status } ] } ] }
 *   ] }
 *
 * Confirmed market types:
 *   FOOTBALL_WINNER            → h2h    (value: HOME/AWAY/DRAW)
 *   FOOTBALL_OVER_UNDER_GOALS  → totals (properties.boundary = line; value: OVER/UNDER)
 *   FOOTBALL_BOTH_TEAMS_TO_SCORE → btts (value: YES/NO)
 *
 * ⚠️ UNCONFIRMED, needs verification:
 *   - Asian handicap / spreads market type string — not yet captured
 *   - basketball/tennis/cricket/MMA tournament IDs — only football confirmed
 *   - whether the X-Betr-Operator value ("bf-group") or X-Betr-Brand
 *     ("betfox.com.gh") ever differ by region/locale — only Ghana captured
 */

const crypto = require('crypto');

const BETFOX_SPORT_MAP = {
  soccer_epl:                    { tournamentId: 'sr:tournament:17'  }, // ✓ confirmed
  soccer_uefa_champs_league:     { tournamentId: 'sr:tournament:7'   }, // ✓ confirmed
  soccer_spain_la_liga:          { tournamentId: 'sr:tournament:8'   }, // ✓ confirmed
  soccer_germany_bundesliga:     { tournamentId: 'sr:tournament:35'  }, // ✓ confirmed
  soccer_italy_serie_a:          { tournamentId: 'sr:tournament:23'  }, // ✓ confirmed
  soccer_france_ligue_one:       { tournamentId: 'sr:tournament:34'  }, // ✓ confirmed
  soccer_portugal_primeira_liga: { tournamentId: 'sr:tournament:238' }, // ✓ confirmed
  soccer_netherlands_eredivisie: { tournamentId: 'sr:tournament:37'  }, // ✓ confirmed
  soccer_sweden_allsvenskan:     { tournamentId: 'sr:tournament:40'  }, // ✓ confirmed
  soccer_norway_eliteserien:     { tournamentId: 'sr:tournament:20'  }, // ✓ confirmed
  soccer_spl:                    { tournamentId: 'sr:tournament:36'  }, // ✓ confirmed (Scottish Premiership)
  // basketball_nba, tennis_*, mma_*, cricket_* — not yet captured for Betfox.
};

// Dedupe just in case two sportKeys ever map to the same tournamentId.
const ALL_TOURNAMENT_IDS = [...new Set(Object.values(BETFOX_SPORT_MAP).map(m => m.tournamentId))];

const BASE = 'https://www.betfox.com.gh/api/client/v4/offer/competitions';
const CACHE_TTL_MS = 60 * 1000; // odds move fast — keep this short, unlike team-form's 6hr cache

function buildHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-GB,en;q=0.9',
    'Origin': 'https://www.betfox.com.gh',
    'Referer': 'https://www.betfox.com.gh/',
    'X-Betr-Brand': 'betfox.com.gh',
    'X-Betr-Operator': 'bf-group',
    'X-Locale': 'en',
    'X-Correlation-Id': crypto.randomUUID(),
    'X-Request-Id': crypto.randomUUID(),
    'X-Session-Id': crypto.randomUUID(),
  };
}

const MARKET_MAP = {
  FOOTBALL_WINNER: 'h2h',
  FOOTBALL_OVER_UNDER_GOALS: 'totals',
  FOOTBALL_BOTH_TEAMS_TO_SCORE: 'btts',
};

// Module-scope cache — persists across warm serverless invocations, same as team-form.js.
let _cache = { competitionsById: null, fetchedAt: 0, error: null };

async function fetchAllCompetitions() {
  const age = Date.now() - _cache.fetchedAt;
  if (_cache.competitionsById && age < CACHE_TTL_MS) return _cache;

  try {
    const url = `${BASE}?ids=${encodeURIComponent(ALL_TOURNAMENT_IDS.join(','))}&enriched=2&sport=Football`;
    const res = await fetch(url, { headers: buildHeaders(), signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      let body = '';
      try { body = (await res.text()).slice(0, 300); } catch {}
      console.warn('[Betfox] competitions', res.status, '| body:', body);
      _cache = { competitionsById: _cache.competitionsById || {}, fetchedAt: Date.now(), error: 'http_' + res.status };
      return _cache;
    }

    const json = await res.json();
    const competitions = json?.enriched || [];
    const byId = {};
    for (const c of competitions) { if (c?.id) byId[c.id] = c; }

    console.log('[Betfox] fetched', competitions.length, 'competitions,', ALL_TOURNAMENT_IDS.length, 'requested');
    _cache = { competitionsById: byId, fetchedAt: Date.now(), error: null };
    return _cache;

  } catch (err) {
    console.warn('[Betfox] fetchAllCompetitions error:', err.message);
    _cache = { competitionsById: _cache.competitionsById || {}, fetchedAt: Date.now(), error: err.name === 'TimeoutError' ? 'timeout' : err.message };
    return _cache;
  }
}

async function fetchBetfoxOdds(sportKey) {
  const mapping = BETFOX_SPORT_MAP[sportKey];
  if (!mapping) return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };

  try {
    const { competitionsById, error } = await fetchAllCompetitions();
    const competition = competitionsById?.[mapping.tournamentId];

    if (!competition) {
      // Either the batch call failed entirely, or this tournament had no data this cycle.
      return { events: [], status: { ok: !error, reason: error || 'tournament_not_in_response', fetchedAt: new Date().toISOString() } };
    }

    const rawFixtures = competition.fixtures || [];
    const normalised = rawFixtures.map(fx => normaliseEvent(fx, sportKey)).filter(Boolean);

    console.log('[Betfox]', sportKey, '→ fixtures:', rawFixtures.length, '| normalised:', normalised.length);
    return { events: normalised, status: { ok: true, reason: null, fetchedAt: new Date().toISOString() } };

  } catch (err) {
    console.warn('[Betfox] error for', sportKey, err.message);
    return { events: [], status: { ok: false, reason: err.name === 'TimeoutError' ? 'timeout' : err.message, fetchedAt: new Date().toISOString() } };
  }
}

function normaliseEvent(fx, sportKey) {
  try {
    // Fixture object itself doesn't carry team names directly in the confirmed
    // shape — team names come from the FOOTBALL_WINNER outcome names (HOME/AWAY).
    // If Betfox's fixture object turns out to have its own home/away fields,
    // prefer those over deriving from the market (more reliable + faster).
    if (!fx.startTime) return null;

    let homeTeam = null, awayTeam = null;
    const h2hOutcomes = [], totalsOutcomes = [], bttsOutcomes = [];

    for (const market of (fx.markets || [])) {
      const mKey = MARKET_MAP[market.type];
      if (!mKey) continue;

      for (const o of (market.outcomes || [])) {
        const price = parseFloat(o.odds);
        if (!price || price <= 1.0 || o.status !== 'Active') continue;

        if (mKey === 'h2h') {
          if (o.value === 'HOME') { homeTeam = o.name; h2hOutcomes.push({ name: o.name, price }); }
          else if (o.value === 'AWAY') { awayTeam = o.name; h2hOutcomes.push({ name: o.name, price }); }
          else if (o.value === 'DRAW') { h2hOutcomes.push({ name: 'Draw', price }); }
        } else if (mKey === 'totals') {
          const point = parseFloat(market.properties?.boundary);
          if (point == null || isNaN(point)) continue;
          const side = o.value === 'OVER' ? 'Over' : o.value === 'UNDER' ? 'Under' : null;
          if (!side) continue;
          totalsOutcomes.push({ name: side, price, point });
        } else if (mKey === 'btts') {
          const side = o.value === 'YES' ? 'Yes' : o.value === 'NO' ? 'No' : null;
          if (!side) continue;
          bttsOutcomes.push({ name: side, price });
        }
      }
    }

    // Fall back if home/away weren't derivable from FOOTBALL_WINNER (e.g. market missing/suspended)
    if (!homeTeam || !awayTeam) return null;

    const markets = [];
    if (h2hOutcomes.length >= 2)    markets.push({ key: 'h2h',    outcomes: h2hOutcomes });
    if (totalsOutcomes.length >= 2) markets.push({ key: 'totals', outcomes: totalsOutcomes });
    if (bttsOutcomes.length >= 2)   markets.push({ key: 'btts',   outcomes: bttsOutcomes });
    if (markets.length === 0) return null;

    return {
      id: 'betfox_' + fx.id,
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: new Date(fx.startTime).toISOString(),
      bookmakers: [{ key: 'betfox', title: 'Betfox', markets, _wa: true }],
    };
  } catch { return null; }
}

module.exports = { fetchBetfoxOdds };
