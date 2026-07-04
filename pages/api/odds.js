import { fetchSportybetOdds } from './scrapers/sportybet';
import { fetchBetanoOdds }    from './scrapers/betano';
import { fetchMsportOdds }    from './scrapers/msport';
import { fetch22BetOdds }     from './scrapers/22bet';
import { fetchParipesaOdds }  from './scrapers/Paripesa';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
export const SHARP_BOOKS_GLOBAL     = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet'];
export const SHARP_BOOKS_WESTAFRICA = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet', '1xbet']; // same Pinnacle reference as global, output filtered to WA-accessible books client-side
export const WA_BOOKS               = ['sportybet', 'betano', 'msport', '22bet', 'paripesa', 'melbet', 'betway', 'onexbet'];

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
// betway has NO data source at all — not in this list, and no scraper exists for
// it (only sportybet/betano/msport are scraped). It's still flagged `accessible`
// in BOOKS (a WA bettor really can use it), but it will never appear in scan
// results until a scraper is added for it.
// betfair_ex_uk dropped as redundant with betfair_ex_eu (same exchange, same odds).
//
// Net effect: the ONLY real sources of WA-accessible book data now are the 3
// scrapers (sportybet, betano, msport). If those are unreliable (e.g. the
// Betano 403 seen on AFCON), the WA section will legitimately have nothing to
// show — that's a scraper problem, not a filtering bug in findBestOdds/findMiddles.

// ─── WA SCRAPER CACHE (in-memory, 3 min TTL) ─────────────────────────────────
const waCache = {};
const WA_CACHE_TTL = 3 * 60 * 1000;

// Tracks last known health per bookmaker, persists across requests in the
// same serverless instance (best-effort — resets on cold start).
const waHealth = {
  sportybet: { ok: null, reason: null, fetchedAt: null },
  betano:    { ok: null, reason: null, fetchedAt: null },
  msport:    { ok: null, reason: null, fetchedAt: null },
  '22bet':   { ok: null, reason: null, fetchedAt: null },
  paripesa:  { ok: null, reason: null, fetchedAt: null },
};

