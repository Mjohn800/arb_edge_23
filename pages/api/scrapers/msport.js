/**
 * scrapers/msport.js
 * Fetches odds from MSport Ghana's internal API.
 * Normalised to The Odds API bookmaker format.
 *
 * CONFIRMED ENDPOINTS (captured via network tools 2026-06-22):
 *
 * Base: https://www.msport.com/api/gh/facts-center/query/frontend
 * Note: hyphenated "facts-center" (not "factsCenter" like SportyBet)
 *
 * Events list (upcoming prematch):
 *   GET /upcoming-matches?sportId=sr:sport:1&tournamentId={id}&pageSize=50&pageNum=1
 *
 * Live matches (also useful to exclude from arb scanning):
 *   GET /live-matches?sportId=sr:sport:1
 *
 * Markets for specific events:
 *   GET /my-favourites/markets?sportId=sr:sport:1&eventIds={id1,id2}
 *   or  /events/{eventId}/markets
 *
 * World Cup confirmed via page URL structure:
 *   /sports/Soccer/International_FIFA_World_Cup/...
 * Tournament IDs use Sportradar format: sr:tournament:16 etc.
 */

const MSPORT_SPORT_MAP = {
  soccer_epl:                   { sportId: 'sr:sport:1', tournamentId: 'sr:tournament:17'   },
  soccer_uefa_champs_league:    { sportId: 'sr:sport:1', tournamentId: 'sr:tournament:7'    },
  soccer_uefa_europa_league:    { sportId: 'sr:sport:1', tournamentId: 'sr:tournament:679'  },
  soccer_spain_la_liga:         { sportId: 'sr:sport:1', tournamentId: 'sr:tournament:8'    },
  soccer_germany_bundesliga:    { sportId: 'sr:sport:1', tournamentId: 'sr:tournament:35'   },
  soccer_italy_serie_a:         { sportId: 'sr:sport:1', tournamentId: 'sr:tournament:23'   },
  soccer_france_ligue_one:      { sportId: 'sr:sport:1', tournamentId: 'sr:tournament:34'   },
  soccer_ghana_premiership:     { sportId: 'sr:sport:1', tournamentId: 'sr:tournament:1436' },
  soccer_africa_cup_of_nations: { sportId: 'sr:sport:1', tournamentId: 'sr:tournament:5765' },
  soccer_fifa_world_cup:        { sportId: 'sr:sport:1', tournamentId: 'sr:tournament:16'   }, // ✓ confirmed
  basketball_nba:               { sportId: 'sr:sport:2', tournamentId: 'sr:tournament:132'  },
  tennis_atp_wimbledon:         { sportId: 'sr:sport:5', tournamentId: 'sr:tournament:270'  },
  mma_mixed_martial_arts:       { sportId: 'sr:sport:117', tournamentId: null               },
};

const BASE = 'https://www.msport.com/api/gh/facts-center/query/frontend';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Origin': 'https://www.msport.com',
  'Referer': 'https://www.msport.com/gh/',
};

