import { getUserPlan, FREE_SPORTS, SCANNED_SPORTS } from '../../lib/serverAuth';
import { fetchSportybetOdds } from './scrapers/sportybet';
import { fetchBetanoOdds }    from './scrapers/betano';
import { fetch22BetOdds }       from './scrapers/22bet';
import { fetchParipesaOdds }    from './scrapers/Paripesa';
import { fetchMelbetOdds }      from './scrapers/melbet';
import { fetchBetanoOddsPapi, fetch22BetOddsPapi } from '../../lib/oddspapi-wa';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
export const SHARP_BOOKS_GLOBAL     = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet'];
export const SHARP_BOOKS_WESTAFRICA = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet', '1xbet']; // same Pinnacle reference as global, output filtered to WA-accessible books client-side
export const WA_BOOKS               = ['sportybet', 'betano', '22bet', 'paripesa', 'melbet', 'betway', '1xbet', 'betfox'];

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
// melbet is sourced via OddsPapi (lib/oddspapi.js) rather than direct
// scraping — see pages/api/scrapers/melbet.js.
// betway (25 Sep 2026): dropped the scrapers/betway.js call entirely — the
// global the-odds-api fetch below (regions=eu,uk) already returns a 'betway'
// bookmaker on covered events, and since 'betway' is in WA_BOOKS, that global
// entry gets bm._wa = true same as any WA scraper result (see the .forEach
// right after the the-odds-api call succeeds). No separate WA fetch needed,
// so getWAOdds() below no longer calls it. Caveat: this is Betway's UK-facing
// odds via the-odds-api, not a Ghana-specific scrape — verify the prices match
// betway's own GH site before trusting them the way Betano's are trusted.
// Mozzart removed entirely (23 Sep 2026): dead .com.gh link-out and broken
// OddsPapi data path (404s on /odds-by-tournaments for this bookmaker).
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
  melbet:     { ok: null, reason: null, fetchedAt: null },
  betfox:     { ok: null, reason: null, fetchedAt: null },
  // betway intentionally absent: no longer WA-scraped, see comment above getWAOdds.
};

// Tracks keys known to be exhausted/invalid on THIS warm serverless instance,
// so we don't waste a call re-trying a dead key on every single sport request
// within the same scan cycle. Resets on cold start.
const deadKeys = new Map(); // key -> timestamp it died
const DEAD_KEY_TTL = 5 * 60 * 1000;

// ── Per-user rate limiting ───────────────────────────────────────────────
// Simple in-memory limiter: N requests per user per rolling window. Same
// caveat as the caches below — resets per serverless instance, and doesn't
// coordinate across multiple warm instances under real traffic — but stops
// a single runaway client (buggy frontend loop, or a bot hitting the API
// directly) from burning quota alone while a shared store is pending.
const rateLimitMap = new Map(); // userId -> array of recent request timestamps
const RATE_LIMIT_MAX = 20;         // requests
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // per 60 seconds

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

// Betano and 22Bet are geo/bot-blocked at ScraperAPI's free tier (see the
// pre-launch notes above), so try OddsPapi first — it's a clean JSON source
// with no proxy needed — and only fall back to the direct scraper if
// OddsPapi has no tournament mapped for this sport yet (ODDSPAPI_TOURNAMENT_MAP
// in lib/oddspapi-wa.js still has TODOs for most leagues).
async function getBetanoOdds(sportKey) {
  const papi = await fetchBetanoOddsPapi(sportKey);
  if (papi.status.ok && papi.events.length > 0) return papi;
  return fetchBetanoOdds(sportKey);
}

async function get22BetOdds(sportKey) {
  const papi = await fetch22BetOddsPapi(sportKey);
  if (papi.status.ok && papi.events.length > 0) return papi;
  return fetch22BetOdds(sportKey);
}

