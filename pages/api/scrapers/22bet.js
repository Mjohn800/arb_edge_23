/**
 * scrapers/22bet.js
 *
 * 22Bet uses a shared backend platform (BetConstruct/SoftConstruct family).
 * Endpoint discovery: open 22bet.gh in Firefox/Chrome DevTools → Network tab →
 * filter XHR/Fetch → navigate to a sport → look for requests to:
 *   /api/v1/prematch/events  or  /en/api/sports  or  /api/partner/...
 *
 * BEST GUESS ENDPOINTS (to verify via DevTools — see note below):
 *
 *   Prematch events + odds (most BetConstruct books):
 *     GET https://22bet.gh/api/v1/prematch/events
 *       ?sport_id={sportId}&competition_id={compId}&count=50&page=1
 *
 *   Sports list (find sport IDs):
 *     GET https://22bet.gh/api/v1/prematch/sports
 *
 * HOW TO CONFIRM:
 *   1. Open https://22bet.gh in Firefox DevTools → Network → XHR
 *   2. Click on "Football" in the left nav
 *   3. Look for a JSON request that returns a list of matches with odds
 *   4. Copy that URL pattern and update BASE + SPORT_MAP below
 *
 * Until confirmed, this scraper returns empty + logs a TODO so the
 * rest of the app keeps working (falls back to manual entry in the UI).
 */

// ── Sport ID map (BetConstruct platform standard IDs — verify against live network traffic) ──
const TWENTYTWOBET_SPORT_MAP = {
  soccer_epl:                   { sportId: 1,   competitionId: 118  }, // England Premier League
  soccer_uefa_champs_league:    { sportId: 1,   competitionId: 4    },
  soccer_uefa_europa_league:    { sportId: 1,   competitionId: 5    },
  soccer_spain_la_liga:         { sportId: 1,   competitionId: 564  },
  soccer_germany_bundesliga:    { sportId: 1,   competitionId: 175  },
  soccer_italy_serie_a:         { sportId: 1,   competitionId: 262  },
  soccer_france_ligue_one:      { sportId: 1,   competitionId: 168  },
  soccer_ghana_premiership:     { sportId: 1,   competitionId: 2036 },
  soccer_africa_cup_of_nations: { sportId: 1,   competitionId: 328  },
  soccer_fifa_world_cup:        { sportId: 1,   competitionId: 23   },
  basketball_nba:               { sportId: 2,   competitionId: 199  },
  tennis_atp_wimbledon:         { sportId: 5,   competitionId: 1510 },
  mma_mixed_martial_arts:       { sportId: 36,  competitionId: null }, // broad sport query
};

const BASE = 'https://22bet.gh';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Origin': BASE,
  'Referer': BASE + '/line/football',
};

async function fetch22BetOdds(sportKey) {
  const mapping = TWENTYTWOBET_SPORT_MAP[sportKey];
  if (!mapping) {
    return {
      events: [],
      status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() },
    };
  }

  // ── ENDPOINT TO VERIFY ────────────────────────────────────────────────────
  // Run the app, open DevTools on 22bet.gh, click a sport, capture the XHR.
  // Common BetConstruct patterns:
  //   /api/v1/prematch/events?sport_id=X&competition_id=Y
  //   /api/sports/prematch?sportId=X&lang=en
  //   /en/api/v2/competition/{compId}/events
  // Update the url below once confirmed.
  // ─────────────────────────────────────────────────────────────────────────
  const compPart = mapping.competitionId
    ? `&competition_id=${mapping.competitionId}`
    : '';
  const url = `${BASE}/api/v1/prematch/events?sport_id=${mapping.sportId}${compPart}&count=50&page=1&lang=en`;

  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      let body = '';
      try { body = (await res.text()).slice(0, 300); } catch {}
      console.warn('[22Bet] fetch failed', res.status, 'for', sportKey, '| body:', body);
      // 404 likely means endpoint path needs updating — log it clearly
      if (res.status === 404) {
        console.warn('[22Bet] ⚠ 404: endpoint path needs confirming via DevTools on 22bet.gh');
      }
      return {
        events: [],
        status: { ok: false, reason: 'http_' + res.status + (res.status === 404 ? '_endpoint_unconfirmed' : ''), fetchedAt: new Date().toISOString() },
      };
    }

    const json = await res.json();

    // BetConstruct APIs typically return one of:
    //   { data: { events: [...] } }
    //   { result: [...] }
    //   { events: [...] }
    //   [ ...array at root ]
    const rawEvents =
      json?.data?.events ||
      json?.data?.data ||
      json?.result ||
      json?.events ||
      (Array.isArray(json) ? json : []);

    const now = Date.now();
    const upcoming = rawEvents.filter(ev => {
      const ms = parseStartTime(ev);
      if (!ms) return true;
      return ms > now - 3 * 60 * 60 * 1000;
    });

    const normalised = upcoming.map(ev => normalise22BetEvent(ev, sportKey)).filter(Boolean);
    console.log('[22Bet]', sportKey, '→ raw:', rawEvents.length, '| upcoming:', upcoming.length, '| normalised:', normalised.length);

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