async function fetchMsportOdds(sportKey) {
  const mapping = MSPORT_SPORT_MAP[sportKey];
  if (!mapping) {
    return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };
  }

  try {
    // ── Step 1: fetch upcoming events ────────────────────────────────────────
    const params = new URLSearchParams({
      sportId: mapping.sportId,
      ...(mapping.tournamentId ? { tournamentId: mapping.tournamentId } : {}),
      pageSize: '50',
      pageNum: '1',
    });

    const listUrl = `${BASE}/upcoming-matches?${params}`;
    const listRes = await fetch(listUrl, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
    });

    if (!listRes.ok) {
      let body = '';
      try { body = (await listRes.text()).slice(0, 300); } catch {}
      console.warn('[MSport] upcoming-matches', listRes.status, 'for', sportKey, '| body:', body);

      // Try alternate path if primary fails
      return await tryAlternatePath(sportKey, mapping);
    }

    const listJson = await listRes.json();
    const allEvents = (
      listJson?.data?.events ||
      listJson?.data?.list ||
      listJson?.data?.matchList ||
      listJson?.data ||
      []
    );

    // ── Step 2: normalise — odds may be inline or need separate fetch ─────────
    const now = Date.now();
    const upcoming = allEvents.filter(ev => {
      const ms = getStartMs(ev);
      return !ms || ms > now;
    });

    let normalised = upcoming.map(ev => normaliseEvent(ev, sportKey)).filter(Boolean);

    // If no odds inline, fetch markets separately
    if (normalised.length === 0 && upcoming.length > 0) {
      const eventIds = upcoming
        .map(e => e.eventId || e.id || e.matchId)
        .filter(Boolean)
        .slice(0, 20) // cap to avoid URL length issues
        .join(',');

      if (eventIds) {
        try {
          const mktsRes = await fetch(`${BASE}/my-favourites/markets?sportId=${mapping.sportId}&eventIds=${eventIds}`, {
            headers: HEADERS,
            signal: AbortSignal.timeout(8000),
          });
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
            console.warn('[MSport] markets fetch', mktsRes.status, 'for', sportKey);
          }
        } catch (err) {
          console.warn('[MSport] markets fetch error:', err.message);
        }
      }
    }

    console.log('[MSport]', sportKey, '→ total:', allEvents.length, '| upcoming:', upcoming.length, '| normalised:', normalised.length);
    return { events: normalised, status: { ok: true, reason: null, fetchedAt: new Date().toISOString() } };

  } catch (err) {
    console.warn('[MSport] fetch error for', sportKey, err.message);
    return { events: [], status: { ok: false, reason: err.name === 'TimeoutError' ? 'timeout' : 'fetch_error: ' + err.message, fetchedAt: new Date().toISOString() } };
  }
}

// Fallback: try the live-matches endpoint filtered by sport (for MMA / no tournament)
async function tryAlternatePath(sportKey, mapping) {
  try {
    const url = `${BASE}/live-matches?sportId=${mapping.sportId}&pageSize=50&pageNum=1`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      console.warn('[MSport] alternate path also failed for', sportKey, res.status);
      return { events: [], status: { ok: false, reason: 'http_' + res.status, fetchedAt: new Date().toISOString() } };
    }
    const json = await res.json();
    const events = json?.data?.events || json?.data?.list || [];
    const normalised = events.map(ev => normaliseEvent(ev, sportKey)).filter(Boolean);
    console.log('[MSport] alternate path', sportKey, '→', normalised.length, 'events');
    return { events: normalised, status: { ok: true, reason: 'used_alternate_path', fetchedAt: new Date().toISOString() } };
  } catch (err) {
    return { events: [], status: { ok: false, reason: 'alternate_path_error: ' + err.message, fetchedAt: new Date().toISOString() } };
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

    const startMs = getStartMs(ev);
    if (!startMs) return null;

    const h2hOutcomes    = [];
    const totalsOutcomes = [];

    const rawMarkets = ev.markets || ev.oddsList || ev.marketList || ev.odds || [];

    for (const market of rawMarkets) {
      const mId = String(market.marketType || market.marketId || market.id || '');

      for (const sel of (market.odds || market.outcomes || market.selections || [])) {
        const price = parseFloat(sel.odds || sel.price || sel.oddsValue);
        if (!price || price <= 1.0) continue;

        if (mId === '1' || mId === '1_1') {
          const nameMap = {
            '1': homeTeam, 'H': homeTeam, 'Home': homeTeam,
            'X': 'Draw',   'D': 'Draw',   'Draw': 'Draw',
            '2': awayTeam, 'A': awayTeam, 'Away': awayTeam,
          };
          const name = nameMap[sel.name] || nameMap[sel.oddName] || sel.name || sel.oddName;
          if (name) h2hOutcomes.push({ name, price });
        } else if (mId === '18' || mId === '18_1') {
          const raw = (sel.name || sel.oddName || '').toLowerCase();
          totalsOutcomes.push({
            name: raw.includes('over') ? 'Over' : 'Under',
            price,
            point: parseFloat(sel.handicap || sel.line || sel.point || 2.5),
          });
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
  } catch {
    return null;
  }
}

module.exports = { fetchMsportOdds };