async function getWAOdds(sportKey) {
  const cached = waCache[sportKey];
  if (cached && Date.now() - cached.ts < WA_CACHE_TTL) {
    return { events: cached.data, health: cached.health, fromCache: true };
  }

  const [sportybet, betano, twobet, paripesa, melbet, betfox] = await Promise.allSettled([
    fetchSportybetOdds(sportKey),
    getBetanoOdds(sportKey),
    get22BetOdds(sportKey),
    fetchParipesaOdds(sportKey),
    fetchMelbetOdds(sportKey),
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
  waHealth.melbet      = extractStatus(melbet,      'promise_rejected: ' + (melbet.reason?.message      || 'unknown'));
  waHealth.betfox      = extractStatus(betfox,      'promise_rejected: ' + (betfox.reason?.message      || 'unknown'));

  const results = [
    ...(sportybet.status   === 'fulfilled' ? sportybet.value?.events   || [] : []),
    ...(betano.status      === 'fulfilled' ? betano.value?.events      || [] : []),
    ...(twobet.status      === 'fulfilled' ? twobet.value?.events      || [] : []),
    ...(paripesa.status    === 'fulfilled' ? paripesa.value?.events    || [] : []),
    ...(melbet.status      === 'fulfilled' ? melbet.value?.events      || [] : []),
    ...(betfox.status      === 'fulfilled' ? betfox.value?.events      || [] : []),
  ];

  console.log('[odds][WA]', sportKey,
    '-> sportybet:',  sportybet.status   === 'fulfilled' ? (sportybet.value?.events?.length   ?? 0) : 'failed: ' + sportybet.reason?.message,
    '| betano:',      betano.status      === 'fulfilled' ? (betano.value?.events?.length      ?? 0) : 'failed: ' + betano.reason?.message,
    '| 22bet:',       twobet.status      === 'fulfilled' ? (twobet.value?.events?.length      ?? 0) : 'failed: ' + twobet.reason?.message,
    '| paripesa:',    paripesa.status    === 'fulfilled' ? (paripesa.value?.events?.length    ?? 0) : 'failed: ' + paripesa.reason?.message,
    '| melbet:',      melbet.status      === 'fulfilled' ? (melbet.value?.events?.length      ?? 0) : 'failed: ' + melbet.reason?.message,
    '| betfox:',      betfox.status      === 'fulfilled' ? (betfox.value?.events?.length      ?? 0) : 'failed: ' + betfox.reason?.message,
    '| total:', results.length);

  const health = {
    sportybet: waHealth.sportybet, betano: waHealth.betano,
    '22bet': waHealth['22bet'], paripesa: waHealth.paripesa,
    melbet: waHealth.melbet,
    betfox: waHealth.betfox,
    // betway health is reported from the global the-odds-api result instead (see handler).
  };
  waCache[sportKey] = { data: results, health, ts: Date.now() };
  return { events: results, health, fromCache: false };
}

// ─── MERGE LOGIC ──────────────────────────────────────────────────────────────
// Match global + WA events by team name (fuzzy) + commence time (±MERGE_KICKOFF_MS).
// If matched: inject WA bookmakers into the global event.
// If WA-only (e.g. Ghana Premier League): add as standalone event.
// Same fixture only if kickoffs are this close. Was 30 min, which let a 19:00 and a 19:30
// listing (often two different fixtures, or a rescheduled one) merge into one event.
const MERGE_KICKOFF_MS = 10 * 60 * 1000;

function mergeEvents(globalEvents, waEvents) {
  const merged = globalEvents.map(ev => ({ ...ev, bookmakers: [...(ev.bookmakers || [])] }));

  for (const waEv of waEvents) {
    const match = merged.find(ev => {
      const homeMatch = fuzzyMatch(ev.home_team, waEv.home_team);
      const awayMatch = fuzzyMatch(ev.away_team, waEv.away_team);
      const timeMatch = Math.abs(new Date(ev.commence_time) - new Date(waEv.commence_time)) < MERGE_KICKOFF_MS;
      return homeMatch && awayMatch && timeMatch;
    });

    if (match) {
      for (const bm of waEv.bookmakers) {
        if (!match.bookmakers.find(b => b.key === bm.key)) {
          // Keep the WA source's OWN event label (teams + kickoff as that feed lists
          // them). After the merge the event only carries the global feed's names, so
          // without this a mis-matched fixture is invisible on the card.
          match.bookmakers.push({ ...bm, srcEvent: { home: waEv.home_team, away: waEv.away_team, start: waEv.commence_time } });
        }
      }
    } else {
      merged.push(waEv);
    }
  }

  return merged;
}

// Squad qualifiers: a team name carrying one must be matched by a name carrying the SAME one,
// so "Arsenal" never matches "Arsenal Women" / "Arsenal U21" / "Arsenal II" through the
// substring rule below.
function squadTags(s) {
  const t = ' ' + String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ') + ' ';
  const tags = [];
  if (/ (women|womens|ladies|w|fem|feminino|femenino|femminile|frauen) /.test(t)) tags.push('w');
  if (/ u ?(17|18|19|20|21|23) /.test(t) || / (youth|juniors?) /.test(t)) tags.push('youth');
  if (/ (reserves?|res|ii|2|b|c|castilla|primavera|juvenil|amateur) /.test(t)) tags.push('res');
  return tags.sort().join(',');
}

// Whole-name equivalents that token rules can't derive (nickname / abbreviation -> full name).
// Add to this list whenever a real feed pair fails to merge; every entry is a deliberate,
// reviewable decision, unlike a loose substring rule.
const TEAM_ALIASES = {
  'man utd': 'manchester united', 'man united': 'manchester united', 'man u': 'manchester united',
  'man city': 'manchester city', 'spurs': 'tottenham hotspur', 'tottenham': 'tottenham hotspur',
  'wolves': 'wolverhampton wanderers', 'wolverhampton': 'wolverhampton wanderers',
  'psg': 'paris saint germain', 'paris sg': 'paris saint germain', 'newcastle': 'newcastle united',
  'west ham': 'west ham united', 'leeds': 'leeds united', 'brighton': 'brighton hove albion',
  'nottm forest': 'nottingham forest', 'nott m forest': 'nottingham forest',
  'inter': 'inter milan', 'internazionale': 'inter milan', 'ac milan': 'milan',
  'atletico madrid': 'atletico', 'atl madrid': 'atletico', 'athletic bilbao': 'athletic club',
  'bayern munchen': 'bayern munich', 'gladbach': 'borussia monchengladbach',
  'celta': 'celta vigo', 'leverkusen': 'bayer leverkusen', 'dortmund': 'borussia dortmund', 'sociedad': 'real sociedad',
  'betis': 'real betis', 'valladolid': 'real valladolid', 'alaves': 'deportivo alaves', 'rayo': 'rayo vallecano',
  'villarreal': 'villarreal', 'napoli': 'napoli', 'juventus': 'juventus', 'roma': 'as roma', 'lazio': 'lazio',
  'crystal palace': 'crystal palace', 'palace': 'crystal palace', 'villa': 'aston villa', 'fulham': 'fulham',
};
const TEAM_STOPWORDS = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'rcd', 'cd', 'ud', 'fk', 'sk', 'bk', 'ca', 'club', 'de', 'the']);
function teamTokens(name) {
  let t = String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (TEAM_ALIASES[t]) t = TEAM_ALIASES[t];
  return t.split(' ').filter(w => w && !TEAM_STOPWORDS.has(w)).map(w => (w === 'utd' ? 'united' : w));
}

