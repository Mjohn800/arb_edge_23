/**
 * scrapers/22bet.js
 *
 * ✅ CONFIRMED via DevTools 30 Jun 2026:
 * 22Bet Ghana uses platform.22bet.com.gh — NOT the old 22bet.gh assumption.
 * Platform: NOT BetConstruct — 22Bet's own proprietary API.
 *
 * Endpoint: GET https://platform.22bet.com.gh/api/v4/menu/line/en
 *   ?period=0&withOutrightMarkets=1&trlang=en_gh&leagueIds={leagueId}
 *
 * League IDs: visible in URL bar when browsing 22bet.com.gh
 *   e.g. /prematch?top=1&leagueIds=1008012 → World Cup = 1008012
 *
 * TO FIND MORE LEAGUE IDs:
 *   Browse to the competition on 22bet.com.gh → read leagueIds from URL bar.
 */

const TWENTYTWOBET_SPORT_MAP = {
  soccer_fifa_world_cup:            { leagueId: 1008012 }, // ✅ confirmed 30 Jun 2026
  // TODO: browse to each league on 22bet.com.gh and read leagueIds from URL bar
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

async function fetch22BetOdds(sportKey) {
  const mapping = TWENTYTWOBET_SPORT_MAP[sportKey];
  if (!mapping || !mapping.leagueId) {
    return {
      events: [],
      status: { ok: true, reason: mapping ? 'league_id_unknown' : 'unsupported_sport', fetchedAt: new Date().toISOString() },
    };
  }

  const url = `${BASE}/api/v4/menu/line/en?period=0&withOutrightMarkets=1&trlang=en_gh&leagueIds=${mapping.leagueId}`;

  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });

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

    // 22Bet /api/v4/menu/line/ returns nested league → events structure
    const blocks = json?.data || json?.leagues || json?.result || (Array.isArray(json) ? json : []);
    const rawEvents = blocks.flatMap(b => b.events || b.matches || b.items || []);
    console.log('[22Bet]', sportKey, '→ blocks:', blocks.length, '| raw events:', rawEvents.length);

    const now = Date.now();
    const upcoming = rawEvents.filter(ev => {
      const ms = parseStartTime(ev);
      if (!ms) return true;
      return ms > now - 3 * 60 * 60 * 1000;
    });

    const normalised = upcoming.map(ev => normalise22BetEvent(ev, sportKey)).filter(Boolean);
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
  let ms = ev.start_ts || ev.startTime || ev.start_time || ev.date || ev.kickoff || ev.startDate || null;
  if (!ms) return null;
  if (ms < 1e12) ms = ms * 1000;
  return ms;
}

function normalise22BetEvent(ev, sportKey) {
  try {
    const homeTeam = ev.team1_name || ev.home_team || ev.home?.name || ev.homeName || ev.team1 || ev.opp1 || 'Home';
    const awayTeam = ev.team2_name || ev.away_team || ev.away?.name || ev.awayName || ev.team2 || ev.opp2 || 'Away';

    const startMs = parseStartTime(ev);
    if (!startMs) return null;

    const h2hOutcomes = [];
    const totalsOutcomes = [];

    const markets = ev.markets || ev.market || ev.odds || ev.factors || [];
    for (const mkt of (Array.isArray(markets) ? markets : Object.values(markets))) {
      const mktType = String(mkt.type || mkt.market_type || mkt.name || mkt.factorType || '');
      const isH2H = /^(1x2|match result|moneyline|full.time|1_1|factor.*1$)/i.test(mktType) || mkt.key === '1x2';
      const isTotals = /^(total|over.under|goals)/i.test(mktType);

      const outcomes = mkt.outcomes || mkt.selections || mkt.event || mkt.values || [];
      for (const o of (Array.isArray(outcomes) ? outcomes : Object.values(outcomes))) {
        const price = parseFloat(o.price || o.odds || o.odd || o.value || o.v || 0);
        if (!price || price <= 1.0) continue;

        if (isH2H) {
          const rawName = String(o.name || o.type || o.outcome || o.title || '');
          const name =
            rawName === '1' || rawName === 'W1' || /home/i.test(rawName) ? homeTeam :
            rawName === 'X' || rawName === 'Draw' || /draw/i.test(rawName) ? 'Draw' :
            rawName === '2' || rawName === 'W2' || /away/i.test(rawName) ? awayTeam :
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
