/**
 * scrapers/msport.js
 *
 * CONFIRMED ENDPOINTS (network capture 2026-06-22/23):
 *
 * Match list (POST, 200):
 *   POST /api/gh/facts-center/query/frontend/sports-matches-list?sportId=sr:sport:1
 *   Body: { tournamentIds: ['sr:tournament:16'], ... }
 *
 * Live matches (GET, 200):
 *   GET /api/gh/facts-center/query/frontend/live-matches?sportId=sr:sport:1
 *
 * Note: hyphenated "facts-center" (not camelCase like SportyBet)
 */

const MSPORT_SPORT_MAP = {
  soccer_epl:                   { sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:17',   keywords: ['premier league', 'english premier'] },
  soccer_uefa_champs_league:    { sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:7',    keywords: ['champions league'] },
  soccer_uefa_europa_league:    { sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:679',  keywords: ['europa league'] },
  soccer_spain_la_liga:         { sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:8',    keywords: ['la liga', 'laliga'] },
  soccer_germany_bundesliga:    { sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:35',   keywords: ['bundesliga'] },
  soccer_italy_serie_a:         { sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:23',   keywords: ['serie a'] },
  soccer_france_ligue_one:      { sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:34',   keywords: ['ligue 1', 'ligue one'] },
  soccer_ghana_premiership:     { sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:1436', keywords: ['ghana premier', 'gpl'] },
  soccer_africa_cup_of_nations: { sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:5765', keywords: ['afcon', 'africa cup'] },
  soccer_fifa_world_cup:        { sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:16',   keywords: ['world cup', 'fifa world', 'fifa w'] }, // ✓ confirmed
  basketball_nba:               { sportId: 'sr:sport:2',   tournamentId: 'sr:tournament:132',  keywords: ['nba'] },
  tennis_atp_wimbledon:         { sportId: 'sr:sport:5',   tournamentId: 'sr:tournament:270',  keywords: ['wimbledon'] },
  mma_mixed_martial_arts:       { sportId: 'sr:sport:117', tournamentId: null,                 keywords: [] },

  // ── Cricket (sr:sport:21) ────────────────────────────────────────────────
  cricket_ipl:                  { sportId: 'sr:sport:21',  tournamentId: 'sr:tournament:26638', keywords: ['ipl', 'indian premier'] },
  cricket_t20_world_cup:        { sportId: 'sr:sport:21',  tournamentId: 'sr:tournament:98732', keywords: ['t20 world cup', 't20wc'] },
  cricket_icc_world_cup:        { sportId: 'sr:sport:21',  tournamentId: 'sr:tournament:73476', keywords: ['world cup', 'icc world'] },
  cricket_icc_trophy:           { sportId: 'sr:sport:21',  tournamentId: 'sr:tournament:89765', keywords: ['champions trophy', 'icc trophy'] },
  cricket_international_t20:    { sportId: 'sr:sport:21',  tournamentId: null,                  keywords: ['t20i', 'twenty20 international', 't20 international'] },
  cricket_odi:                  { sportId: 'sr:sport:21',  tournamentId: null,                  keywords: ['odi', 'one day international'] },
  cricket_test_match:           { sportId: 'sr:sport:21',  tournamentId: null,                  keywords: ['test match', ' test ', 'test series'] },
  cricket_the_hundred:          { sportId: 'sr:sport:21',  tournamentId: 'sr:tournament:97531', keywords: ['hundred'] },
  cricket_big_bash:             { sportId: 'sr:sport:21',  tournamentId: 'sr:tournament:36716', keywords: ['big bash', 'bbl'] },
  cricket_psl:                  { sportId: 'sr:sport:21',  tournamentId: 'sr:tournament:57483', keywords: ['psl', 'pakistan super'] },
  cricket_caribbean_premier_league: { sportId: 'sr:sport:21', tournamentId: 'sr:tournament:41234', keywords: ['cpl', 'caribbean premier'] },
  cricket_asia_cup:             { sportId: 'sr:sport:21',  tournamentId: 'sr:tournament:62841', keywords: ['asia cup'] },
};

const BASE = 'https://www.msport.com/api/gh/facts-center/query/frontend';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Content-Type': 'application/json',
  'Origin': 'https://www.msport.com',
  'Referer': 'https://www.msport.com/gh/',
};

async function fetchMsportOdds(sportKey) {
  const mapping = MSPORT_SPORT_MAP[sportKey];
  if (!mapping) return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };

  try {
    // ── Step 1: POST to sports-matches-list ──────────────────────────────────
    // Send sportId only — adding tournamentId to the body causes bizCode 19999 (server error).
    // MSport filters client-side on their end; we keyword-filter here instead.
    const body = {
      pageNum: 1,
      pageSize: 100,
      matchStatus: 0,
    };

    const res = await fetch(`${BASE}/sports-matches-list?sportId=${mapping.sportId}`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      let bodyText = '';
      try { bodyText = (await res.text()).slice(0, 300); } catch {}
      console.warn('[MSport] sports-matches-list', res.status, 'for', sportKey, '| body:', bodyText);
      return { events: [], status: { ok: false, reason: 'http_' + res.status + ': ' + bodyText, fetchedAt: new Date().toISOString() } };
    }

    const json = await res.json();
    const allEvents = (
      json?.data?.list ||
      json?.data?.matchList ||
      json?.data?.events ||
      json?.data?.records ||
      (Array.isArray(json?.data) ? json.data : [])
    );

    const now = Date.now();
    const keywords = mapping.keywords || [];

    const upcoming = allEvents.filter(ev => {
      const ms = getStartMs(ev);
      if (ms && ms < now - 3 * 60 * 60 * 1000) return false; // exclude clearly past events
      if (!keywords.length) return true;
      const tName = (ev.tournamentName || ev.leagueName || ev.league?.name || ev.tournament?.name || ev.competitionName || '').toLowerCase();
      return keywords.some(kw => tName.includes(kw));
    });

    let normalised = upcoming.map(ev => normaliseEvent(ev, sportKey)).filter(Boolean);

    // If no odds inline, try fetching markets separately
    if (normalised.length === 0 && upcoming.length > 0) {
      const eventIds = upcoming
        .map(e => e.eventId || e.id || e.matchId)
        .filter(Boolean)
        .slice(0, 20)
        .join(',');

      if (eventIds) {
        try {
          const mktsRes = await fetch(
            `${BASE}/my-favourites/markets?sportId=${mapping.sportId}&eventIds=${eventIds}`,
            { headers: HEADERS, signal: AbortSignal.timeout(8000) }
          );
          if (mktsRes.ok) {
            const mktsJson = await mktsRes.json();
            const mktsMap = {};
            (mktsJson?.data || []).forEach(item => {
              const id = item.eventId || item.id;
              if (id) mktsMap[id] = item;
            });
            normalised = upcoming.map(ev => {
              const id = ev.eventId || ev.id || ev.matchId;
              return normaliseEvent({ ...ev, ...(mktsMap[id] || {}) }, sportKey);
            }).filter(Boolean);
          } else {
            console.warn('[MSport] markets fallback', mktsRes.status, 'for', sportKey);
          }
        } catch (err) {
          console.warn('[MSport] markets fallback error:', err.message);
        }
      }
    }

    console.log('[MSport]', sportKey, '→ total:', allEvents.length, '| upcoming:', upcoming.length, '| normalised:', normalised.length);
    return { events: normalised, status: { ok: true, reason: null, fetchedAt: new Date().toISOString() } };

  } catch (err) {
    console.warn('[MSport] error for', sportKey, err.message);
    return { events: [], status: { ok: false, reason: err.name === 'TimeoutError' ? 'timeout' : err.message, fetchedAt: new Date().toISOString() } };
  }
}

function getStartMs(ev) {
  if (ev.estimateStartTime) return ev.estimateStartTime;
  if (ev.startTime) return typeof ev.startTime === 'number' && ev.startTime < 1e12 ? ev.startTime * 1000 : ev.startTime;
  if (ev.matchTime) return ev.matchTime * 1000;
  if (ev.beginTime) return new Date(ev.beginTime).getTime();
  return null;
}

function normaliseEvent(ev, sportKey) {
  try {
    const homeTeam = ev.homeTeamName || ev.homeName || ev.home?.name || ev.homeTeam || 'Home';
    const awayTeam = ev.awayTeamName || ev.awayName || ev.away?.name || ev.awayTeam || 'Away';
    const startMs  = getStartMs(ev);
    if (!startMs) return null;

    const h2hOutcomes = [], totalsOutcomes = [];
    for (const market of (ev.markets || ev.oddsList || ev.marketList || ev.odds || [])) {
      const mId = String(market.marketType || market.marketId || market.id || '');
      for (const sel of (market.odds || market.outcomes || market.selections || [])) {
        const price = parseFloat(sel.odds || sel.price || sel.oddsValue);
        if (!price || price <= 1.0) continue;
        if (mId === '1' || mId === '1_1') {
          const nameMap = { '1': homeTeam, 'H': homeTeam, 'Home': homeTeam, 'X': 'Draw', 'D': 'Draw', 'Draw': 'Draw', '2': awayTeam, 'A': awayTeam, 'Away': awayTeam };
          const name = nameMap[sel.name] || nameMap[sel.oddName] || sel.name || sel.oddName;
          if (name) h2hOutcomes.push({ name, price });
        } else if (mId === '18' || mId === '18_1') {
          const raw = (sel.name || sel.oddName || '').toLowerCase();
          totalsOutcomes.push({ name: raw.includes('over') ? 'Over' : 'Under', price, point: parseFloat(sel.handicap || sel.line || sel.point || 2.5) });
        }
      }
    }
    const markets = [];
    if (h2hOutcomes.length >= 2) markets.push({ key: 'h2h', outcomes: h2hOutcomes });
    if (totalsOutcomes.length >= 2) markets.push({ key: 'totals', outcomes: totalsOutcomes });
    if (markets.length === 0) return null;

    return {
      id: 'msport_' + (ev.eventId || ev.id || ev.matchId),
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: new Date(startMs).toISOString(),
      bookmakers: [{ key: 'msport', title: 'MSport', markets, _wa: true }],
    };
  } catch { return null; }
}

module.exports = { fetchMsportOdds };