function fuzzyMatch(a, b) {
  if (!a || !b) return false;
  if (squadTags(a) !== squadTags(b)) return false;
  // Strict word-level matching. The old "one name contains the other" rule is gone: it merged
  // "Inter" with "Inter Miami", "Newcastle" with "Newcastle Jets", "Leeds" with "Leeds Rhinos".
  // Now a shorter or longer spelling only matches through TEAM_ALIASES (a reviewed list), so a
  // real pair that fails to merge is fixed by adding one alias line.
  const ta = teamTokens(a), tb = teamTokens(b);
  if (!ta.length || ta.length !== tb.length) return false;
  // Each word pair: equal, or one is a >=3-letter prefix of the other ("Man" ~ "Manchester").
  return ta.every((w, i) => w === tb[i] || (Math.min(w.length, tb[i].length) >= 3 && (w.startsWith(tb[i]) || tb[i].startsWith(w))));
}

// ─── ALTERNATE TOTALS (opt-in, quota-capped) ─────────────────────────────────
// the-odds-api serves `alternate_totals` (extra Over/Under lines: 0.5, 1.5, 3.5 ...) ONLY through the
// per-event endpoint, one game per call, and every market x region costs credits. So this is OFF unless
// ALT_TOTALS_SPORTS lists the sport keys to enrich, e.g. ALT_TOTALS_SPORTS=soccer_epl,soccer_spain_la_liga
// Cost per fetched game = number of regions (2 with 'eu,uk'). Budget knobs (all optional env vars):
//   ALT_TOTALS_MAX_EVENTS       games enriched per sport per refresh (default 2)
//   ALT_TOTALS_WINDOW_HOURS     only games kicking off within this many hours (default 36)
//   ALT_TOTALS_MIN_REMAINING    skip entirely when the key's remaining credits are below this (default 300)
const ALT_TOTALS_TTL = 15 * 60 * 1000; // per-game cache; prices older than this are refetched
const altTotalsCache = {};             // eventId -> { ts, bookmakers: [{ key, last_update, outcomes }] }
let altDisabledUntil = 0;              // set when the API rejects the market, so we stop wasting credits

