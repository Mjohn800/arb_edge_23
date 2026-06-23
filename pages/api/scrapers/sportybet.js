/**
 * scrapers/sportybet.js
 *
 * CONFIRMED ENDPOINTS (network capture 2026-06-22/23):
 *
 * Match events with odds:
 *   GET /api/gh/factsCenter/outrightEvents/sports/{sportId}/tournaments/{tournamentId}
 *   → returns upcoming matches with inline odds ✓
 *
 * Broad sport (MMA / no tournament):
 *   GET /api/gh/factsCenter/quickMarketList?block=E&sport={sportId}
 *
 * Odds refresh:
 *   GET /api/gh/factsCenter/stale-odds/results?eventIds={id1,id2,...}
 */

const SPORTYBET_SPORT_MAP = {
  soccer_epl:                   { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:17'   },
  soccer_uefa_champs_league:    { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:7'    },
  soccer_uefa_europa_league:    { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:679'  },
  soccer_spain_la_liga:         { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:8'    },
  soccer_germany_bundesliga:    { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:35'   },
  soccer_italy_serie_a:         { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:23'   },
  soccer_france_ligue_one:      { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:34'   },
  soccer_ghana_premiership:     { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:1436' },
  soccer_africa_cup_of_nations: { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:5765' },
  soccer_fifa_world_cup:        { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:16'   }, // ✓ confirmed
  basketball_nba:               { type: 'tournament', sportId: 'sr:sport:2',   tournamentId: 'sr:tournament:132'  },
  tennis_atp_wimbledon:         { type: 'tournament', sportId: 'sr:sport:5',   tournamentId: 'sr:tournament:270'  },
  mma_mixed_martial_arts:       { type: 'sport',      sportId: 'sr:sport:117', tournamentId: null                 },
};

const BASE = 'https://www.sportybet.com/api/gh/factsCenter';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Origin': 'https://www.sportybet.com',
  'Referer': 'https://www.sportybet.com/gh/m/sport/football',
};

const MARKET_MAP = { '1_1': 'h2h', '1': 'h2h', '18_1': 'totals', '18': 'totals' };

async function fetchSportybetOdds(sportKey) {
  const mapping = SPORTYBET_SPORT_MAP[sportKey];
  if (!mapping) return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };

  try {
    let rawEvents = [];

    if (mapping.type === 'tournament') {
      // ── Confirmed working endpoint ──────────────────────────────────────────
      const url = `${BASE}/outrightEvents/sports/${mapping.sportId}/tournaments/${mapping.tournamentId}`;
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });

      if (!res.ok) {
        let body = '';
        try { body = (await res.text()).slice(0, 300); } catch {}
        console.warn('[SportyBet] outrightEvents', res.status, 'for', sportKey, '| body:', body);
        return { events: [], status: { ok: false, reason: 'http_' + res.status + ': ' + body, fetchedAt: new Date().toISOString() } };
      }

      const json = await res.json();
      const data = json?.data;

      // Response shape: data.events[] or data.tournamentEvents[] or data[]
      if (Array.isArray(data?.events)) {
        rawEvents = data.events;
      } else if (Array.isArray(data?.tournamentEvents)) {
        rawEvents = data.tournamentEvents;
      } else if (Array.isArray(data?.matchList)) {
        rawEvents = data.matchList;
      } else if (Array.isArray(data)) {
        rawEvents = data;
      }

    } else {
      // Broad sport query for MMA etc.
      const url = `${BASE}/quickMarketList?block=E&sport=${mapping.sportId}`;
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        let body = '';
        try { body = (await res.text()).slice(0, 300); } catch {}
        console.warn('[SportyBet] quickMarketList', res.status, 'for', sportKey, '| body:', body);
        return { events: [], status: { ok: false, reason: 'http_' + res.status, fetchedAt: new Date().toISOString() } };
      }
      const json = await res.json();
      rawEvents = json?.data?.events || json?.data?.tournamentEvents || [];
    }

    const now = Date.now();
    const upcoming = rawEvents.filter(ev => {
      const ms = ev.estimateStartTime || (ev.startTime ? ev.startTime * 1000 : 0);
      return !ms || ms > now;
    });

    // Try normalising with inline odds first
    let normalised = upcoming.map(ev => normaliseEvent(ev, sportKey)).filter(Boolean);

    // If no inline odds, fetch via stale-odds
    if (normalised.length === 0 && upcoming.length > 0) {
      const ids = upcoming.map(e => e.eventId || e.id || e.matchId).filter(Boolean).join(',');
      if (ids) {
        try {
          const oddsRes = await fetch(`${BASE}/stale-odds/results?eventIds=${ids}`, {
            headers: HEADERS, signal: AbortSignal.timeout(8000),
          });
          if (oddsRes.ok) {
            const oddsJson = await oddsRes.json();
            const oddsMap = {};
            (oddsJson?.data || []).forEach(item => {
              const id = item.eventId || item.id;
              if (id) oddsMap[id] = item;
            });
            normalised = upcoming.map(ev => {
              const id = ev.eventId || ev.id || ev.matchId;
              return normaliseEvent({ ...ev, ...(oddsMap[id] || {}) }, sportKey);
            }).filter(Boolean);
          } else {
            console.warn('[SportyBet] stale-odds', oddsRes.status, 'for', sportKey);
          }
        } catch (err) {
          console.warn('[SportyBet] stale-odds error:', err.message);
        }
      }
    }

    console.log('[SportyBet]', sportKey, '→ raw:', rawEvents.length, '| upcoming:', upcoming.length, '| normalised:', normalised.length);
    return { events: normalised, status: { ok: true, reason: null, fetchedAt: new Date().toISOString() } };

  } catch (err) {
    console.warn('[SportyBet] error for', sportKey, err.message);
    return { events: [], status: { ok: false, reason: err.name === 'TimeoutError' ? 'timeout' : err.message, fetchedAt: new Date().toISOString() } };
  }
}

function normaliseEvent(ev, sportKey) {
  try {
    const homeTeam = ev.homeTeamName || ev.home?.name || ev.homeName || ev.homeTeam || 'Home';
    const awayTeam = ev.awayTeamName || ev.away?.name  || ev.awayName || ev.awayTeam || 'Away';
    const startMs  = ev.estimateStartTime || (ev.startTime ? ev.startTime * 1000 : null);
    if (!startMs) return null;

    const h2hOutcomes = [], totalsOutcomes = [];
    for (const market of (ev.markets || ev.odds || ev.marketList || ev.quickMarkets || [])) {
      const mKey = MARKET_MAP[market.id] || MARKET_MAP[market.marketId] || MARKET_MAP[String(market.marketType)];
      if (!mKey) continue;
      for (const o of (market.outcomes || market.selections || market.odds || [])) {
        const price = parseFloat(o.odds || o.price || o.oddsValue);
        if (!price || price <= 1.0) continue;
        if (mKey === 'h2h') {
          const name = o.name === '1' ? homeTeam : o.name === 'X' ? 'Draw' : o.name === '2' ? awayTeam : o.name || o.oddName;
          if (name) h2hOutcomes.push({ name, price });
        } else if (mKey === 'totals') {
          const raw = (o.name || o.oddName || '').toLowerCase();
          totalsOutcomes.push({ name: raw.includes('over') ? 'Over' : 'Under', price, point: parseFloat(o.handicap || o.line || o.point || 2.5) });
        }
      }
    }
    const markets = [];
    if (h2hOutcomes.length >= 2) markets.push({ key: 'h2h', outcomes: h2hOutcomes });
    if (totalsOutcomes.length >= 2) markets.push({ key: 'totals', outcomes: totalsOutcomes });
    if (markets.length === 0) return null;

    return {
      id: 'sportybet_' + (ev.eventId || ev.id || ev.matchId),
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: new Date(startMs).toISOString(),
      bookmakers: [{ key: 'sportybet', title: 'SportyBet', markets, _wa: true }],
    };
  } catch { return null; }
}

module.exports = { fetchSportybetOdds };
