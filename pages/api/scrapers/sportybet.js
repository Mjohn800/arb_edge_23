/**
 * scrapers/sportybet.js
 * Fetches live odds from SportyBet Ghana's internal API.
 * Returns data normalised to The Odds API bookmaker format.
 *
 * ENDPOINT HISTORY:
 * - publicEvents  → DEAD (bizCode 19001 "Resource not found" on all sports)
 * - quickMarketList → LIVE (confirmed 200 via network capture 2026-06-22)
 *
 * FLOW:
 * Step 1: GET /factsCenter/quickMarketList?block=E&sport=sr:sport:1
 *         Returns all upcoming football events with basic h2h odds.
 *         No tournamentId filter in the request — filtering is client-side.
 *         We filter by tournament name keyword in the response instead.
 *
 * Step 2: If quickMarketList doesn't include odds (some variants don't),
 *         collect event IDs and call /factsCenter/stale-odds/results to
 *         get the actual prices. Falls back gracefully if stale-odds path differs.
 */

// Tournament name keywords for client-side filtering
// More resilient than numeric IDs which change per region/version
const SPORTYBET_SPORT_MAP = {
  soccer_epl:                   { sport: 'sr:sport:1', keywords: ['premier league', 'english premier'] },
  soccer_uefa_champs_league:    { sport: 'sr:sport:1', keywords: ['champions league', 'uefa champions'] },
  soccer_uefa_europa_league:    { sport: 'sr:sport:1', keywords: ['europa league'] },
  soccer_spain_la_liga:         { sport: 'sr:sport:1', keywords: ['la liga', 'laliga', 'spain'] },
  soccer_germany_bundesliga:    { sport: 'sr:sport:1', keywords: ['bundesliga'] },
  soccer_italy_serie_a:         { sport: 'sr:sport:1', keywords: ['serie a', 'serie_a'] },
  soccer_france_ligue_one:      { sport: 'sr:sport:1', keywords: ['ligue 1', 'ligue1', 'ligue one'] },
  soccer_ghana_premiership:     { sport: 'sr:sport:1', keywords: ['ghana premier', 'gpl', 'ghana premiership'] },
  soccer_africa_cup_of_nations: { sport: 'sr:sport:1', keywords: ['afcon', 'africa cup', 'cup of nations'] },
  soccer_fifa_world_cup:        { sport: 'sr:sport:1', keywords: ['world cup', 'fifa world', 'coupe du monde'] },
  basketball_nba:               { sport: 'sr:sport:2', keywords: ['nba'] },
  tennis_atp_wimbledon:         { sport: 'sr:sport:5', keywords: ['wimbledon'] },
  mma_mixed_martial_arts:       { sport: 'sr:sport:117', keywords: [] }, // no filter — fetch all MMA
};

const BASE = 'https://www.sportybet.com/api/gh/factsCenter';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Origin': 'https://www.sportybet.com',
  'Referer': 'https://www.sportybet.com/gh/m/sport/football',
};

