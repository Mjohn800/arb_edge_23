/**
 * scrapers/sportybet.js
 * Fetches live odds from SportyBet Ghana's internal API.
 * Returns data normalised to The Odds API bookmaker format so
 * it can be merged directly into the odds feed without any
 * changes to findArbs / findEVBets / findMiddles.
 *
 * SportyBet exposes a JSON endpoint used by their own web app —
 * no browser automation needed, just a plain fetch.
 *
 * Supported sport map (SportyBet category ID → our sport key):
 *   sr:sport:1  → soccer
 *   sr:sport:2  → basketball
 *   sr:sport:5  → tennis
 *   sr:sport:21 → cricket
 *   sr:sport:117→ mma
 */

const SPORTYBET_SPORT_MAP = {
  soccer_epl:                    { id: 'sr:sport:1', tournamentId: '17' },
  soccer_uefa_champs_league:     { id: 'sr:sport:1', tournamentId: '7'  },
  soccer_uefa_europa_league:     { id: 'sr:sport:1', tournamentId: '679'},
  soccer_spain_la_liga:          { id: 'sr:sport:1', tournamentId: '8'  },
  soccer_germany_bundesliga:     { id: 'sr:sport:1', tournamentId: '35' },
  soccer_italy_serie_a:          { id: 'sr:sport:1', tournamentId: '23' },
  soccer_france_ligue_one:       { id: 'sr:sport:1', tournamentId: '34' },
  soccer_ghana_premiership:      { id: 'sr:sport:1', tournamentId: '1436'},
  soccer_africa_cup_of_nations:  { id: 'sr:sport:1', tournamentId: '5765'},
  // TEMP 2026-06-21: tournamentId unknown — was completely missing before, which is
  // why World Cup always returned 0 events with no error. Falling back to no filter
  // (same pattern already used for MMA below) queries all of sr:sport:1 broadly,
  // which should surface World Cup matches since it's the dominant event right now.
  // Find the real tournamentId via the site's own network requests (browse to the
  // World Cup section on sportybet.com/gh, inspect the publicEvents request) and
  // replace this for a precise, smaller query.
  soccer_fifa_world_cup:         { id: 'sr:sport:1', tournamentId: null },
  basketball_nba:                { id: 'sr:sport:2', tournamentId: '132'},
  tennis_atp_wimbledon:          { id: 'sr:sport:5', tournamentId: '270'},
  mma_mixed_martial_arts:        { id: 'sr:sport:117',tournamentId: null},
};

// SportyBet market IDs → our market keys
const MARKET_MAP = {
  '1_1': 'h2h',      // Match Winner (1x2)
  '1_2': 'h2h',      // Asian Handicap (treated as h2h for simplicity)
  '18_1': 'totals',  // Total Goals Over/Under
};

const BASE_URL = 'https://www.sportybet.com/api/gh/factsCenter/publicEvents';
const HEADERS  = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Origin': 'https://www.sportybet.com',
  'Referer': 'https://www.sportybet.com/gh/',
};

/**
 * Fetches events for a given sport key from SportyBet GH.
 * @param {string} sportKey  - our internal sport key e.g. 'soccer_epl'
 * @returns {{ events: Array, status: { ok: boolean, reason: string|null, fetchedAt: string } }}
 */
async function fetchSportybetOdds(sportKey) {
  const mapping = SPORTYBET_SPORT_MAP[sportKey];
  if (!mapping) {
    return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };
  }

  try {
    const params = new URLSearchParams({
      sportId: mapping.id,
      ...(mapping.tournamentId ? { tournamentId: mapping.tournamentId } : {}),
      marketId: '1_1,18_1',
      pageSize: '50',
      pageNum: '1',
    });

    const res = await fetch(`${BASE_URL}?${params}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      let bodyText = '';
      try { bodyText = (await res.text()).slice(0, 300); } catch {}
      console.warn('[SportyBet] HTTP', res.status, 'for', sportKey, '| body:', bodyText);
      return { events: [], status: { ok: false, reason: 'http_' + res.status + (bodyText ? ': ' + bodyText : ''), fetchedAt: new Date().toISOString() } };
    }

    const json = await res.json();
    const events = json?.data?.events || json?.data?.tournamentEvents || [];
    const normalised = events.map(ev => normaliseEvent(ev, sportKey)).filter(Boolean);

    return { events: normalised, status: { ok: true, reason: null, fetchedAt: new Date().toISOString() } };
  } catch (err) {
    console.warn('[SportyBet] fetch error for', sportKey, err.message);
    return { events: [], status: { ok: false, reason: err.name === 'TimeoutError' ? 'timeout' : 'fetch_error: ' + err.message, fetchedAt: new Date().toISOString() } };
  }
}

function normaliseEvent(ev, sportKey) {
  try {
    const homeTeam = ev.homeTeamName || ev.home?.name || 'Home';
    const awayTeam = ev.awayTeamName || ev.away?.name  || 'Away';
    const commenceTime = ev.estimateStartTime
      ? new Date(ev.estimateStartTime).toISOString()
      : new Date(ev.startTime * 1000).toISOString();

    // Build markets
    const markets = [];
    const h2hOutcomes = [];
    const totalsOutcomes = [];

    for (const market of (ev.markets || ev.odds || [])) {
      const marketKey = MARKET_MAP[market.id] || MARKET_MAP[market.marketId];
      if (!marketKey) continue;

      for (const outcome of (market.outcomes || market.selections || [])) {
        const odds = parseFloat(outcome.odds || outcome.price);
        if (!odds || odds <= 1) continue;

        if (marketKey === 'h2h') {
          // SportyBet outcome names: '1' = home, 'X' = draw, '2' = away
          const name = outcome.name === '1' ? homeTeam
                     : outcome.name === 'X' ? 'Draw'
                     : awayTeam;
          h2hOutcomes.push({ name, price: odds });
        } else if (marketKey === 'totals') {
          const name = outcome.name?.toLowerCase().includes('over') ? 'Over' : 'Under';
          totalsOutcomes.push({ name, price: odds, point: parseFloat(outcome.handicap || outcome.line || 2.5) });
        }
      }
    }

    if (h2hOutcomes.length >= 2) markets.push({ key: 'h2h', outcomes: h2hOutcomes });
    if (totalsOutcomes.length >= 2) markets.push({ key: 'totals', outcomes: totalsOutcomes });
    if (markets.length === 0) return null;

    return {
      id: 'sportybet_' + (ev.eventId || ev.id),
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: commenceTime,
      // Injected as a bookmaker entry so existing findArbs/findEVBets work unchanged
      bookmakers: [{
        key: 'sportybet',
        title: 'SportyBet',
        markets,
        _wa: true, // West Africa flag
      }],
    };
  } catch {
    return null;
  }
}

module.exports = { fetchSportybetOdds };
