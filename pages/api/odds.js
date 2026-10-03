import { getUserPlan, FREE_SPORTS, SCANNED_SPORTS } from '../../lib/serverAuth';
import { fetchSportybetOdds } from './scrapers/sportybet';
import { fetchBetanoOdds }    from './scrapers/betano';
import { fetch22BetOdds }       from './scrapers/22bet';
import { fetchMelbetOdds }      from './scrapers/melbet';
import { fetchBetanoOddsPapi, fetch22BetOddsPapi } from '../../lib/oddspapi-wa';
import { cacheGet, cacheSet, checkRateLimit } from '../../lib/supabaseCache';
import { sendStructuralAlert } from '../../lib/alerts';

// Let a cold scan finish: OddsPapi calls are queued ~1.2s apart and several books run per sport.
// Max allowed depends on your Vercel plan; lower this number if the deploy complains.
export const config = { maxDuration: 60 };

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
export const SHARP_BOOKS_GLOBAL     = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet'];
export const SHARP_BOOKS_WESTAFRICA = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet', '1xbet']; // same Pinnacle reference as global, output filtered to WA-accessible books client-side
export const WA_BOOKS               = ['sportybet', 'betano', '22bet', 'melbet', 'betway', '1xbet'];

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
//
// 1 Oct 2026: globalOddsCache / waCache / rateLimitMap moved to a shared
// Supabase-backed cache (lib/supabaseCache.js) so they actually coordinate
// across Vercel's multiple warm instances under real concurrent traffic —
// in-memory objects were each instance's own private copy, so caching and
// rate-limiting silently stopped working as intended once traffic grew past
// what one instance could handle alone. deadKeys stays in-memory: it's
// checked once per the-odds-api key per request in a tight loop, and making
// that a network round-trip would add real latency for a low-stakes
// optimization (worst case without it: one extra wasted attempt at a key
// that's already dead, which the key-rotation loop already tolerates).

// Paripesa and Betfox were removed (2 Oct 2026): both returned HTTP 403 from Vercel and are no longer used.

// ─── WA SCRAPER CACHE (shared via Supabase, 3 min TTL) ───────────────────────
const WA_CACHE_TTL = 3 * 60 * 1000;
function waCacheKey(sportKey) { return `waodds:${sportKey}`; }

// Tracks last known health per bookmaker, persists across requests in the
// same serverless instance (best-effort — resets on cold start). Not moved
// to Supabase: it's informational/diagnostic only, never used for a
// correctness decision, so a per-instance approximation is fine.
const waHealth = {
  sportybet:  { ok: null, reason: null, fetchedAt: null },
  betano:     { ok: null, reason: null, fetchedAt: null },
  '22bet':    { ok: null, reason: null, fetchedAt: null },
  melbet:     { ok: null, reason: null, fetchedAt: null },
  // betway intentionally absent: no longer WA-scraped, see comment above getWAOdds.
};

// Tracks keys known to be exhausted/invalid on THIS warm serverless instance,
// so we don't waste a call re-trying a dead key on every single sport request
// within the same scan cycle. Resets on cold start. Stays in-memory on
// purpose — see the 1 Oct 2026 note near the top of this file.
const deadKeys = new Map(); // key -> timestamp it died
const DEAD_KEY_TTL = 5 * 60 * 1000;

// ── Per-user rate limiting (shared via Supabase) ─────────────────────────
// N requests per user per rolling window, now coordinated across every
// serverless instance instead of each one keeping its own private counter —
// a user hitting different instances on consecutive requests (the common
// case under real traffic) used to get a fresh limit on each one.
// IMPORTANT: this limits requests that MISS the shared cache (the ones that spend upstream quota), not
// every request. One scan makes one /api/odds call per selected sport (the default scan is 21, and a user
// can select well over 100), so counting every call would lock normal users out mid-scan. Cache hits cost
// almost nothing and are not limited. 60 uncached fetches/minute is far above a real scan's pace
// (~20-30/min) and still stops a script that hammers the route.
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;
function rateLimitKey(userId) { return `ratelimit:${userId}`; }

// Only these market sets are accepted. The cache key includes the market string, so letting callers pass
// anything would let a script create unlimited distinct cache entries and burn the-odds-api quota.
const ALLOWED_MARKETS = new Set(['h2h,spreads,totals', 'outrights', 'h2h', 'spreads', 'totals']);

