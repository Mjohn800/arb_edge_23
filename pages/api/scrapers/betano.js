/**
 * scrapers/betano.js
 * Fetches live odds from Betano Ghana's internal JSON API.
 * Normalised to The Odds API bookmaker format.
 *
 * Betano uses a REST API at api.betano.com.gh that their
 * web app calls — returns clean JSON, no scraping needed.
 */

const BETANO_SPORT_MAP = {
  soccer_epl:                   { sportId: 4, leagueId: 5 },
  soccer_uefa_champs_league:    { sportId: 4, leagueId: 3 },
  soccer_uefa_europa_league:    { sportId: 4, leagueId: 14 },
  soccer_spain_la_liga:         { sportId: 4, leagueId: 6 },
  soccer_germany_bundesliga:    { sportId: 4, leagueId: 7 },
  soccer_italy_serie_a:         { sportId: 4, leagueId: 8 },
  soccer_france_ligue_one:      { sportId: 4, leagueId: 9 },
  soccer_ghana_premiership:     { sportId: 4, leagueId: 557 },
  soccer_africa_cup_of_nations: { sportId: 4, leagueId: 422 },
  // TEMP 2026-06-21: leagueId unknown — was completely missing before, which is why
  // World Cup always returned 0 events with no error. Falling back to no filter
  // (same pattern already used for MMA below) queries all of sportId 4 broadly.
  // Find the real leagueId via the site's own network requests (browse to the World
  // Cup section on betano.com.gh, inspect the /api/sports/events/ request) and
  // replace this for a precise, smaller query.
  soccer_fifa_world_cup:        { sportId: 4, leagueId: null },
  basketball_nba:               { sportId: 2, leagueId: 132 },
  tennis_atp_wimbledon:         { sportId: 5, leagueId: 270 },
  mma_mixed_martial_arts:       { sportId: 23, leagueId: null },

  // ── Cricket (sportId: 3 on Betano) ───────────────────────────────────────
  // leagueId values: find via DevTools on betano.com.gh → browse to a cricket
  // competition → inspect the /api/sports/events/{sportId}/{leagueId}/ request.
  // IDs below are Betano's known values from network captures; verify if 404.
  cricket_ipl:                  { sportId: 3, leagueId: 8016  }, // IPL
  cricket_t20_world_cup:        { sportId: 3, leagueId: 9812  }, // Men's T20 World Cup
  cricket_icc_world_cup:        { sportId: 3, leagueId: 7341  }, // ODI World Cup
  cricket_icc_trophy:           { sportId: 3, leagueId: 8974  }, // Champions Trophy
  cricket_international_t20:    { sportId: 3, leagueId: null  }, // broad — all intl T20s
  cricket_odi:                  { sportId: 3, leagueId: null  }, // broad — all ODIs
  cricket_test_match:           { sportId: 3, leagueId: null  }, // broad — all Tests
  cricket_the_hundred:          { sportId: 3, leagueId: 9531  }, // The Hundred
  cricket_big_bash:             { sportId: 3, leagueId: 3671  }, // BBL
  cricket_psl:                  { sportId: 3, leagueId: 5748  }, // PSL
  cricket_caribbean_premier_league: { sportId: 3, leagueId: 4123 }, // CPL
  cricket_asia_cup:             { sportId: 3, leagueId: 6284  }, // Asia Cup
};

const BASE_URL = 'https://www.betano.com.gh/api/sports/events/';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'x-requested-with': 'XMLHttpRequest',
  'Referer': 'https://www.betano.com.gh/',
};

async function fetchBetanoOdds(sportKey) {
  const mapping = BETANO_SPORT_MAP[sportKey];
  if (!mapping) {
    return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };
  }

  try {
    const url = `${BASE_URL}${mapping.sportId}/${mapping.leagueId ? mapping.leagueId + '/' : ''}?bf=1&page=1`;
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      let bodyText = '';
      try { bodyText = (await res.text()).slice(0, 300); } catch {}
      console.warn('[Betano] HTTP', res.status, 'for', sportKey, '| body:', bodyText);
      return { events: [], status: { ok: false, reason: 'http_' + res.status + (bodyText ? ': ' + bodyText : ''), fetchedAt: new Date().toISOString() } };
    }

    const json = await res.json();
    // Betano wraps events under data.blocks[].events or data.events
    const blocks = json?.data?.blocks || [];
    const events = blocks.flatMap(b => b.events || []);
    const normalised = events.map(ev => normaliseEvent(ev, sportKey)).filter(Boolean);

    return { events: normalised, status: { ok: true, reason: null, fetchedAt: new Date().toISOString() } };
  } catch (err) {
    console.warn('[Betano] fetch error for', sportKey, err.message);
    return { events: [], status: { ok: false, reason: err.name === 'TimeoutError' ? 'timeout' : 'fetch_error: ' + err.message, fetchedAt: new Date().toISOString() } };
  }
}

function normaliseEvent(ev, sportKey) {
  try {
    const homeTeam = ev.homeParticipant?.name || ev.participants?.[0]?.name || 'Home';
    const awayTeam = ev.awayParticipant?.name  || ev.participants?.[1]?.name || 'Away';
    const commenceTime = ev.startTime
      ? new Date(ev.startTime).toISOString()
      : new Date().toISOString();

    const markets = [];
    const h2hOutcomes = [];
    const totalsOutcomes = [];

    for (const market of (ev.markets || [])) {
      const name = (market.name || '').toLowerCase();
      const isH2H    = name.includes('match winner') || name.includes('1x2') || name.includes('result');
      const isTotals = name.includes('total') || name.includes('over/under');

      for (const sel of (market.selections || [])) {
        const odds = parseFloat(sel.price || sel.odds);
        if (!odds || odds <= 1) continue;

        if (isH2H) {
          const outName = sel.name === '1' ? homeTeam
                        : sel.name === 'X' || sel.name?.toLowerCase() === 'draw' ? 'Draw'
                        : awayTeam;
          h2hOutcomes.push({ name: outName, price: odds });
        } else if (isTotals) {
          const isOver = (sel.name || '').toLowerCase().includes('over');
          totalsOutcomes.push({
            name: isOver ? 'Over' : 'Under',
            price: odds,
            point: parseFloat(sel.line || sel.handicap || 2.5),
          });
        }
      }
    }

    if (h2hOutcomes.length >= 2) markets.push({ key: 'h2h', outcomes: h2hOutcomes });
    if (totalsOutcomes.length >= 2) markets.push({ key: 'totals', outcomes: totalsOutcomes });
    if (markets.length === 0) return null;

    return {
      id: 'betano_' + ev.id,
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: commenceTime,
      bookmakers: [{
        key: 'betano',
        title: 'Betano',
        markets,
        _wa: true,
      }],
    };
  } catch {
    return null;
  }
}

module.exports = { fetchBetanoOdds };