async function fetchSportybetOdds(sportKey) {
  const mapping = SPORTYBET_SPORT_MAP[sportKey];
  if (!mapping) {
    return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };
  }

  try {
    // ── Step 1: fetch event list ──────────────────────────────────────────────
    const listUrl = `${BASE}/quickMarketList?block=E&sport=${mapping.sport}`;
    const listRes = await fetch(listUrl, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
    });

    if (!listRes.ok) {
      let body = '';
      try { body = (await listRes.text()).slice(0, 300); } catch {}
      console.warn('[SportyBet] quickMarketList', listRes.status, 'for', sportKey, '| body:', body);
      return { events: [], status: { ok: false, reason: 'http_' + listRes.status + ': ' + body, fetchedAt: new Date().toISOString() } };
    }

    const listJson = await listRes.json();

    // Response may nest events under tournaments or directly
    let allEvents = [];
    const data = listJson?.data;
    if (Array.isArray(data?.events)) {
      allEvents = data.events;
    } else if (Array.isArray(data?.tournamentEvents)) {
      allEvents = data.tournamentEvents;
    } else if (Array.isArray(data?.tournaments)) {
      // Events nested inside tournament objects
      data.tournaments.forEach(t => {
        (t.events || t.matchList || []).forEach(ev => {
          ev._tournamentName = t.tournamentName || t.name || '';
          allEvents.push(ev);
        });
      });
    } else if (Array.isArray(data)) {
      allEvents = data;
    }

    // ── Step 2: filter by tournament keyword ──────────────────────────────────
    const now = Date.now();
    const keywords = mapping.keywords;
    const filtered = allEvents.filter(ev => {
      // Only upcoming events
      const startMs = ev.estimateStartTime || (ev.startTime ? ev.startTime * 1000 : 0);
      if (startMs && startMs < now) return false;

      // No keyword restriction = take all (e.g. MMA)
      if (!keywords || keywords.length === 0) return true;

      const tName = (
        ev._tournamentName ||
        ev.tournamentName ||
        ev.leagueName ||
        ev.tournament?.name ||
        ev.category?.name ||
        ''
      ).toLowerCase();

      return keywords.some(kw => tName.includes(kw));
    });

    // ── Step 3: try to normalise directly from quickMarketList response ───────
    let normalised = filtered.map(ev => normaliseEvent(ev, sportKey)).filter(Boolean);

    // ── Step 4: if quickMarketList gave no odds, fetch via stale-odds ─────────
    if (normalised.length === 0 && filtered.length > 0) {
      const eventIds = filtered
        .map(e => e.eventId || e.id || e.matchId)
        .filter(Boolean)
        .join(',');

      if (eventIds) {
        try {
          const oddsRes = await fetch(`${BASE}/stale-odds/results?eventIds=${eventIds}`, {
            headers: HEADERS,
            signal: AbortSignal.timeout(8000),
          });
          if (oddsRes.ok) {
            const oddsJson = await oddsRes.json();
            const oddsMap = {};
            (oddsJson?.data || []).forEach(item => {
              const id = item.eventId || item.id;
              if (id) oddsMap[id] = item;
            });
            // Merge odds into events then normalise
            normalised = filtered.map(ev => {
              const id = ev.eventId || ev.id || ev.matchId;
              const withOdds = { ...ev, ...(oddsMap[id] || {}) };
              return normaliseEvent(withOdds, sportKey);
            }).filter(Boolean);
          } else {
            console.warn('[SportyBet] stale-odds', oddsRes.status, 'for', sportKey);
          }
        } catch (err) {
          console.warn('[SportyBet] stale-odds fetch error:', err.message);
        }
      }
    }

    console.log('[SportyBet]', sportKey, '→ allEvents:', allEvents.length, '| filtered:', filtered.length, '| normalised:', normalised.length);
    return { events: normalised, status: { ok: true, reason: null, fetchedAt: new Date().toISOString() } };

  } catch (err) {
    console.warn('[SportyBet] fetch error for', sportKey, err.message);
    return { events: [], status: { ok: false, reason: err.name === 'TimeoutError' ? 'timeout' : 'fetch_error: ' + err.message, fetchedAt: new Date().toISOString() } };
  }
}

function normaliseEvent(ev, sportKey) {
  try {
    const homeTeam = ev.homeTeamName || ev.home?.name || ev.homeName || ev.homeTeam || 'Home';
    const awayTeam = ev.awayTeamName || ev.away?.name  || ev.awayName || ev.awayTeam || 'Away';

    const startMs = ev.estimateStartTime || (ev.startTime ? ev.startTime * 1000 : null);
    if (!startMs) return null;
    const commenceTime = new Date(startMs).toISOString();

    const markets = [];
    const h2hOutcomes   = [];
    const totalsOutcomes = [];

    const rawMarkets = ev.markets || ev.odds || ev.marketList || ev.quickMarkets || [];

    for (const market of rawMarkets) {
      const mKey = MARKET_MAP[market.id] || MARKET_MAP[market.marketId] || MARKET_MAP[String(market.marketType)];
      if (!mKey) continue;

      const selections = market.outcomes || market.selections || market.odds || [];
      for (const o of selections) {
        const price = parseFloat(o.odds || o.price || o.oddsValue);
        if (!price || price <= 1.0) continue;

        if (mKey === 'h2h') {
          const name = o.name === '1' ? homeTeam
                     : o.name === 'X' ? 'Draw'
                     : o.name === '2' ? awayTeam
                     : o.name || o.oddName;
          if (name) h2hOutcomes.push({ name, price });
        } else if (mKey === 'totals') {
          const raw  = (o.name || o.oddName || '').toLowerCase();
          const name = raw.includes('over') ? 'Over' : 'Under';
          const point = parseFloat(o.handicap || o.line || o.point || 2.5);
          totalsOutcomes.push({ name, price, point });
        }
      }
    }

    if (h2hOutcomes.length >= 2) markets.push({ key: 'h2h', outcomes: h2hOutcomes });
    if (totalsOutcomes.length >= 2) markets.push({ key: 'totals', outcomes: totalsOutcomes });
    if (markets.length === 0) return null;

    return {
      id: 'sportybet_' + (ev.eventId || ev.id || ev.matchId),
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: commenceTime,
      bookmakers: [{ key: 'sportybet', title: 'SportyBet', markets, _wa: true }],
    };
  } catch {
    return null;
  }
}

const MARKET_MAP = {
  '1_1': 'h2h',
  '1_2': 'h2h',
  '18_1': 'totals',
  '1': 'h2h',
  '18': 'totals',
};

module.exports = { fetchSportybetOdds };