// If every the-odds-api key reports quota exhausted, remember that for a couple of minutes so the next
// requests don't each loop through all keys again (the in-memory deadKeys map doesn't cross instances).
const GLOBAL_FAIL_TTL = 2 * 60 * 1000;
function globalFailKey(cacheKey) { return `globalfail:${cacheKey}`; }

// ─── GLOBAL ODDS-API CACHE (shared via Supabase, 5 min TTL) ──────────────────
// This is the fix for quota exhaustion: without it, EVERY incoming scan
// request re-fetches the-odds-api fresh, so usage scales 1:1 with traffic.
// With it, N users scanning the same sport within the same 5-minute window
// all share ONE the-odds-api call instead of N separate ones — and now that
// share holds across instances too, not just within one.
const GLOBAL_CACHE_TTL = 5 * 60 * 1000;
function globalCacheKey(sport, markets) { return `globalodds:${sport}::${markets}`; }

// Single-flight: if the cache is stale and several requests for the SAME
// sport land on THIS instance within the same few hundred ms, only the first
// actually loops through the-odds-api keys; the rest await that same promise.
// This remains in-memory/per-instance — a true cross-instance lock would need
// Postgres advisory locks or similar, which is more complexity than the
// payoff here: the Supabase cache above already means only the first
// instance to go stale pays for a fresh fetch, so the worst case under real
// traffic is "a small number of instances each fetch once", not "every
// request fetches independently" (the original, much worse problem).
const inFlightGlobal = {};

// Betano and 22Bet are geo/bot-blocked at ScraperAPI's free tier (see the
// pre-launch notes above), so try OddsPapi first — it's a clean JSON source
// with no proxy needed — and only fall back to the direct scraper if
// OddsPapi has no tournament mapped for this sport yet (ODDSPAPI_TOURNAMENT_MAP
// in lib/oddspapi-wa.js still has TODOs for most leagues).
// The paid ScraperAPI fallback is only worth its credits when OddsPapi FAILED or has no tournament
// mapped for this sport. If OddsPapi answered fine with zero events (no upcoming matches), asking
// the scraper too would just burn credits for the same empty answer.
function oddsPapiAnswered(papi) {
  if (!papi || !papi.status || !papi.status.ok) return false;
  const reason = papi.status.reason;
  return reason !== 'tournament_id_unknown' && reason !== 'unsupported_sport';
}

async function getBetanoOdds(sportKey) {
  const papi = await fetchBetanoOddsPapi(sportKey);
  if (oddsPapiAnswered(papi)) return papi;
  return fetchBetanoOdds(sportKey);
}

async function get22BetOdds(sportKey) {
  const papi = await fetch22BetOddsPapi(sportKey);
  if (oddsPapiAnswered(papi)) return papi;
  return fetch22BetOdds(sportKey);
}

