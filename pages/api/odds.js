import { fetchSportybetOdds } from './scrapers/sportybet';
import { fetchBetanoOdds }    from './scrapers/betano';
import { fetchMsportOdds }    from './scrapers/msport';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
export const SHARP_BOOKS_GLOBAL     = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet'];
export const SHARP_BOOKS_WESTAFRICA = ['1xbet', 'singbet', 'sbobet'];
export const WA_BOOKS               = ['sportybet', 'betano', 'msport', 'melbet', 'betway'];

// Real Odds-API bookmaker keys we actually compare for the GLOBAL feed.
// Specifying these by name instead of `regions=eu,uk` costs 1 credit per scan
// (up to 10 bookmakers = 1 credit) instead of 2 credits for two regions —
// roughly half the quota burn, since none of the other EU/UK books in those
// regions are used anywhere in the app anyway.
const GLOBAL_BOOKMAKERS = [
  'pinnacle',
  'betfair_ex_eu',
  'singbet',
  'sbobet',
  'bet365',
  'marathonbet',
  'unibet_eu',
  'williamhill',
  '1xbet',
  'melbet',
].join(',');
// Note: betway is requested separately or added back here if you drop one of
// the above — currently at exactly 10 to stay within the 1-credit tier.
// betfair_ex_uk dropped as redundant with betfair_ex_eu (same exchange, same odds).

// ─── WA SCRAPER CACHE (in-memory, 3 min TTL) ─────────────────────────────────
const waCache = {};
const WA_CACHE_TTL = 3 * 60 * 1000;

// Tracks last known health per bookmaker, persists across requests in the
// same serverless instance (best-effort — resets on cold start).
const waHealth = {
  sportybet: { ok: null, reason: null, fetchedAt: null },
  betano:    { ok: null, reason: null, fetchedAt: null },
  msport:    { ok: null, reason: null, fetchedAt: null },
};

async function getWAOdds(sportKey) {
  const cached = waCache[sportKey];
  if (cached && Date.now() - cached.ts < WA_CACHE_TTL) {
    return { events: cached.data, health: cached.health, fromCache: true };
  }

  const [sportybet, betano, msport] = await Promise.allSettled([
    fetchSportybetOdds(sportKey),
    fetchBetanoOdds(sportKey),
    fetchMsportOdds(sportKey),
  ]);

  // Update health tracker for each book regardless of cache
  const extractStatus = (settled, fallbackReason) =>
    settled.status === 'fulfilled' && settled.value?.status
      ? settled.value.status
      : { ok: false, reason: fallbackReason, fetchedAt: new Date().toISOString() };

  waHealth.sportybet = extractStatus(sportybet, 'promise_rejected: ' + (sportybet.reason?.message || 'unknown'));
  waHealth.betano    = extractStatus(betano,    'promise_rejected: ' + (betano.reason?.message    || 'unknown'));
  waHealth.msport    = extractStatus(msport,    'promise_rejected: ' + (msport.reason?.message    || 'unknown'));

  const results = [
    ...(sportybet.status === 'fulfilled' ? sportybet.value?.events || [] : []),
    ...(betano.status    === 'fulfilled' ? betano.value?.events    || [] : []),
    ...(msport.status    === 'fulfilled' ? msport.value?.events    || [] : []),
  ];

  const health = { sportybet: waHealth.sportybet, betano: waHealth.betano, msport: waHealth.msport };
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
  console.log('[odds] requesting sport:', sport, 'bookmakers:', GLOBAL_BOOKMAKERS, 'markets:', markets);

  let lastError = null;
  let lastErrorDetail = null;
  let globalData = null;
  let remainingRequests = null;
  let usedRequests = null;
  let keyIndex = null;

  // ── 1. Try each API key until one succeeds ────────────────────────────────
  for (const key of keys) {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${key}&bookmakers=${GLOBAL_BOOKMAKERS}&markets=${markets}&oddsFormat=decimal`;
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

  // ── 6. Respond ────────────────────────────────────────────────────────────
  return res.status(200).json({
    data: merged,
    remainingRequests,
    usedRequests,
    keyIndex,
    waBookHealth,
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
