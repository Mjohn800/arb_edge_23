import { getUserPlan, FREE_SPORTS, SCANNED_SPORTS } from '../../lib/serverAuth';
import { fetchSportybetOdds } from './scrapers/sportybet';
import { fetchBetanoOdds }    from './scrapers/betano';
import { fetch22BetOdds }       from './scrapers/22bet';
import { fetchParipesaOdds }    from './scrapers/Paripesa';
import { fetchMozzartbetOdds }  from './scrapers/mozzartbet';
import { fetchMelbetOdds }      from './scrapers/melbet';
import { fetchBetwayOdds }      from './scrapers/betway';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
export const SHARP_BOOKS_GLOBAL     = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet'];
export const SHARP_BOOKS_WESTAFRICA = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet', '1xbet']; // same Pinnacle reference as global, output filtered to WA-accessible books client-side
export const WA_BOOKS               = ['sportybet', 'betano', '22bet', 'paripesa', 'melbet', 'betway', 'mozzartbet', 'betfox'];

// Real Odds-API bookmaker keys we actually compare for the GLOBAL feed.
// NOTE: We use regions= instead of bookmakers= because the bookmakers= param
// only returns events where ALL listed books have data — if Singbet/SBOBet
// don't price a market, the whole event drops out even if Pinnacle has full odds.
// regions= returns all books in those regions, giving us Pinnacle + soft books
// on every event that has any coverage. Small credit cost difference is worth it.
// Confirmed regions that include our key books:
//   eu  → Pinnacle, Bet365, Unibet, William Hill, MarathonBet, Betfair
//   uk  → Betfair UK, William Hill UK
//   us  → DraftKings, FanDuel (not needed)
const GLOBAL_REGIONS = 'eu,uk';
// mozzartbet, melbet, and betway are sourced via OddsPapi (lib/oddspapi.js)
// rather than direct scraping — see pages/api/scrapers/{mozzartbet,melbet,betway}.js.
// msport dropped entirely (23 Sep 2026): confirmed OddsPapi only carries
// "MSPORT NG" (Nigeria), not the Ghana operation this app targets — zero
// fixtures returned across every tested league, liveOdds:false on their own
// bookmaker listing. Getting real MSport GH odds would need a direct scraper
// built from a DevTools capture of msport.com.gh, same pattern as betano.js.
// betfair_ex_uk dropped as redundant with betfair_ex_eu (same exchange, same odds).

// ─── BETFOX (inline — single JSON endpoint, no scraper module needed) ────────
// CONFIRMED via DevTools (2026-09-17):
//   GET https://www.betfox.com.gh/api/client/v4/offer/competitions
//       ?ids=sr:tournament:{id}&enriched=2&sport=Football
//   → returns { enriched: [{ id, name, category, fixtures: [...] }], minimal: [...] }
//   Each fixture already carries its markets + odds inline — no per-match request needed.
//   Confirmed market types: FOOTBALL_WINNER (1X2), FOOTBALL_OVER_UNDER_GOALS (totals),
//   FOOTBALL_BOTH_TEAMS_TO_SCORE (BTTS). Tournament IDs are the same Sportradar IDs
//   used by the SportyBet scraper (shared feed provider).
const BETFOX_TOURNAMENT_MAP = {
  soccer_epl:                    'sr:tournament:17',
  soccer_uefa_champs_league:     'sr:tournament:7',
  soccer_spain_la_liga:          'sr:tournament:8',
  soccer_germany_bundesliga:     'sr:tournament:35',
  soccer_italy_serie_a:          'sr:tournament:23',
  soccer_france_ligue_one:       'sr:tournament:34',
  soccer_netherlands_eredivisie: 'sr:tournament:37',
  soccer_portugal_primeira_liga: 'sr:tournament:238',
  soccer_efl_champ:              'sr:tournament:18', // fixed key (was soccer_england_efl_champ, not a real Odds API key)
  soccer_norway_eliteserien:     'sr:tournament:20',
  soccer_sweden_allsvenskan:     'sr:tournament:40',
  soccer_belgium_first_div:      'sr:tournament:38',
  soccer_spl:                    'sr:tournament:36',
  soccer_fifa_world_cup:         'sr:tournament:16',
  soccer_brazil_campeonato:      'sr:tournament:325', // Brasileirao Serie A. VERIFY this ID in Betfox's network tab
};