async function getWAOdds(sportKey) {
  const cached = await cacheGet(waCacheKey(sportKey));
  if (cached) {
    return { events: cached.data, health: cached.health, fromCache: true };
  }

  const [sportybet, betano, twobet, melbet] = await Promise.allSettled([
    fetchSportybetOdds(sportKey),
    getBetanoOdds(sportKey),
    get22BetOdds(sportKey),
    fetchMelbetOdds(sportKey),
  ]);

  const extractStatus = (settled, fallbackReason) =>
    settled.status === 'fulfilled' && settled.value?.status
      ? settled.value.status
      : { ok: false, reason: fallbackReason, fetchedAt: new Date().toISOString() };

  waHealth.sportybet   = extractStatus(sportybet,   'promise_rejected: ' + (sportybet.reason?.message   || 'unknown'));
  waHealth.betano      = extractStatus(betano,      'promise_rejected: ' + (betano.reason?.message      || 'unknown'));
  waHealth['22bet']    = extractStatus(twobet,      'promise_rejected: ' + (twobet.reason?.message      || 'unknown'));
  waHealth.melbet      = extractStatus(melbet,      'promise_rejected: ' + (melbet.reason?.message      || 'unknown'));

  const results = [
    ...(sportybet.status   === 'fulfilled' ? sportybet.value?.events   || [] : []),
    ...(betano.status      === 'fulfilled' ? betano.value?.events      || [] : []),
    ...(twobet.status      === 'fulfilled' ? twobet.value?.events      || [] : []),
    ...(melbet.status      === 'fulfilled' ? melbet.value?.events      || [] : []),
  ];

  console.log('[odds][WA]', sportKey,
    '-> sportybet:',  sportybet.status   === 'fulfilled' ? (sportybet.value?.events?.length   ?? 0) : 'failed: ' + sportybet.reason?.message,
    '| betano:',      betano.status      === 'fulfilled' ? (betano.value?.events?.length      ?? 0) : 'failed: ' + betano.reason?.message,
    '| 22bet:',       twobet.status      === 'fulfilled' ? (twobet.value?.events?.length      ?? 0) : 'failed: ' + twobet.reason?.message,
    '| melbet:',      melbet.status      === 'fulfilled' ? (melbet.value?.events?.length      ?? 0) : 'failed: ' + melbet.reason?.message,
    '| total:', results.length);

  const health = {
    sportybet: waHealth.sportybet, betano: waHealth.betano,
    '22bet': waHealth['22bet'],
    melbet: waHealth.melbet,
    // betway health is reported from the global the-odds-api result instead (see handler).
  };
  await cacheSet(waCacheKey(sportKey), { data: results, health }, WA_CACHE_TTL);
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

      await cacheSet(cacheKey, { data: globalData, remainingRequests, usedRequests, keyIndex }, GLOBAL_CACHE_TTL);
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
  try {
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

    const markets = ALLOWED_MARKETS.has(market) ? market : 'h2h,spreads,totals';

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
    const cachedGlobal = await cacheGet(cacheKey);
    if (cachedGlobal) {
      globalData = cachedGlobal.data;
      remainingRequests = cachedGlobal.remainingRequests;
      usedRequests = cachedGlobal.usedRequests;
      keyIndex = cachedGlobal.keyIndex;
      globalFromCache = true;
      console.log('[odds] serving', sport, 'from shared cache');
    } else {
      // ── Per-user rate limit, applied only here: this request is about to spend upstream quota.
      // Owners are exempt. Atomic (one SQL statement) and fails open if Supabase is unavailable. ──
      if (!plan.isOwner) {
        const rl = await checkRateLimit(rateLimitKey(plan.user.id), RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SECONDS);
        if (!rl.allowed) {
          return res.status(429).json({ error: 'rate_limited', retryAfterMs: rl.retryAfterSeconds * 1000 });
        }
      }

      // ── 1. Cache miss. If every key was found exhausted moments ago (by any instance), don't loop
      // through them all again. Otherwise join an in-flight fetch for this sport on THIS instance, or
      // start one. ──
      const recentFail = await cacheGet(globalFailKey(cacheKey));
      if (recentFail) {
        lastError = recentFail.lastError;
        lastErrorDetail = recentFail.lastErrorDetail;
        console.log('[odds] skipping upstream for', sport, '- all keys recently exhausted');
      } else {
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

        if (!globalData && lastError === 'quota') {
          await cacheSet(globalFailKey(cacheKey), { lastError, lastErrorDetail }, GLOBAL_FAIL_TTL);
          // Tell the owner once (alerts.js applies a cooldown): this is the monthly-quota situation.
          await sendStructuralAlert('the-odds-api: every key is out of quota', `sport=${sport}. Global odds are unavailable until the quota resets or a new key is added.`);
        }
      }
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
      // Structural alert: every single odds source — global AND every WA book —
      // came back empty for a live user request. This is categorically
      // different from one bookmaker being down; it means a real user is
      // seeing a completely dead scan.
      await sendStructuralAlert(
        'All odds sources down for a live request',
        `sport=${sport} lastError=${lastError} detail=${JSON.stringify(lastErrorDetail)}`
      );
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
    const WA_ACCESSIBLE     = ['1xbet','melbet','betway','sportybet','betano','22bet','betwinner','betking','bet9ja','1win','premierbet'];
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
  } catch (err) {
    // Structural alert: an uncaught exception means a real bug, not just a
    // flaky upstream source — these should never happen silently.
    console.error('[odds] UNCAUGHT EXCEPTION:', err);
    await sendStructuralAlert('Uncaught exception in /api/odds', err.stack || err.message);
    return res.status(500).json({ error: 'internal_error' });
  }
}

export { getWAOdds, waHealth };
