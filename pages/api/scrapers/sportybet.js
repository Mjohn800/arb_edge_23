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

  // ── Cricket (sr:sport:21) ────────────────────────────────────────────────
  // Using type:'sport' + quickMarketList (same working endpoint as MMA) until
  // tournament IDs are confirmed via DevTools. Returns all cricket on SportyBet.
  cricket_ipl:                  { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_t20_world_cup:        { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_icc_world_cup:        { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_icc_trophy:           { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_international_t20:    { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_odi:                  { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_test_match:           { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_the_hundred:          { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_big_bash:             { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_psl:                  { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_caribbean_premier_league: { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_asia_cup:             { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
};

const BASE = 'https://www.sportybet.com/api/gh/factsCenter';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Origin': 'https://www.sportybet.com',
  'Referer': 'https://www.sportybet.com/gh/m/sport/football',
};

const MARKET_MAP = { '1_1': 'h2h', '1': 'h2h', '18_1': 'totals', '18': 'totals', '10_1': 'spreads', '10': 'spreads', '29_1': 'btts', '29': 'btts' };

async function fetchSportybetOdds(sportKey) {
  const mapping = SPORTYBET_SPORT_MAP[sportKey];
  if (!mapping) return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };

  try {
    let rawEvents = [];

    if (mapping.type === 'tournament') {
      // ✅ CONFIRMED endpoint from DevTools capture (30 Jun 2026):
      // POST /api/gh/factsCenter/pcEvents
      // Body: [{"sportId":"sr:sport:1","marketId":"1,18,10,29,11,26,36,14","tournamentId":[["sr:tournament:16"]]}]
      const body = [{
        sportId: mapping.sportId,
        marketId: '1,18,10,29,11,26,36,14',
        tournamentId: [[mapping.tournamentId]],
      }];

      try {
        const res = await fetch(`${BASE}/pcEvents`, {
          method: 'POST',
          headers: { ...HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          console.warn('[SportyBet] pcEvents', res.status, 'for', sportKey, errBody.slice(0, 200));
        } else {
          const json = await res.json();
          const data = json?.data;
          rawEvents = data?.events || data?.tournamentEvents || data?.matchList || data?.list || (Array.isArray(data) ? data : []);
          console.log('[SportyBet] pcEvents →', rawEvents.length, 'events for', sportKey);
        }
      } catch (err) {
        console.warn('[SportyBet] pcEvents error:', err.message);
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
      let ms = ev.estimateStartTime || ev.startTime || ev.beginTime || 0;
      // Handle seconds vs milliseconds - Sportradar timestamps are sometimes in seconds
      if (ms && ms < 1e12) ms = ms * 1000;
      if (ms === 0) return true; // no timestamp = include it
      return ms > now - 3 * 60 * 60 * 1000; // allow up to 3hrs in past (live/just started)
    });
    if (rawEvents.length > 0) {
      const sample = rawEvents[0];
      console.log('[SportyBet] sample timestamp fields:', JSON.stringify({
        estimateStartTime: sample.estimateStartTime,
        startTime: sample.startTime,
        beginTime: sample.beginTime,
        kickOff: sample.kickOff,
        matchTime: sample.matchTime,
        date: sample.date,
        startDate: sample.startDate,
        start: sample.start,
        eventTime: sample.eventTime,
      }));
      console.log('[SportyBet] sample raw keys:', Object.keys(sample).join(', '));
    }

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
    let startMs = ev.estimateStartTime || ev.startTime || ev.beginTime || null;
    if (startMs && startMs < 1e12) startMs = startMs * 1000;
    if (!startMs) return null;

    const h2hOutcomes = [], totalsOutcomes = [], ahOutcomes = [], bttsOutcomes = [];
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
        } else if (mKey === 'spreads') {
          const raw = (o.name || o.oddName || '').toLowerCase();
          const isHome = raw === '1' || raw.includes('home') || raw.includes('w1');
          ahOutcomes.push({ name: isHome ? homeTeam : awayTeam, price, point: parseFloat(o.handicap || o.line || o.point || 0) });
        } else if (mKey === 'btts') {
          const raw = (o.name || o.oddName || '').toLowerCase();
          bttsOutcomes.push({ name: raw.includes('yes') || raw === '1' ? 'Yes' : 'No', price });
        }
      }
    }
    const markets = [];
    if (h2hOutcomes.length >= 2)   markets.push({ key: 'h2h',     outcomes: h2hOutcomes });
    if (totalsOutcomes.length >= 2) markets.push({ key: 'totals',  outcomes: totalsOutcomes });
    if (ahOutcomes.length >= 2)     markets.push({ key: 'spreads', outcomes: ahOutcomes });
    if (bttsOutcomes.length >= 2)   markets.push({ key: 'btts',    outcomes: bttsOutcomes });
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