const BETFOX_BASE = 'https://www.betfox.com.gh/api/client/v4/offer';
// Matches the real browser capture exactly: desktop Chrome/Windows UA, and a
// Referer that's the actual sportsbook page (not just the bare domain) —
// Cloudflare's bot check on this site appears to care about both.
const BETFOX_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
function betfoxHeaders(tournamentId) {
  return {
    'User-Agent': BETFOX_USER_AGENT,
    'Accept': 'application/json, text/plain, */*',
    // Real capture: https://www.betfox.com.gh/sportsbook/football?tournament=sr:tournament:8,sr:tournament:35,...
    'Referer': `https://www.betfox.com.gh/sportsbook/football?tournament=${encodeURIComponent(tournamentId)}`,
    'Sec-Ch-Ua': '"Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
  };
}

function normaliseBetfoxOutcome(market) {
  const out = { h2h: [], totals: [], btts: [] };
  for (const o of (market.outcomes || [])) {
    const price = parseFloat(o.odds);
    if (!price || price <= 1.0 || o.status !== 'Active') continue;

    if (market.type === 'FOOTBALL_WINNER') {
      out.h2h.push({ name: o.name, price, _value: o.value });
    } else if (market.type === 'FOOTBALL_OVER_UNDER_GOALS') {
      const point = parseFloat(market.properties?.boundary);
      const side = o.value === 'OVER' ? 'Over' : o.value === 'UNDER' ? 'Under' : null;
      if (side && !isNaN(point)) out.totals.push({ name: side, price, point });
    } else if (market.type === 'FOOTBALL_BOTH_TEAMS_TO_SCORE') {
      out.btts.push({ name: o.value === 'YES' ? 'Yes' : 'No', price });
    }
  }
  return out;
}

function normaliseBetfoxFixture(fixture, sportKey) {
  try {
    const winnerMarket = (fixture.markets || []).find(m => m.type === 'FOOTBALL_WINNER');
    if (!winnerMarket) return null;
    const homeOutcome = winnerMarket.outcomes.find(o => o.value === 'HOME');
    const awayOutcome = winnerMarket.outcomes.find(o => o.value === 'AWAY');
    if (!homeOutcome || !awayOutcome) return null;
    const homeTeam = homeOutcome.name, awayTeam = awayOutcome.name;

    const markets = [];
    let h2hAll = [], totalsAll = [], bttsAll = [];
    for (const market of (fixture.markets || [])) {
      const { h2h, totals, btts } = normaliseBetfoxOutcome(market);
      h2hAll = h2hAll.concat(h2h.map(o => ({
        name: o._value === 'HOME' ? homeTeam : o._value === 'AWAY' ? awayTeam : 'Draw',
        price: o.price,
      })));
      totalsAll = totalsAll.concat(totals);
      bttsAll = bttsAll.concat(btts);
    }
    if (h2hAll.length >= 2) markets.push({ key: 'h2h', outcomes: h2hAll });
    if (totalsAll.length >= 2) markets.push({ key: 'totals', outcomes: totalsAll });
    if (bttsAll.length >= 2) markets.push({ key: 'btts', outcomes: bttsAll });
    if (markets.length === 0) return null;

    return {
      id: 'betfox_' + fixture.id,
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: fixture.startTime,
      bookmakers: [{ key: 'betfox', title: 'Betfox', markets, _wa: true }],
    };
  } catch { return null; }
}

async function fetchBetfoxOdds(sportKey) {
  const tournamentId = BETFOX_TOURNAMENT_MAP[sportKey];
  if (!tournamentId) return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };

  try {
    const url = `${BETFOX_BASE}/competitions?ids=${encodeURIComponent(tournamentId)}&enriched=2&sport=Football`;
    const res = await fetch(url, { headers: betfoxHeaders(tournamentId), signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.warn('[Betfox] competitions', res.status, 'for', sportKey);
      return { events: [], status: { ok: false, reason: 'http_' + res.status, fetchedAt: new Date().toISOString() } };
    }
    const json = await res.json();
    const tournaments = json?.enriched || [];
    const fixtures = tournaments.flatMap(t => t.fixtures || []);

    const now = Date.now();
    const upcoming = fixtures.filter(f => {
      const ms = new Date(f.startTime).getTime();
      return !isNaN(ms) && ms > now - 3 * 60 * 60 * 1000 && f.status === 'Active';
    });

    const normalised = upcoming.map(f => normaliseBetfoxFixture(f, sportKey)).filter(Boolean);
    console.log('[Betfox]', sportKey, '→ raw:', fixtures.length, '| upcoming:', upcoming.length, '| normalised:', normalised.length);
    return { events: normalised, status: { ok: true, reason: null, fetchedAt: new Date().toISOString() } };
  } catch (err) {
    console.warn('[Betfox] error for', sportKey, err.message);
    return { events: [], status: { ok: false, reason: err.name === 'TimeoutError' ? 'timeout' : err.message, fetchedAt: new Date().toISOString() } };
  }
}

