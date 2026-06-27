/**
 * scrapers/paripesa.js
 *
 * Paripesa runs on the BetConstruct platform (same engine as 22Bet, Betwinner,
 * and several other WA books). The frontend is a React SPA that fetches odds
 * via a REST JSON API.
 *
 * ENDPOINT DISCOVERY — do this once per book:
 *   1. Open https://paripesa.bet/gh/sports in Firefox DevTools → Network → XHR/Fetch
 *   2. Click "Football" in the left sidebar
 *   3. Find the XHR call that returns a list of matches with odds
 *   4. Copy the URL and update BASE + the url in fetchParipesaOdds() below
 *
 * LIKELY ENDPOINTS (BetConstruct standard — verify via DevTools):
 *
 *   Prematch events:
 *     GET https://paripesa.bet/api/v1/prematch/events
 *       ?sport_id={sportId}&competition_id={compId}&count=50&page=1&lang=en
 *
 *   Sports list (for finding sport IDs):
 *     GET https://paripesa.bet/api/v1/prematch/sports?lang=en
 *
 * ALTERNATIVE: Some BetConstruct books expose a GraphQL or WebSocket endpoint.
 *   If the above 404s, look for a /graphql or wss:// connection in DevTools.
 *
 * Until endpoints are confirmed, this returns empty + an unconfirmed status flag
 * so the app keeps working (falls back to manual entry in the UI).
 */

// ── Sport / competition ID map (BetConstruct standard IDs — same as 22bet.js) ──
// Competition IDs for Paripesa may differ slightly — cross-check via the
// /api/v1/prematch/competitions?sport_id=1 endpoint once BASE is confirmed.
const PARIPESA_SPORT_MAP = {
  soccer_epl:                   { sportId: 1,   competitionId: 118  },
  soccer_uefa_champs_league:    { sportId: 1,   competitionId: 4    },
  soccer_uefa_europa_league:    { sportId: 1,   competitionId: 5    },
  soccer_spain_la_liga:         { sportId: 1,   competitionId: 564  },
  soccer_germany_bundesliga:    { sportId: 1,   competitionId: 175  },
  soccer_italy_serie_a:         { sportId: 1,   competitionId: 262  },
  soccer_france_ligue_one:      { sportId: 1,   competitionId: 168  },
  soccer_ghana_premiership:     { sportId: 1,   competitionId: 2036 },
  soccer_africa_cup_of_nations: { sportId: 1,   competitionId: 328  },
  soccer_nigeria_npfl:          { sportId: 1,   competitionId: 424  }, // Nigeria Premier League — Paripesa covers this
  soccer_fifa_world_cup:        { sportId: 1,   competitionId: 23   },
  basketball_nba:               { sportId: 2,   competitionId: 199  },
  tennis_atp_wimbledon:         { sportId: 5,   competitionId: 1510 },
  mma_mixed_martial_arts:       { sportId: 36,  competitionId: null },

  // ── Cricket (BetConstruct sportId: 3) ───────────────────────────────────
  cricket_ipl:                  { sportId: 3, competitionId: 8016  },
  cricket_t20_world_cup:        { sportId: 3, competitionId: 9812  },
  cricket_icc_world_cup:        { sportId: 3, competitionId: 7341  },
  cricket_icc_trophy:           { sportId: 3, competitionId: 8974  },
  cricket_international_t20:    { sportId: 3, competitionId: null  },
  cricket_odi:                  { sportId: 3, competitionId: null  },
  cricket_test_match:           { sportId: 3, competitionId: null  },
  cricket_the_hundred:          { sportId: 3, competitionId: 9531  },
  cricket_big_bash:             { sportId: 3, competitionId: 3671  },
  cricket_psl:                  { sportId: 3, competitionId: 5748  },
  cricket_caribbean_premier_league: { sportId: 3, competitionId: 4123 },
  cricket_asia_cup:             { sportId: 3, competitionId: 6284  },
};

// ── Update this once you capture the actual domain from DevTools ──────────────
// Paripesa uses country-specific subdomains: paripesa.bet/gh/ or paripesa.com/en/
const BASE = 'https://paripesa.bet';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Origin': BASE,
  'Referer': BASE + '/gh/sports/football',
  // Some BetConstruct books require a site-id header — add if getting 401/403:
  // 'X-Site-Id': '1',
};

async function fetchParipesaOdds(sportKey) {
  const mapping = PARIPESA_SPORT_MAP[sportKey];
  if (!mapping) {
    return {
      events: [],
      status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() },
    };
  }

  const compPart = mapping.competitionId ? `&competition_id=${mapping.competitionId}` : '';
  const url = `${BASE}/api/v1/prematch/events?sport_id=${mapping.sportId}${compPart}&count=50&page=1&lang=en`;

  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      let body = '';
      try { body = (await res.text()).slice(0, 300); } catch {}
      console.warn('[Paripesa] fetch failed', res.status, 'for', sportKey, '| body:', body);
      if (res.status === 404) {
        console.warn('[Paripesa] ⚠ 404: verify endpoint via DevTools on paripesa.bet/gh/sports');
      }
      if (res.status === 403) {
        console.warn('[Paripesa] ⚠ 403: may need X-Site-Id header or different Origin — check DevTools');
      }
      return {
        events: [],
        status: {
          ok: false,
          reason: 'http_' + res.status + (res.status === 404 ? '_endpoint_unconfirmed' : ''),
          fetchedAt: new Date().toISOString(),
        },
      };
    }

    const json = await res.json();

    // BetConstruct response shapes (try all)
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

    const normalised = upcoming.map(ev => normaliseParipesaEvent(ev, sportKey)).filter(Boolean);
    console.log('[Paripesa]', sportKey, '→ raw:', rawEvents.length, '| upcoming:', upcoming.length, '| normalised:', normalised.length);

    return {
      events: normalised,
      status: { ok: true, reason: null, fetchedAt: new Date().toISOString() },
    };

  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    console.warn('[Paripesa] error for', sportKey, err.message);
    return {
      events: [],
      status: {
        ok: false,
        reason: isTimeout ? 'timeout' : err.message,
        fetchedAt: new Date().toISOString(),
      },
    };
  }
}

function parseStartTime(ev) {
  let ms = ev.start_ts || ev.startTime || ev.start_time || ev.date || ev.kickoff || null;
  if (!ms) return null;
  if (ms < 1e12) ms = ms * 1000;
  return ms;
}

function normaliseParipesaEvent(ev, sportKey) {
  try {
    const homeTeam =
      ev.team1_name || ev.home_team || ev.home?.name || ev.homeName || ev.team1 || 'Home';
    const awayTeam =
      ev.team2_name || ev.away_team || ev.away?.name || ev.awayName || ev.team2 || 'Away';

    const startMs = parseStartTime(ev);
    if (!startMs) return null;

    const h2hOutcomes = [];
    const totalsOutcomes = [];

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
      id: 'paripesa_' + (ev.id || ev.event_id || ev.match_id || Math.random()),
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: new Date(startMs).toISOString(),
      bookmakers: [{ key: 'paripesa', title: 'Paripesa', markets: normMarkets, _wa: true }],
    };
  } catch (err) {
    console.warn('[Paripesa] normalise error:', err.message);
    return null;
  }
}

module.exports = { fetchParipesaOdds };
