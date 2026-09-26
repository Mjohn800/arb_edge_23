/**
 * scrapers/22bet.js
 *
 * ✅ CONFIRMED via DevTools 5 Jul 2026:
 *
 * STEP 1 — list events for a league (does NOT reliably return odds/competitors):
 *   GET https://platform.22bet.com.gh/api/event/list
 *     ?period=0&status_in=0&limit=150&main=1
 *     &leagueId_in={leagueId}&oddsExists_eq=1&lang=en&_trlang=en_gh
 *
 * STEP 2 — fetch a single event by id (THIS is what returns real odds + competitors):
 *   GET https://platform.22bet.com.gh/api/event/list
 *     ?eventId_eq={eventId}&main=0
 *     &relations=league&relations=odds&relations=result&relations=withMarketsCount
 *     &relations=competitors&relations=sportCategories&relations=players
 *     &relations=broadcasts&relations=sport&relations=additionalInfo
 *     &relations=tips&relations=statistics&lang=en&_trlang=en_gh
 *
 * Response shape (both steps):
 *   { status: "ok", code: 200, data: { items: [ { id, time, competitor1Id,
 *     competitor2Id, competitors: [...], odds: [ { id, outcomes: [...] } ] } ] } }
 *
 * IMPORTANT: odds is an array of MARKET objects, not a flat array of outcomes.
 * Each market object looks like: { id, extendedSpecifiers, favourite, isVariant,
 *   marketMetadata, outcomes: [ { active, competitor, id, odds, player,
 *   playerVendorId, probabilities, team, type, vendorOutcomeId } ] }
 * We don't yet know the market's own "type"/name field (need to inspect a market
 * object at its top level, not just outcomes) — TODO once confirmed, use it to
 * distinguish 1X2 / totals / handicap / BTTS. Until then we infer from the
 * *outcome*-level `type` field the same way as before (1/2/3 = home/draw/away
 * for 1X2), and skip markets we can't classify.
 *
 * League IDs: visible in URL bar when browsing 22bet.com.gh
 *   e.g. /prematch?top=1&leagueIds=1008012 → World Cup = 1008012
 *
 * TODO (laptop): browse each league on 22bet.com.gh and read leagueIds from URL
 * TODO: inspect a full market object (not just its outcomes) to find the
 *       market-type/name field so totals/handicap/BTTS can be classified reliably.
 */

const TWENTYTWOBET_SPORT_MAP = {
  soccer_fifa_world_cup:            { leagueId: 1008012 }, // ✅ confirmed
  soccer_epl:                       { leagueId: 88637 }, // ✅ confirmed 16 Sep 2026
  soccer_uefa_champs_league:        { leagueId: 118587 }, // ✅ confirmed 16 Sep 2026
  soccer_uefa_europa_league:        { leagueId: 118593 }, // ✅ confirmed 16 Sep 2026
  soccer_spain_la_liga:             { leagueId: 127733 }, // ✅ confirmed 16 Sep 2026
  soccer_germany_bundesliga:        { leagueId: 96463 }, // ✅ confirmed 16 Sep 2026
  soccer_italy_serie_a:             { leagueId: null },
  soccer_france_ligue_one:          { leagueId: null },
  soccer_ghana_premiership:         { leagueId: null },
  soccer_africa_cup_of_nations:     { leagueId: null },
  basketball_nba:                   { leagueId: null },
  tennis_atp_wimbledon:             { leagueId: null },
  mma_mixed_martial_arts:           { leagueId: null },
  cricket_ipl:                      { leagueId: null },
  cricket_t20_world_cup:            { leagueId: null },
  cricket_international_t20:        { leagueId: null },
  cricket_the_hundred:              { leagueId: null },
  cricket_caribbean_premier_league: { leagueId: null },
};

const BASE = 'https://platform.22bet.com.gh';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Content-Type': 'application/json',
  'Client-Timezone': 'Africa/Accra',
  'Origin': 'https://22bet.com.gh',
  'Referer': 'https://22bet.com.gh/',
  'X-Requested-With': 'XMLHttpRequest',
  // Session cookies — ubc-code is a persistent device ID, sid is a session token.
  // If odds stop appearing, refresh these by visiting 22bet.com.gh in a browser
  // and copying the Cookie header from a network request (DevTools → Network → Headers).
  'Cookie': 'ubc-code=f37e211c-d4a8-490a-825c-64a9042763db; sid=80ad0e3d8021f22e77cb534252ffcbd',
};