function parseStartTime(ev) {
  // BetConstruct events use various timestamp field names
  let ms = ev.start_ts || ev.startTime || ev.start_time || ev.date || ev.kickoff || null;
  if (!ms) return null;
  // Handle Unix seconds vs milliseconds
  if (ms < 1e12) ms = ms * 1000;
  return ms;
}

function normalise22BetEvent(ev, sportKey) {
  try {
    // Team names — BetConstruct uses team1/team2 or home/away
    const homeTeam =
      ev.team1_name || ev.home_team || ev.home?.name || ev.homeName || ev.team1 || 'Home';
    const awayTeam =
      ev.team2_name || ev.away_team || ev.away?.name || ev.awayName || ev.team2 || 'Away';

    const startMs = parseStartTime(ev);
    if (!startMs) return null;

    const h2hOutcomes = [];
    const totalsOutcomes = [];

    // BetConstruct odds are often nested under market.event[].price or market.outcomes[]
    const markets = ev.markets || ev.market || ev.odds || [];
    for (const mkt of (Array.isArray(markets) ? markets : Object.values(markets))) {
      const mktType = mkt.type || mkt.market_type || mkt.name || '';
      const isH2H = /^(1x2|match result|moneyline|1_1|full.time result)/i.test(String(mktType));
      const isTotals = /^(total|over.under|goals)/i.test(String(mktType));

      const outcomes = mkt.outcomes || mkt.selections || mkt.event || [];
      for (const o of (Array.isArray(outcomes) ? outcomes : Object.values(outcomes))) {
        const price = parseFloat(o.price || o.odds || o.odd || o.value || 0);
        if (!price || price <= 1.0) continue;

        if (isH2H) {
          // BetConstruct uses type_1/type_x/type_2 or name "1"/"X"/"2"
          const rawName = String(o.name || o.type || o.outcome || '');
          const name =
            rawName === '1' || rawName === 'type_1' ? homeTeam :
            rawName === 'X' || rawName === 'type_x' ? 'Draw' :
            rawName === '2' || rawName === 'type_2' ? awayTeam :
            rawName;
          if (name) h2hOutcomes.push({ name, price });
        } else if (isTotals) {
          const rawName = String(o.name || o.type || '').toLowerCase();
          const point = parseFloat(o.base || o.handicap || o.line || o.point || 2.5);
          totalsOutcomes.push({
            name: rawName.includes('over') || rawName === 'more' ? 'Over' : 'Under',
            price,
            point,
          });
        }
      }
    }

    const normMarkets = [];
    if (h2hOutcomes.length >= 2) normMarkets.push({ key: 'h2h', outcomes: h2hOutcomes });
    if (totalsOutcomes.length >= 2) normMarkets.push({ key: 'totals', outcomes: totalsOutcomes });
    if (normMarkets.length === 0) return null;

    return {
      id: '22bet_' + (ev.id || ev.event_id || ev.match_id || Math.random()),
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
