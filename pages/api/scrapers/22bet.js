/**
 * scrapers/22bet.js
 *
 * ✅ CONFIRMED via DevTools 5 Jul 2026:
 * Correct endpoint: GET https://platform.22bet.com.gh/api/event/list
 *   ?period=0&status_in=0&limit=150&main=1
 *   &relations=odds&relations=competitors&relations=league
 *   &leagueId_in={leagueId}&oddsExists_eq=1&lang=en&_trlang=en_gh
 *
 * Response shape:
 *   { status: "ok", code: 200, data: { items: [ { id, time, competitor1Id,
 *     competitor2Id, competitors: [...], odds: [...] } ] } }
 *
 * Odds outcomes: { id, odds, type, active }
 *   type 1 = Home, type 2 = Draw, type 3 = Away (1X2 market)
 *   type varies for other markets — use marketType field on odds object
 *
 * League IDs: visible in URL bar when browsing 22bet.com.gh
 *   e.g. /prematch?top=1&leagueIds=1008012 → World Cup = 1008012
 *
 * TODO (laptop): browse each league on 22bet.com.gh and read leagueIds from URL
 */

const TWENTYTWOBET_SPORT_MAP = {
  soccer_fifa_world_cup:            { leagueId: 1008012 }, // ✅ confirmed
  soccer_epl:                       { leagueId: null },
  soccer_uefa_champs_league:        { leagueId: null },
  soccer_uefa_europa_league:        { leagueId: null },
  soccer_spain_la_liga:             { leagueId: null },
  soccer_germany_bundesliga:        { leagueId: null },
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
  'Origin': 'https://22bet.com.gh',
  'Referer': 'https://22bet.com.gh/',
  'X-Requested-With': 'XMLHttpRequest',
};

// Outcome type IDs for 1X2 market
const TYPE_HOME = 1;
const TYPE_DRAW = 2;
const TYPE_AWAY = 3;

// Market type IDs seen on 22Bet platform
// These will be confirmed/expanded as more responses are inspected
const MARKET_1X2      = 1;   // Match Winner (1X2)
const MARKET_TOTALS   = 2;   // Over/Under goals
const MARKET_HANDICAP = 3;   // Asian Handicap
const MARKET_BTTS     = 29;  // Both Teams to Score (GG/NG)

async function fetch22BetOdds(sportKey) {
  const mapping = TWENTYTWOBET_SPORT_MAP[sportKey];
  if (!mapping || !mapping.leagueId) {
    return {
      events: [],
      status: { ok: true, reason: mapping ? 'league_id_unknown' : 'unsupported_sport', fetchedAt: new Date().toISOString() },
    };
  }

  // Use /api/event/list with relations=odds&relations=competitors to get
  // team names and odds in a single request
  const url = `${BASE}/api/event/list?period=0&status_in=0&limit=150&main=1` +
    `&relations=odds&relations=competitors` +
    `&leagueId_in=${mapping.leagueId}&oddsExists_eq=1&lang=en&_trlang=en_gh`;

  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      let body = '';
      try { body = (await res.text()).slice(0, 300); } catch {}
      console.warn('[22Bet] fetch failed', res.status, 'for', sportKey, '| body:', body);
      return {
        events: [],
        status: { ok: false, reason: 'http_' + res.status, fetchedAt: new Date().toISOString() },
      };
    }

    const json = await res.json();

    // Response: { status: "ok", code: 200, data: { items: [...] } }
    const items = json?.data?.items;
    if (!Array.isArray(items)) {
      console.warn('[22Bet] unexpected response shape for', sportKey, '| top keys:', Object.keys(json || {}).join(', '));
      return {
        events: [],
        status: { ok: false, reason: 'unexpected_shape', fetchedAt: new Date().toISOString() },
      };
    }

    console.log('[22Bet]', sportKey, '→ items:', items.length);

    const now = Date.now();
    // Include events starting up to 3h ago (may still be in play)
    const upcoming = items.filter(ev => {
      if (!ev.time) return true;
      const ms = new Date(ev.time).getTime();
      return ms > now - 3 * 60 * 60 * 1000;
    });

    const normalised = upcoming.map(ev => normalise22BetEvent(ev, sportKey)).filter(Boolean);
    console.log('[22Bet]', sportKey, '→ upcoming:', upcoming.length, '| normalised:', normalised.length);

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

    // Odds come as a flat array of outcome objects
    // Each outcome has: { id, odds, type, active, marketType (or similar) }
    const oddsArr = ev.odds || [];
    if (!Array.isArray(oddsArr) || oddsArr.length === 0) return null;

    // Log first outcome structure on first call to confirm field names
    if (oddsArr.length > 0 && Math.random() < 0.3) {
      console.log('[22Bet] sample outcome:', JSON.stringify(oddsArr[0]));
    }

    const h2hOutcomes = [];
    const totalsOutcomes = [];
    const ahOutcomes = [];
    const bttsOutcomes = [];

    for (const o of oddsArr) {
      if (!o.active || o.active === 0) continue;
      const price = parseFloat(o.odds || o.odd || o.value || 0);
      if (!price || price <= 1.0) continue;

      const outcomeType = o.type ?? o.outcomeType ?? o.typeId ?? null;
      const marketType  = o.marketType ?? o.market_type ?? o.marketTypeId ?? null;

      // 1X2 outcomes — marketType 1 or outcomeType 1/2/3
      if (marketType === MARKET_1X2 || (!marketType && [TYPE_HOME, TYPE_DRAW, TYPE_AWAY].includes(outcomeType))) {
        if (outcomeType === TYPE_HOME)      h2hOutcomes.push({ name: homeTeam, price });
        else if (outcomeType === TYPE_DRAW) h2hOutcomes.push({ name: 'Draw',   price });
        else if (outcomeType === TYPE_AWAY) h2hOutcomes.push({ name: awayTeam, price });
      }
      // Totals (Over/Under)
      else if (marketType === MARKET_TOTALS) {
        const point = parseFloat(o.base ?? o.line ?? o.handicap ?? 2.5);
        const isOver = outcomeType === 12 || (o.name || '').toLowerCase().includes('over');
        totalsOutcomes.push({ name: isOver ? 'Over' : 'Under', price, point });
      }
      // Handicap
      else if (marketType === MARKET_HANDICAP) {
        const point = parseFloat(o.base ?? o.line ?? o.handicap ?? 0);
        const isHome = outcomeType === TYPE_HOME;
        ahOutcomes.push({ name: isHome ? homeTeam : awayTeam, price, point });
      }
      // BTTS
      else if (marketType === MARKET_BTTS) {
        bttsOutcomes.push({ name: outcomeType === 74 ? 'Yes' : 'No', price });
      }
    }

    const normMarkets = [];
    if (h2hOutcomes.length >= 2)   normMarkets.push({ key: 'h2h',     outcomes: h2hOutcomes });
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
