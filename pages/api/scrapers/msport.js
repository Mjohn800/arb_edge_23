/**
 * scrapers/msport.js
 * Fetches live odds from MSport Ghana's internal API.
 * Normalised to The Odds API bookmaker format.
 *
 * ENDPOINT HISTORY:
 * - /gh/api/product/match/list → DEAD (404 "Not Found" confirmed 2026-06-21)
 *
 * We try multiple candidate URL patterns in order, logging each attempt.
 * The first one that returns HTTP 200 is used and cached for the process lifetime.
 * This avoids needing another manual network-capture session just to find the new path.
 *
 * Candidate paths are ranked by likelihood based on common API versioning patterns.
 * Once we capture the real endpoint via network tools, replace CANDIDATES with just
 * that one URL and remove the probe logic.
 */

const CANDIDATES = [
  'https://www.msport.com/api/gh/product/match/list',         // gh moved after product
  'https://www.msport.com/gh/api/v2/product/match/list',      // versioned
  'https://www.msport.com/gh/api/product/v2/match/list',      // resource versioned
  'https://www.msport.com/api/product/match/list',            // no region prefix
  'https://www.msport.com/gh/api/match/list',                 // simplified path
  'https://www.msport.com/api/gh/match/list',                 // alt simplified
  'https://gh.msport.com/api/product/match/list',             // subdomain variant
];

// Keyword-based tournament filtering (same pattern as sportybet.js)
const MSPORT_SPORT_MAP = {
  soccer_epl:                   { sportId: 1, keywords: ['premier league', 'english premier'] },
  soccer_uefa_champs_league:    { sportId: 1, keywords: ['champions league'] },
  soccer_uefa_europa_league:    { sportId: 1, keywords: ['europa league'] },
  soccer_spain_la_liga:         { sportId: 1, keywords: ['la liga', 'laliga'] },
  soccer_germany_bundesliga:    { sportId: 1, keywords: ['bundesliga'] },
  soccer_italy_serie_a:         { sportId: 1, keywords: ['serie a'] },
  soccer_france_ligue_one:      { sportId: 1, keywords: ['ligue 1', 'ligue one'] },
  soccer_ghana_premiership:     { sportId: 1, keywords: ['ghana premier', 'gpl'] },
  soccer_africa_cup_of_nations: { sportId: 1, keywords: ['afcon', 'africa cup'] },
  soccer_fifa_world_cup:        { sportId: 1, keywords: ['world cup', 'fifa world'] },
  basketball_nba:               { sportId: 2, keywords: ['nba'] },
  tennis_atp_wimbledon:         { sportId: 5, keywords: ['wimbledon'] },
  mma_mixed_martial_arts:       { sportId: 30, keywords: [] },
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Content-Type': 'application/json',
  'Referer': 'https://www.msport.com/gh/',
  'Origin': 'https://www.msport.com',
};

// Cache the working URL across calls within the same process
let resolvedUrl = null;

async function probeForWorkingUrl(sportId) {
  for (const url of CANDIDATES) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ sportId, matchStatus: 1, pageNum: 1, pageSize: 5 }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        console.log('[MSport] working URL found:', url);
        return url;
      }
      console.log('[MSport] probe', url, '→', res.status);
    } catch (err) {
      console.log('[MSport] probe', url, '→ error:', err.message);
    }
  }
  return null;
}