// Outcome type IDs for 1X2 market
const TYPE_HOME = 1;
const TYPE_DRAW = 2;
const TYPE_AWAY = 3;

// How many per-event detail requests to run concurrently. Keep this modest —
// hammering the API in parallel is what triggers geo-block/rate-limit retries.
const EVENT_DETAIL_CONCURRENCY = 3;
// Small delay between batches so we don't look like a scraper hammering the API.
const BATCH_DELAY_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetch22BetOdds(sportKey) {
  const mapping = TWENTYTWOBET_SPORT_MAP[sportKey];
  if (!mapping || !mapping.leagueId) {
    return {
      events: [],
      status: { ok: true, reason: mapping ? 'league_id_unknown' : 'unsupported_sport', fetchedAt: new Date().toISOString() },
    };
  }

  try {
    // ---- STEP 1: list events in the league to get their ids ----
    const listUrl = `${BASE}/api/event/list?period=0&status_in=0&limit=150&main=1` +
      `&leagueId_in=${mapping.leagueId}&oddsExists_eq=1&lang=en&_trlang=en_gh`;

    let listRes;
    try {
      listRes = await fetch(listUrl, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    } catch (err) {
      console.warn('[22Bet] direct list fetch threw for', sportKey, '| err:', err.message, '— retrying via ScraperAPI...');
      listRes = null;
    }

    if (listRes && !listRes.ok) {
      console.warn('[22Bet] list fetch failed', listRes.status, 'for', sportKey, '— retrying via ScraperAPI...');
      listRes = null;
    }

    if (!listRes) {
      const scraperKey = process.env.SCRAPER_API_KEY;
      if (scraperKey) {
        const proxyUrl = `http://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(listUrl)}&country_code=gh&premium=true&ultra_premium=true`;
        try {
          listRes = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
        } catch (err) {
          console.warn('[22Bet] proxy list fetch also failed for', sportKey, '| err:', err.message);
          return { events: [], status: { ok: false, reason: 'fetch_error_both: ' + err.message, fetchedAt: new Date().toISOString() } };
        }
      } else {
        return { events: [], status: { ok: false, reason: 'fetch_failed_no_scraper_key', fetchedAt: new Date().toISOString() } };
      }
    }

    if (!listRes.ok) {
      let body = '';
      try { body = (await listRes.text()).slice(0, 300); } catch {}
      console.warn('[22Bet] list fetch failed even via proxy', listRes.status, 'for', sportKey, '| body:', body);
      return {
        events: [],
        status: { ok: false, reason: 'http_' + listRes.status, fetchedAt: new Date().toISOString() },
      };
    }

    const listJson = await listRes.json();
    const listItems = listJson?.data?.items;
    if (!Array.isArray(listItems)) {
      console.warn('[22Bet] unexpected list response shape for', sportKey, '| top keys:', Object.keys(listJson || {}).join(', '));
      return {
        events: [],
        status: { ok: false, reason: 'unexpected_shape', fetchedAt: new Date().toISOString() },
      };
    }

    const now = Date.now();
    // Include events starting up to 3h ago (may still be in play)
    const upcomingStubs = listItems.filter(ev => {
      if (!ev.time) return true;
      const ms = new Date(ev.time).getTime();
      return ms > now - 3 * 60 * 60 * 1000;
    });

    console.log('[22Bet]', sportKey, '→ list raw:', listItems.length, '| upcoming stubs:', upcomingStubs.length);

    // ---- STEP 2: fetch full detail (odds + competitors) per event id ----
    const detailed = [];
    for (let i = 0; i < upcomingStubs.length; i += EVENT_DETAIL_CONCURRENCY) {
      const batch = upcomingStubs.slice(i, i + EVENT_DETAIL_CONCURRENCY);
      const results = await Promise.all(batch.map(stub => fetch22BetEventDetail(stub.id)));
      for (const detail of results) {
        if (detail) detailed.push(detail);
      }
      if (i + EVENT_DETAIL_CONCURRENCY < upcomingStubs.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    if (detailed.length > 0) {
      const sample = detailed[0];
      console.log('[22Bet] sample detail keys:', Object.keys(sample).join(', '));
      console.log('[22Bet] sample odds (markets) count:', (sample.odds || []).length);
      console.log('[22Bet] sample competitors:', JSON.stringify(sample.competitors || []));

      // TEMP DIAGNOSTIC (25 Sep 2026) — remove once totals/AH market-type field
      // is confirmed and normalise22BetEvent() is updated to use it.
      // The old version of this log only dumped odds[0], which is virtually
      // guaranteed to be the 1X2 market again — no help identifying totals/AH.
      // This dumps every market's TOP-LEVEL fields (no outcomes, to keep it
      // short) so we can see what varies between market types, then the FULL
      // first market of each distinct outcome-count/shape we find, so we get
      // at least one real totals example and one real AH example verbatim.
      const markets = sample.odds || [];
      console.log('[22Bet][DIAG] market count for this event:', markets.length);
      markets.forEach((m, i) => {
        const outcomeTypes = (m.outcomes || []).map(o => o.type);
        const { outcomes, ...topLevel } = m; // strip outcomes so this line stays short
        console.log(`[22Bet][DIAG] market[${i}] top-level:`, JSON.stringify(topLevel),
          '| outcomeCount:', (m.outcomes || []).length, '| outcomeTypes:', JSON.stringify(outcomeTypes));
      });
      // Full dump (outcomes included) of up to 6 markets that do NOT look like
      // 1X2 (i.e. not exactly types {1,2,3}) — these are our totals/AH candidates.
      const nonH2H = markets.filter(m => {
        const t = (m.outcomes || []).map(o => o.type);
        return !(t.length === 3 && [TYPE_HOME, TYPE_DRAW, TYPE_AWAY].every(x => t.includes(x)));
      }).slice(0, 6);
      nonH2H.forEach((m, i) => console.log(`[22Bet][DIAG] non-1x2 market #${i} FULL:`, JSON.stringify(m)));
      if (nonH2H.length === 0) console.log('[22Bet][DIAG] no non-1x2 markets found on this event — try a different match/league.');
    }

    const normalised = detailed.map(ev => normalise22BetEvent(ev, sportKey)).filter(Boolean);
    console.log('[22Bet]', sportKey, '→ detailed:', detailed.length, '| normalised:', normalised.length);

    return {
      events: normalised,
      status: { ok: true, reason: null, fetchedAt: new Date().toISOString() },
    };

  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    console.warn('[22Bet] error for', sportKey, err.message);
    return {
      events: [],
      status: { ok: false, reason: isTimeout ? 'timeout' : err.message, fetchedAt: new Date().toISOString() },
    };
  }
}

// Fetch full detail for a single event id. Returns the raw item object
// (with odds/competitors populated) or null on failure.
//
// 22Bet doesn't signal the geo/session gate with a 403/429 like Betano does —
// it returns a normal 200 but silently omits the `odds`/`competitors`
// relations. So instead of branching on status code, we branch on whether
// the relations actually came back, and retry the SAME url via ScraperAPI
// (which routes the request through a Ghana IP) if they didn't.
async function fetch22BetEventDetail(eventId) {
  const url = `${BASE}/api/event/list?eventId_eq=${eventId}&main=0` +
    `&relations=league&relations=odds&relations=result&relations=withMarketsCount` +
    `&relations=competitors&relations=sportCategories&relations=players` +
    `&relations=broadcasts&relations=sport&relations=additionalInfo` +
    `&relations=tips&relations=statistics&lang=en&_trlang=en_gh`;

  let item = await fetch22BetDetailAttempt(url, eventId, { viaProxy: false });

  // Direct request "succeeded" but relations were stripped (empty odds AND
  // empty competitors) — retry via ScraperAPI as a Ghana-based request.
  const relationsMissing = item && (!Array.isArray(item.odds) || item.odds.length === 0)
    && (!Array.isArray(item.competitors) || item.competitors.length === 0);

  if (relationsMissing) {
    const scraperKey = process.env.SCRAPER_API_KEY;
    if (scraperKey) {
      console.log('[22Bet] relations stripped for event', eventId, '— retrying via ScraperAPI...');
      // NOTE: two separate ScraperAPI requirements stacked here —
      // 1) country_code=gh needs premium=true (residential proxies for country targeting)
      // 2) platform.22bet.com.gh's bot protection needs ultra_premium=true on top of that
      // Both flags combine credit costs — this is an expensive call per event, per run.
      const proxyUrl = `http://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(url)}&country_code=gh&premium=true&ultra_premium=true`;
      const proxied = await fetch22BetDetailAttempt(proxyUrl, eventId, { viaProxy: true });
      if (proxied) item = proxied;
    } else {
      console.warn('[22Bet] relations stripped for event', eventId, 'and no SCRAPER_API_KEY set');
    }
  }

  return item;
}

async function fetch22BetDetailAttempt(url, eventId, { viaProxy }) {
  try {
    const res = await fetch(url, {
      // ScraperAPI itself sets the outbound headers/cookies to the target,
      // so when going through the proxy we don't need to (and can't rely on
      // our own Cookie header being honoured anyway).
      headers: viaProxy ? undefined : HEADERS,
      signal: AbortSignal.timeout(viaProxy ? 20000 : 10000), // ScraperAPI adds latency
    });
    if (!res.ok) {
      let body = '';
      try { body = (await res.text()).slice(0, 300); } catch {}
      console.warn('[22Bet]', viaProxy ? 'proxy' : 'direct', 'detail fetch failed', res.status, 'for event', eventId, '| body:', body);
      return null;
    }
    const json = await res.json();
    const items = json?.data?.items;
    if (!Array.isArray(items) || items.length === 0) {
      console.warn('[22Bet]', viaProxy ? 'proxy' : 'direct', 'detail empty for event', eventId);
      return null;
    }
    return items[0];
  } catch (err) {
    console.warn('[22Bet]', viaProxy ? 'proxy' : 'direct', 'detail error for event', eventId, err.message);
    return null;
  }
}

function normalise22BetEvent(ev, sportKey) {
  try {
    // Team names come from the competitors relation
    // competitors is an array: [{ id, name, isHome }, ...]
    const competitors = ev.competitors || [];
    const homeComp = competitors.find(c => c.isHome === true || c.isHome === 1) || competitors[0];
    const awayComp = competitors.find(c => c.isHome === false || c.isHome === 0) || competitors[1];
    const homeTeam = homeComp?.name || ev.team1 || 'Home';
    const awayTeam = awayComp?.name || ev.team2 || 'Away';

    if (!ev.time) return null;
    const startMs = new Date(ev.time).getTime();
    if (!startMs || isNaN(startMs)) return null;

    // odds is an array of MARKET objects, each with its own `outcomes` array —
    // NOT a flat array of outcomes like the old (list-endpoint) response.
    const markets = ev.odds || [];
    if (!Array.isArray(markets) || markets.length === 0) return null;

    const h2hOutcomes = [];
    const totalsOutcomes = [];
    const ahOutcomes = [];
    const bttsOutcomes = [];

    for (const market of markets) {
      const outcomes = market.outcomes || [];
      if (!Array.isArray(outcomes) || outcomes.length === 0) continue;

      // TODO: once we confirm a market-level type/name field, switch on that
      // instead of guessing from outcome `type` values. For now: if the
      // outcome types are exactly {1,2,3} with no player/handicap info, treat
      // it as 1X2. Everything else is currently skipped rather than mis-tagged.
      const outcomeTypes = outcomes.map(o => o.type);
      const looksLike1x2 = outcomeTypes.length === 3 &&
        [TYPE_HOME, TYPE_DRAW, TYPE_AWAY].every(t => outcomeTypes.includes(t));

      if (looksLike1x2) {
        for (const o of outcomes) {
          if (!o.active) continue;
          const price = parseFloat(o.odds || 0);
          if (!price || price <= 1.0) continue;
          if (o.type === TYPE_HOME)      h2hOutcomes.push({ name: homeTeam, price });
          else if (o.type === TYPE_DRAW) h2hOutcomes.push({ name: 'Draw',   price });
          else if (o.type === TYPE_AWAY) h2hOutcomes.push({ name: awayTeam, price });
        }
      }
      // Totals/handicap/BTTS classification needs the market-level field —
      // left as TODO until we inspect one of those market objects directly.
    }

    const normMarkets = [];
    if (h2hOutcomes.length >= 2)    normMarkets.push({ key: 'h2h',     outcomes: h2hOutcomes });
    if (totalsOutcomes.length >= 2) normMarkets.push({ key: 'totals',  outcomes: totalsOutcomes });
    if (ahOutcomes.length >= 2)     normMarkets.push({ key: 'spreads', outcomes: ahOutcomes });
    if (bttsOutcomes.length >= 2)   normMarkets.push({ key: 'btts',    outcomes: bttsOutcomes });
    if (normMarkets.length === 0) return null;

    return {
      id: '22bet_' + ev.id,
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: new Date(startMs).toISOString(),
      bookmakers: [{ key: '22bet', title: '22Bet', markets: normMarkets, _wa: true }],
    };
  } catch (err) {
    console.warn('[22Bet] normalise error:', err.message);
    return null;
  }
}

module.exports = { fetch22BetOdds };