async function getWAOdds(sportKey) {
  const cached = waCache[sportKey];
  if (cached && Date.now() - cached.ts < WA_CACHE_TTL) {
    return { events: cached.data, health: cached.health, fromCache: true };
  }

  const [sportybet, betano, msport, twobet, paripesa] = await Promise.allSettled([
    fetchSportybetOdds(sportKey),
    fetchBetanoOdds(sportKey),
    fetchMsportOdds(sportKey),
    fetch22BetOdds(sportKey),
    fetchParipesaOdds(sportKey),
  ]);

  const extractStatus = (settled, fallbackReason) =>
    settled.status === 'fulfilled' && settled.value?.status
      ? settled.value.status
      : { ok: false, reason: fallbackReason, fetchedAt: new Date().toISOString() };

  waHealth.sportybet  = extractStatus(sportybet,  'promise_rejected: ' + (sportybet.reason?.message  || 'unknown'));
  waHealth.betano     = extractStatus(betano,     'promise_rejected: ' + (betano.reason?.message     || 'unknown'));
  waHealth.msport     = extractStatus(msport,     'promise_rejected: ' + (msport.reason?.message     || 'unknown'));
  waHealth['22bet']   = extractStatus(twobet,     'promise_rejected: ' + (twobet.reason?.message     || 'unknown'));
  waHealth.paripesa   = extractStatus(paripesa,   'promise_rejected: ' + (paripesa.reason?.message   || 'unknown'));

  const results = [
    ...(sportybet.status === 'fulfilled' ? sportybet.value?.events || [] : []),
    ...(betano.status    === 'fulfilled' ? betano.value?.events    || [] : []),
    ...(msport.status    === 'fulfilled' ? msport.value?.events    || [] : []),
    ...(twobet.status    === 'fulfilled' ? twobet.value?.events    || [] : []),
    ...(paripesa.status  === 'fulfilled' ? paripesa.value?.events  || [] : []),
  ];

  console.log('[odds][WA]', sportKey,
    '-> sportybet:', sportybet.status === 'fulfilled' ? (sportybet.value?.events?.length ?? 0) : 'failed: ' + sportybet.reason?.message,
    '| betano:',    betano.status    === 'fulfilled' ? (betano.value?.events?.length    ?? 0) : 'failed: ' + betano.reason?.message,
    '| msport:',    msport.status    === 'fulfilled' ? (msport.value?.events?.length    ?? 0) : 'failed: ' + msport.reason?.message,
    '| 22bet:',     twobet.status    === 'fulfilled' ? (twobet.value?.events?.length    ?? 0) : 'failed: ' + twobet.reason?.message,
    '| paripesa:',  paripesa.status  === 'fulfilled' ? (paripesa.value?.events?.length  ?? 0) : 'failed: ' + paripesa.reason?.message,
    '| total:', results.length);

  const health = { sportybet: waHealth.sportybet, betano: waHealth.betano, msport: waHealth.msport, '22bet': waHealth['22bet'], paripesa: waHealth.paripesa };
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

// ─── HANDLER ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const { sport, region, market } = req.query;
  const markets = market || 'h2h,spreads,totals';

  // ── Multi-key rotation (your existing logic, unchanged) ───────────────────
  const keys = [
    process.env.ODDS_API_KEY,
    process.env.ODDS_API_KEY_2,
    process.env.ODDS_API_KEY_3,
  ].filter(Boolean);

  console.log('[odds] keys loaded:', keys.map((k, i) => `KEY_${i+1}=${k ? k.slice(0,8)+'...' : 'MISSING'}`));
  console.log('[odds] requesting sport:', sport, 'regions:', GLOBAL_REGIONS, 'markets:', markets);

  let lastError = null;
  let lastErrorDetail = null;
  let globalData = null;
  let remainingRequests = null;
  let usedRequests = null;
  let keyIndex = null;

  // ── 1. Try each API key until one succeeds ────────────────────────────────
  for (const key of keys) {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${key}&regions=${GLOBAL_REGIONS}&markets=${markets}&oddsFormat=decimal`;
    try {
      const response = await fetch(url);
      console.log(`[odds] key ${keys.indexOf(key)+1} → status ${response.status}`);

      if (response.status === 429) {
        lastError = 'quota';
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

      // Tag non-WA bookmakers
      globalData.forEach(ev => {
        (ev.bookmakers || []).forEach(bm => { bm._wa = WA_BOOKS.includes(bm.key); });
      });

      // Diagnostic: log all unique bookmaker keys seen in this response
      const allKeys = [...new Set(globalData.flatMap(ev => (ev.bookmakers || []).map(b => b.key)))];
      const waKeysFound = allKeys.filter(k => WA_BOOKS.includes(k));
      console.log('[odds][keys]', sport, '-> all keys:', allKeys.join(', '));
      console.log('[odds][keys]', sport, '-> WA keys found:', waKeysFound.join(', ') || '(none)');

      break; // got data, stop trying keys
    } catch (err) {
      lastError = err.message;
      continue;
    }
  }

  // ── 2. WA scrapers run regardless of whether global API succeeded ─────────
  const waResult = sport ? await getWAOdds(sport) : { events: [], health: waHealth, fromCache: false };
  const waEvents = waResult.events;
  const waBookHealth = waResult.health;

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
  // WA users: sportybet, betano, msport, 1xbet, melbet, betway + new WA books
  // Global users: all books accessible (Betfair, Pinnacle, Bet365, William Hill etc.)
  const GLOBAL_ACCESSIBLE = ['pinnacle','betfair_ex_eu','betfair_ex_uk','singbet','sbobet','bet365','marathonbet','unibet_eu','williamhill','betway','1xbet','melbet','sportybet','betano','msport','matchbook','paddypower','boylesports','casumo','nordicbet','betsson','betclic','draftkings','fanduel','pointsbetting','betonlineag','mybookieag'];
  const WA_ACCESSIBLE     = ['1xbet','melbet','betway','sportybet','betano','msport','22bet','paripesa','betwinner','betking','bet9ja','1win','premierbet','mozzartbet'];
  const userAccessibleBooks = isWAUser ? WA_ACCESSIBLE : GLOBAL_ACCESSIBLE;

  return res.status(200).json({
    data: merged,
    remainingRequests,
    usedRequests,
    keyIndex,
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