// ─── WA SCRAPER CACHE (in-memory, 3 min TTL) ─────────────────────────────────
const waCache = {};
const WA_CACHE_TTL = 3 * 60 * 1000;

// Tracks last known health per bookmaker, persists across requests in the
// same serverless instance (best-effort — resets on cold start).
const waHealth = {
  sportybet:  { ok: null, reason: null, fetchedAt: null },
  betano:     { ok: null, reason: null, fetchedAt: null },
  '22bet':    { ok: null, reason: null, fetchedAt: null },
  paripesa:   { ok: null, reason: null, fetchedAt: null },
  mozzartbet: { ok: null, reason: null, fetchedAt: null },
  melbet:     { ok: null, reason: null, fetchedAt: null },
  betway:     { ok: null, reason: null, fetchedAt: null },
  betfox:     { ok: null, reason: null, fetchedAt: null },
};

// Tracks keys known to be exhausted/invalid on THIS warm serverless instance,
// so we don't waste a call re-trying a dead key on every single sport request
// within the same scan cycle. Resets on cold start.
const deadKeys = new Map(); // key -> timestamp it died
const DEAD_KEY_TTL = 5 * 60 * 1000;

// ─── GLOBAL ODDS-API CACHE (in-memory, 5 min TTL) ────────────────────────────
// This is the fix for quota exhaustion: without it, EVERY incoming scan
// request re-fetches the-odds-api fresh, so usage scales 1:1 with traffic.
// With it, N users scanning the same sport within the same 5-minute window
// all share ONE the-odds-api call instead of N separate ones. Best-effort —
// resets on cold start, same caveat as waCache — but covers the common case
// of multiple people using the app around the same time.
const globalOddsCache = {};
const GLOBAL_CACHE_TTL = 5 * 60 * 1000;
function globalCacheKey(sport, markets) { return `${sport}::${markets}`; }

// Single-flight: if the cache is stale and 5 requests for the SAME sport land
// on this serverless instance within the same few hundred ms (a realistic
// "everyone opens the site right after a community post" scenario), only the
// FIRST one should actually loop through the-odds-api keys. The other 4 just
// await that same in-flight promise instead of each starting their own
// key-rotation loop — otherwise a stale-cache burst costs 5x instead of 1x,
// even with caching in place.
const inFlightGlobal = {};

async function getWAOdds(sportKey) {
  const cached = waCache[sportKey];
  if (cached && Date.now() - cached.ts < WA_CACHE_TTL) {
    return { events: cached.data, health: cached.health, fromCache: true };
  }

  const [sportybet, betano, twobet, paripesa, mozzartbet, melbet, betway, betfox] = await Promise.allSettled([
    fetchSportybetOdds(sportKey),
    fetchBetanoOdds(sportKey),
    fetch22BetOdds(sportKey),
    fetchParipesaOdds(sportKey),
    fetchMozzartbetOdds(sportKey),
    fetchMelbetOdds(sportKey),
    fetchBetwayOdds(sportKey),
    fetchBetfoxOdds(sportKey),
  ]);

  const extractStatus = (settled, fallbackReason) =>
    settled.status === 'fulfilled' && settled.value?.status
      ? settled.value.status
      : { ok: false, reason: fallbackReason, fetchedAt: new Date().toISOString() };

  waHealth.sportybet   = extractStatus(sportybet,   'promise_rejected: ' + (sportybet.reason?.message   || 'unknown'));
  waHealth.betano      = extractStatus(betano,      'promise_rejected: ' + (betano.reason?.message      || 'unknown'));
  waHealth['22bet']    = extractStatus(twobet,      'promise_rejected: ' + (twobet.reason?.message      || 'unknown'));
  waHealth.paripesa    = extractStatus(paripesa,    'promise_rejected: ' + (paripesa.reason?.message    || 'unknown'));
  waHealth.mozzartbet  = extractStatus(mozzartbet,  'promise_rejected: ' + (mozzartbet.reason?.message  || 'unknown'));
  waHealth.melbet      = extractStatus(melbet,      'promise_rejected: ' + (melbet.reason?.message      || 'unknown'));
  waHealth.betway      = extractStatus(betway,      'promise_rejected: ' + (betway.reason?.message      || 'unknown'));
  waHealth.betfox      = extractStatus(betfox,      'promise_rejected: ' + (betfox.reason?.message      || 'unknown'));

  const results = [
    ...(sportybet.status   === 'fulfilled' ? sportybet.value?.events   || [] : []),
    ...(betano.status      === 'fulfilled' ? betano.value?.events      || [] : []),
    ...(twobet.status      === 'fulfilled' ? twobet.value?.events      || [] : []),
    ...(paripesa.status    === 'fulfilled' ? paripesa.value?.events    || [] : []),
    ...(mozzartbet.status  === 'fulfilled' ? mozzartbet.value?.events  || [] : []),
    ...(melbet.status      === 'fulfilled' ? melbet.value?.events      || [] : []),
    ...(betway.status      === 'fulfilled' ? betway.value?.events      || [] : []),
    ...(betfox.status      === 'fulfilled' ? betfox.value?.events      || [] : []),
  ];

  console.log('[odds][WA]', sportKey,
    '-> sportybet:',  sportybet.status   === 'fulfilled' ? (sportybet.value?.events?.length   ?? 0) : 'failed: ' + sportybet.reason?.message,
    '| betano:',      betano.status      === 'fulfilled' ? (betano.value?.events?.length      ?? 0) : 'failed: ' + betano.reason?.message,
    '| 22bet:',       twobet.status      === 'fulfilled' ? (twobet.value?.events?.length      ?? 0) : 'failed: ' + twobet.reason?.message,
    '| paripesa:',    paripesa.status    === 'fulfilled' ? (paripesa.value?.events?.length    ?? 0) : 'failed: ' + paripesa.reason?.message,
    '| mozzartbet:',  mozzartbet.status  === 'fulfilled' ? (mozzartbet.value?.events?.length   ?? 0) : 'failed: ' + mozzartbet.reason?.message,
    '| melbet:',      melbet.status      === 'fulfilled' ? (melbet.value?.events?.length      ?? 0) : 'failed: ' + melbet.reason?.message,
    '| betway:',      betway.status      === 'fulfilled' ? (betway.value?.events?.length      ?? 0) : 'failed: ' + betway.reason?.message,
    '| betfox:',      betfox.status      === 'fulfilled' ? (betfox.value?.events?.length      ?? 0) : 'failed: ' + betfox.reason?.message,
    '| total:', results.length);

  const health = {
    sportybet: waHealth.sportybet, betano: waHealth.betano,
    '22bet': waHealth['22bet'], paripesa: waHealth.paripesa,
    mozzartbet: waHealth.mozzartbet, melbet: waHealth.melbet, betway: waHealth.betway,
    betfox: waHealth.betfox,
  };
  waCache[sportKey] = { data: results, health, ts: Date.now() };
  return { events: results, health, fromCache: false };
}