function altSportEnabled(sport) {
  const list = (process.env.ALT_TOTALS_SPORTS || '').split(',').map(x => x.trim()).filter(Boolean);
  return list.includes(sport);
}

async function fetchAltTotalsForEvent(sport, eventId, key) {
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/events/${eventId}/odds?apiKey=${key}&regions=${GLOBAL_REGIONS}&markets=alternate_totals&oddsFormat=decimal`;
  const response = await fetch(url);
  if (response.status === 422 || response.status === 400) { altDisabledUntil = Date.now() + 60 * 60 * 1000; return null; } // market not offered: back off 1h
  if (!response.ok) return null;
  const body = await response.json();
  const remaining = response.headers.get('x-requests-remaining');
  const bookmakers = [];
  for (const bm of (body.bookmakers || [])) {
    const mkt = (bm.markets || []).find(m => m.key === 'alternate_totals');
    if (mkt && (mkt.outcomes || []).length) bookmakers.push({ key: bm.key, last_update: mkt.last_update || bm.last_update, outcomes: mkt.outcomes });
  }
  return { bookmakers, remaining: remaining == null ? null : Number(remaining) };
}

// Adds an `alternate_totals` market to the bookmakers of the soonest kickoffs. Quotes that duplicate a line
// the book already gave in its main `totals` market are skipped, so nothing becomes "same line, two prices".
async function enrichWithAltTotals(sport, globalData, key, remainingNow) {
  if (!altSportEnabled(sport) || Date.now() < altDisabledUntil) return;
  const maxEvents = parseInt(process.env.ALT_TOTALS_MAX_EVENTS || '2', 10);
  const windowMs = parseFloat(process.env.ALT_TOTALS_WINDOW_HOURS || '36') * 3600 * 1000;
  const minRemaining = parseInt(process.env.ALT_TOTALS_MIN_REMAINING || '300', 10);
  const now = Date.now();
  const candidates = globalData
    .filter(ev => { const t = Date.parse(ev.commence_time); return t > now && t - now <= windowMs && (ev.bookmakers || []).length >= 2; })
    .sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time));

  let budgetOk = remainingNow == null || Number(remainingNow) >= minRemaining;
  let fetched = 0;
  const toFetch = [];
  for (const ev of candidates) {
    const c = altTotalsCache[ev.id];
    if (c && now - c.ts < ALT_TOTALS_TTL) continue;
    if (budgetOk && toFetch.length < maxEvents) toFetch.push(ev);
  }
  const results = await Promise.all(toFetch.map(async ev => {
    try { return [ev, await fetchAltTotalsForEvent(sport, ev.id, key)]; } catch { return [ev, null]; }
  }));
  for (const [ev, r] of results) {
    if (!r) continue;
    fetched++;
    altTotalsCache[ev.id] = { ts: Date.now(), bookmakers: r.bookmakers };
  }
  let attached = 0;
  for (const ev of candidates) {
    const c = altTotalsCache[ev.id];
    if (!c || Date.now() - c.ts >= ALT_TOTALS_TTL) continue;
    for (const alt of c.bookmakers) {
      const bm = (ev.bookmakers || []).find(b => b.key === alt.key);
      if (!bm) continue;
      const have = new Set();
      for (const m of (bm.markets || [])) if (m.key === 'totals') for (const o of (m.outcomes || [])) have.add(String(o.name).toLowerCase() + '|' + o.point);
      const outcomes = alt.outcomes.filter(o => !have.has(String(o.name).toLowerCase() + '|' + o.point));
      if (!outcomes.length) continue;
      bm.markets = (bm.markets || []).concat([{ key: 'alternate_totals', last_update: alt.last_update, outcomes }]);
      attached += outcomes.length;
    }
  }
  console.log(`[odds][alt_totals] ${sport}: candidates=${candidates.length} fetched=${fetched} outcomesAttached=${attached}${budgetOk ? '' : ' (skipped fetching: credits low)'}`);
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
        lastErrorDetail = body;
        console.log(`[odds] key ${keys.indexOf(key)+1} error body:`, lastError);
        continue;
      }
      if (!response.ok) {
        let body = null;
        try { body = await response.json(); } catch {}
        console.log(`[odds] key ${keys.indexOf(key)+1} status ${response.status} body:`, JSON.stringify(body));
        lastError = response.status;
        lastErrorDetail = body;
        continue;
      }

      // Success — capture global data and move on
      globalData = await response.json();
      remainingRequests = response.headers.get('x-requests-remaining');
      usedRequests      = response.headers.get('x-requests-used');
      keyIndex          = keys.indexOf(key) + 1;

      // Optional extra Over/Under lines for the soonest games (no-op unless ALT_TOTALS_SPORTS lists this sport)
      try { await enrichWithAltTotals(sport, globalData, key, remainingRequests); } catch (e) { console.log('[odds][alt_totals] skipped:', e.message); }

      // Tag non-WA bookmakers
      globalData.forEach(ev => {
        (ev.bookmakers || []).forEach(bm => { bm._wa = WA_BOOKS.includes(bm.key); });
      });

      globalOddsCache[cacheKey] = { data: globalData, remainingRequests, usedRequests, keyIndex, ts: Date.now() };
      break; // got data, stop trying keys
    } catch (err) {
      lastError = err.message;
      continue;
    }
  }

  return { globalData, remainingRequests, usedRequests, keyIndex, lastError, lastErrorDetail };
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const { sport, region, market } = req.query;

  // -- PAYWALL: must be logged in; free users only get FREE_SPORTS ----------
  const plan = await getUserPlan(req);
  if (!plan.user) return res.status(401).json({ error: 'login_required' });
  if (!plan.isOwner && !SCANNED_SPORTS.includes(sport)) {
    return res.status(403).json({ error: 'sport_not_available', sport });
  }
  if (!plan.isPremium && !FREE_SPORTS.includes(sport)) {
    return res.status(402).json({ error: 'premium_required', sport });
  }

  // ── Per-user rate limiting ───────────────────────────────────────────────
  // Owners are exempt — this guards against runaway clients/bots, not you
  // testing repeatedly during development.
  if (!plan.isOwner) {
    const now_ = Date.now();
    const userKey = plan.user.id;
    const bucket = rateLimitMap.get(userKey) || [];
    const recent = bucket.filter(ts => now_ - ts < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      return res.status(429).json({ error: 'rate_limited', retryAfterMs: RATE_LIMIT_WINDOW_MS - (now_ - recent[0]) });
    }
    recent.push(now_);
    rateLimitMap.set(userKey, recent);
  }

  const markets = market || 'h2h,spreads,totals';

  // ── Multi-key rotation (your existing logic, unchanged) ───────────────────
  const keys = [
    process.env.ODDS_API_KEY,
    process.env.ODDS_API_KEY_2,
    process.env.ODDS_API_KEY_3,
    process.env.ODDS_API_KEY_4,
    process.env.ODDS_API_KEY_5,
    process.env.ODDS_API_KEY_6,
    process.env.ODDS_API_KEY_8,
  ].filter(Boolean);

  console.log('[odds] keys loaded:', keys.map((k, i) => `KEY_${i+1}=${k ? k.slice(0,8)+'...' : 'MISSING'}`));
  console.log('[odds] requesting sport:', sport, 'regions:', GLOBAL_REGIONS, 'markets:', markets);

  let lastError = null;
  let lastErrorDetail = null;
  let globalData = null;
  let remainingRequests = null;
  let usedRequests = null;
  let keyIndex = null;
  let globalFromCache = false;

  // ── 0. Serve from cache if a recent fetch for this exact sport+markets exists ──
  const cacheKey = globalCacheKey(sport, markets);
  const cachedGlobal = globalOddsCache[cacheKey];
  if (cachedGlobal && Date.now() - cachedGlobal.ts < GLOBAL_CACHE_TTL) {
    globalData = cachedGlobal.data;
    remainingRequests = cachedGlobal.remainingRequests;
    usedRequests = cachedGlobal.usedRequests;
    keyIndex = cachedGlobal.keyIndex;
    globalFromCache = true;
    console.log('[odds] serving', sport, 'from cache, age:', Math.round((Date.now() - cachedGlobal.ts) / 1000) + 's');
  } else {
    // ── 1. Cache miss: join an in-flight fetch for this sport if one's already
    // running (another request beat us here by milliseconds), else start one. ──
    if (inFlightGlobal[cacheKey]) {
      console.log('[odds] joining in-flight fetch already running for', sport);
    } else {
      inFlightGlobal[cacheKey] = fetchGlobalOddsFresh(sport, markets, keys, cacheKey)
        .finally(() => { delete inFlightGlobal[cacheKey]; });
    }
    const result = await inFlightGlobal[cacheKey];
    globalData = result.globalData;
    remainingRequests = result.remainingRequests;
    usedRequests = result.usedRequests;
    keyIndex = result.keyIndex;
    lastError = result.lastError;
    lastErrorDetail = result.lastErrorDetail;
  }

  // ── 2. WA scrapers run regardless of whether global API succeeded ─────────
  const waResult = sport ? await getWAOdds(sport) : { events: [], health: waHealth, fromCache: false };
  const waEvents = waResult.events;
  const waBookHealth = waResult.health;

  // betway health is no longer a separate WA fetch — derive it from whether
  // the global the-odds-api result actually carried a 'betway' bookmaker.
  waBookHealth.betway = (globalData || []).some(ev => (ev.bookmakers || []).some(bm => bm.key === 'betway'))
    ? { ok: true, reason: null, fetchedAt: new Date().toISOString() }
    : { ok: false, reason: globalData ? 'not_in_global_feed_for_this_sport' : (lastError || 'global_fetch_failed'), fetchedAt: new Date().toISOString() };

  // ── 3. If global failed entirely, fall through to WA-only response ────────
  if (!globalData && waEvents.length === 0) {
    console.log('[odds] all keys failed, lastError:', lastError, 'detail:', JSON.stringify(lastErrorDetail));
    return res.status(429).json({
      error: 'All API keys exhausted. ' + lastError,
      detail: lastErrorDetail,
      sport, region, markets,
      waBookHealth,
    });
  }

  // ── 4. Merge global + WA events ───────────────────────────────────────────
  const merged = mergeEvents(globalData || [], waEvents);

  // ── 5. Annotate each event with region flags ──────────────────────────────
  merged.forEach(ev => {
    const books = ev.bookmakers || [];
    ev._hasGlobal = books.some(b => !b._wa);
    ev._hasWA     = books.some(b =>  b._wa);
  });

  console.log('[odds][merge]', sport, '-> globalEvents:', (globalData || []).length, '| waEvents in:', waEvents.length,
    '| merged total:', merged.length, '| merged events carrying a WA book:', merged.filter(ev => ev._hasWA).length);

  // ── 6. Respond ────────────────────────────────────────────────────────────
  // ── Detect user region from Vercel's geo header ───────────────────────────
  // x-vercel-ip-country is a 2-letter ISO code injected by Vercel on every request.
  // WA countries: Ghana (GH), Nigeria (NG), Senegal (SN), Ivory Coast (CI),
  // Cameroon (CM), Kenya (KE), Tanzania (TZ), Uganda (UG), Rwanda (RW), Zambia (ZM),
  // Ethiopia (ET), Mozambique (MZ), Sierra Leone (SL), Liberia (LR), Gambia (GM).
  const WA_COUNTRIES = new Set(['GH','NG','SN','CI','CM','KE','TZ','UG','RW','ZM','ET','MZ','SL','LR','GM','BJ','BF','ML','NE','GN','TG','MR','MW','ZW','AO','CD','CG','GA','TD','BI','DJ','ER','SO','SD','SS']);
  const userCountry = req.headers['x-vercel-ip-country'] || 'unknown';
  const isWAUser = WA_COUNTRIES.has(userCountry);

  // Books accessible to this user based on their detected region.
  // WA users: sportybet, betano, 1xbet, melbet, betway + new WA books
  // Global users: all books accessible (Betfair, Pinnacle, Bet365, William Hill etc.)
  const GLOBAL_ACCESSIBLE = ['pinnacle','betfair_ex_eu','betfair_ex_uk','singbet','sbobet','bet365','marathonbet','unibet_eu','williamhill','betway','1xbet','melbet','sportybet','betano','matchbook','paddypower','boylesports','casumo','nordicbet','betsson','betclic','draftkings','fanduel','pointsbetting','betonlineag','mybookieag'];
  const WA_ACCESSIBLE     = ['1xbet','melbet','betway','sportybet','betano','22bet','paripesa','betwinner','betking','bet9ja','1win','premierbet','betfox'];
  const userAccessibleBooks = isWAUser ? WA_ACCESSIBLE : GLOBAL_ACCESSIBLE;

  return res.status(200).json({
    data: merged,
    remainingRequests,
    usedRequests,
    keyIndex,
    globalFromCache,
    waBookHealth,
    userCountry,
    isWAUser,
    userAccessibleBooks,
    meta: {
      sport,
      totalEvents:  merged.length,
      globalEvents: (globalData || []).length,
      waEvents:     waEvents.length,
      sharpBooksGlobal: SHARP_BOOKS_GLOBAL,
      sharpBooksWA:     SHARP_BOOKS_WESTAFRICA,
      waBooks:          WA_BOOKS,
    },
  });
}

export { getWAOdds, waHealth };