async function fetchMsportOdds(sportKey) {
  const mapping = MSPORT_SPORT_MAP[sportKey];
  if (!mapping) {
    return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };
  }

  try {
    // Probe for a working URL if not yet resolved
    if (!resolvedUrl) {
      resolvedUrl = await probeForWorkingUrl(mapping.sportId);
    }

    if (!resolvedUrl) {
      console.warn('[MSport] all candidate URLs failed — endpoint may have moved. Please capture the real URL via network tools on msport.com/gh');
      return { events: [], status: { ok: false, reason: 'all_candidates_failed', fetchedAt: new Date().toISOString() } };
    }

    const body = {
      sportId: mapping.sportId,
      matchStatus: 1,
      pageNum: 1,
      pageSize: 50,
      marketType: [1, 18],
    };

    const res = await fetch(resolvedUrl, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      let bodyText = '';
      try { bodyText = (await res.text()).slice(0, 300); } catch {}
      console.warn('[MSport] HTTP', res.status, 'for', sportKey, '| body:', bodyText);
      // Reset resolved URL in case it expired
      if (res.status === 404) resolvedUrl = null;
      return { events: [], status: { ok: false, reason: 'http_' + res.status + ': ' + bodyText, fetchedAt: new Date().toISOString() } };
    }

    const json = await res.json();
    const allEvents = json?.data?.list || json?.data?.matchList || json?.data?.records || json?.data || [];

    const now = Date.now();
    const keywords = mapping.keywords;

    const filtered = allEvents.filter(ev => {
      // Only upcoming
      const startMs = ev.matchTime ? ev.matchTime * 1000 : ev.startTime ? new Date(ev.startTime).getTime() : 0;
      if (startMs && startMs < now) return false;

      if (!keywords || keywords.length === 0) return true;

      const tName = (
        ev.leagueName || ev.tournamentName || ev.league?.name ||
        ev.tournament?.name || ev.competitionName || ''
      ).toLowerCase();

      return keywords.some(kw => tName.includes(kw));
    });

    const normalised = filtered.map(ev => normaliseEvent(ev, sportKey)).filter(Boolean);
    console.log('[MSport]', sportKey, '→ total:', allEvents.length, '| filtered:', filtered.length, '| normalised:', normalised.length);

    return { events: normalised, status: { ok: true, reason: null, fetchedAt: new Date().toISOString() } };

  } catch (err) {
    console.warn('[MSport] fetch error for', sportKey, err.message);
    return { events: [], status: { ok: false, reason: err.name === 'TimeoutError' ? 'timeout' : 'fetch_error: ' + err.message, fetchedAt: new Date().toISOString() } };
  }
}

function normaliseEvent(ev, sportKey) {
  try {
    const homeTeam = ev.homeTeam || ev.homeName || ev.home?.name || ev.homeTeamName || 'Home';
    const awayTeam = ev.awayTeam || ev.awayName || ev.away?.name || ev.awayTeamName || 'Away';

    const startMs = ev.matchTime
      ? ev.matchTime * 1000
      : ev.startTime
      ? new Date(ev.startTime).getTime()
      : ev.estimateStartTime || null;

    if (!startMs) return null;
    const commenceTime = new Date(startMs).toISOString();

    const markets = [];
    const h2hOutcomes    = [];
    const totalsOutcomes = [];

    for (const market of (ev.markets || ev.oddsList || ev.marketList || [])) {
      const mId = market.marketType || market.marketId || market.id;

      for (const sel of (market.odds || market.outcomes || market.selections || [])) {
        const price = parseFloat(sel.odds || sel.price || sel.oddsValue);
        if (!price || price <= 1.0) continue;

        if (mId === 1 || mId === '1') {
          const nameMap = {
            '1': homeTeam, 'H': homeTeam, 'Home': homeTeam,
            'X': 'Draw',   'D': 'Draw',   'Draw': 'Draw',
            '2': awayTeam, 'A': awayTeam, 'Away': awayTeam,
          };
          const name = nameMap[sel.name] || nameMap[sel.oddName] || sel.name || sel.oddName;
          if (name) h2hOutcomes.push({ name, price });
        } else if (mId === 18 || mId === '18') {
          const raw = (sel.name || sel.oddName || '').toLowerCase();
          totalsOutcomes.push({
            name: raw.includes('over') ? 'Over' : 'Under',
            price,
            point: parseFloat(sel.handicap || sel.line || sel.point || 2.5),
          });
        }
      }
    }

    if (h2hOutcomes.length >= 2) markets.push({ key: 'h2h', outcomes: h2hOutcomes });
    if (totalsOutcomes.length >= 2) markets.push({ key: 'totals', outcomes: totalsOutcomes });
    if (markets.length === 0) return null;

    return {
      id: 'msport_' + (ev.matchId || ev.id || ev.eventId),
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: commenceTime,
      bookmakers: [{ key: 'msport', title: 'MSport', markets, _wa: true }],
    };
  } catch {
    return null;
  }
}

module.exports = { fetchMsportOdds };