// ─── MERGE LOGIC ──────────────────────────────────────────────────────────────
// Match global + WA events by team name (fuzzy) + commence time (±30 min).
// If matched: inject WA bookmakers into the global event.
// If WA-only (e.g. Ghana Premier League): add as standalone event.
function mergeEvents(globalEvents, waEvents) {
  const merged = globalEvents.map(ev => ({ ...ev, bookmakers: [...(ev.bookmakers || [])] }));

  for (const waEv of waEvents) {
    const match = merged.find(ev => {
      const homeMatch = fuzzyMatch(ev.home_team, waEv.home_team);
      const awayMatch = fuzzyMatch(ev.away_team, waEv.away_team);
      const timeMatch = Math.abs(new Date(ev.commence_time) - new Date(waEv.commence_time)) < 30 * 60 * 1000;
      return homeMatch && awayMatch && timeMatch;
    });

    if (match) {
      for (const bm of waEv.bookmakers) {
        if (!match.bookmakers.find(b => b.key === bm.key)) {
          match.bookmakers.push(bm);
        }
      }
    } else {
      merged.push(waEv);
    }
  }

  return merged;
}

function fuzzyMatch(a, b) {
  if (!a || !b) return false;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const na = norm(a), nb = norm(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

// Does the actual work of trying each API key until one succeeds, and writes
// the result to the shared cache on success. Called at most ONCE per stale
// sport at a time — concurrent requests for the same sport all await the same
// call to this function instead of each running their own copy (see
// inFlightGlobal above).
async function fetchGlobalOddsFresh(sport, markets, keys, cacheKey) {
  let lastError = null;
  let lastErrorDetail = null;
  let globalData = null;
  let remainingRequests = null;
  let usedRequests = null;
  let keyIndex = null;

  for (const key of keys) {
    const deadAt = deadKeys.get(key);
    if (deadAt && Date.now() - deadAt < DEAD_KEY_TTL) continue;
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${key}&regions=${GLOBAL_REGIONS}&markets=${markets}&oddsFormat=decimal&oddsState=live,upcoming`;
    try {
      const response = await fetch(url);
      console.log(`[odds] key ${keys.indexOf(key)+1} → status ${response.status}`);

      if (response.status === 429) {
        lastError = 'quota';
        deadKeys.set(key, Date.now());
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        let body = null;
        try { body = await response.json(); } catch {}
        lastError = (body && (body.message || body.error_code)) || `key error (${response.status})`;
