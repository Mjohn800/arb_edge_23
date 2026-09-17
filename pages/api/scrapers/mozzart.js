/**
 * scrapers/mozzart.js
 *
 * CONFIRMED via DevTools capture (16 Sep 2026):
 *
 *   POST https://www.mozzartbet.com/betting/matches
 *   Body: { date, sort, currentPage, competitionIds, matchTypeId, pageSize, search, sportId, medium }
 *
 *   medium: "ANDROID" — CONFIRMED via DevTools capture (17 Sep 2026). Without it the API
 *   returns 403 { status: "ERROR", message: "Pogresan medium", mediumFromHeader: "DEFAULT" }.
 *
 * competitionIds: [] returns matches across ALL competitions for that sport/date —
 * we filter by competition name client-side rather than hunting per-league IDs,
 * same technique used for MSport/SportyBet cricket fallback.
 *
 * ⚠️ UNCONFIRMED, needs verification:
 *   - date: "tomorrow" / other values beyond "today" — assumed pattern, not captured
 *   - sportId for basketball/tennis/cricket/MMA — only sportId:1 (soccer) confirmed
 *   - whether a 3rd market (BTTS, handicap) exists and what its subgame shape looks like
 */

const MOZZART_SPORT_MAP = {
  soccer_epl:                   { sportId: 1, keywords: ['premier league', 'england'] },
  soccer_uefa_champs_league:    { sportId: 1, keywords: ['champions league'] },
  soccer_uefa_europa_league:    { sportId: 1, keywords: ['europa league'] },
  soccer_spain_la_liga:         { sportId: 1, keywords: ['la liga', 'spain'] },
  soccer_germany_bundesliga:    { sportId: 1, keywords: ['bundesliga', 'germany'] },
  soccer_italy_serie_a:         { sportId: 1, keywords: ['serie a', 'italy'] },
  soccer_france_ligue_one:      { sportId: 1, keywords: ['ligue 1', 'ligue one', 'france'] },
  soccer_ghana_premiership:     { sportId: 1, keywords: ['ghana'] },
  soccer_africa_cup_of_nations: { sportId: 1, keywords: ['afcon', 'africa cup'] },
  soccer_fifa_world_cup:        { sportId: 1, keywords: ['world cup', 'fifa'] },
  // basketball_nba, tennis_atp_wimbledon, mma_*, cricket_* — sportId not yet confirmed,
  // left out until someone captures those requests in DevTools the same way.
};

const BASE = 'https://www.mozzartbet.com/betting/matches';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Content-Type': 'application/json',
  'Origin': 'https://www.mozzartbet.com',
  'Referer': 'https://www.mozzartbet.com/en/kladjenje',
};

async function fetchOneDate(sportId, date, retries = 2) {
  const body = {
    date,
    sort: 'bycompetition',
    currentPage: 0,
    competitionIds: [],
    matchTypeId: 0,
    pageSize: 50,
    search: '',
    sportId,
    medium: 'ANDROID', // CONFIRMED via DevTools capture (17 Sep 2026) — without this the API returns 403 "Pogresan medium"
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const json = await res.json();
      return json?.items || [];
    }

    if (res.status === 429 && attempt < retries) {
      const waitMs = 800 * Math.pow(2, attempt); // 800ms, then 1600ms
      console.warn('[Mozzart]', date, '429 — backing off', waitMs, 'ms (attempt', attempt + 1, 'of', retries, ')');
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    let bodyText = '';
    try { bodyText = (await res.text()).slice(0, 300); } catch {}
    console.warn('[Mozzart]', date, 'fetch failed', res.status, '| body:', bodyText);
    return [];
  }

  return [];
}

async function fetchMozzartOdds(sportKey) {
  const mapping = MOZZART_SPORT_MAP[sportKey];
  if (!mapping) return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };

  try {
    // Only "today" — "tomorrow" was an unconfirmed guess and doubled request volume,
    // which was triggering Mozzart's 429 rate limiting.
    let allItems = [];
    for (const date of ['today']) {
      try {
        const items = await fetchOneDate(mapping.sportId, date);
        allItems = allItems.concat(items);
      } catch (err) {
        console.warn('[Mozzart]', date, 'threw:', err.message);
      }
    }

    const keywords = mapping.keywords || [];
    const filtered = allItems.filter(item => {
      const compName = (item.competition?.name || '').toLowerCase();
      return keywords.some(kw => compName.includes(kw));
    });

    const normalised = filtered.map(item => normaliseEvent(item, sportKey)).filter(Boolean);

    console.log('[Mozzart]', sportKey, '→ total:', allItems.length, '| matched:', filtered.length, '| normalised:', normalised.length);
    return { events: normalised, status: { ok: true, reason: null, fetchedAt: new Date().toISOString() } };

  } catch (err) {
    console.warn('[Mozzart] error for', sportKey, err.message);
    return { events: [], status: { ok: false, reason: err.name === 'TimeoutError' ? 'timeout' : err.message, fetchedAt: new Date().toISOString() } };
  }
}

function normaliseEvent(item, sportKey) {
  try {
    const homeTeam = item.home?.name;
    const awayTeam = item.visitor?.name;
    const startMs = item.startTime;
    if (!homeTeam || !awayTeam || !startMs) return null;

    const h2hOutcomes = [], totalsOutcomes = [];

    for (const group of (item.oddsGroup || [])) {
      for (const o of (group.odds || [])) {
        const value = parseFloat(o.value);
        if (!value || value <= 1.0) continue;
        const sub = o.subgame || {};
        const shortName = (sub.shortName || '').trim();
        const name = (sub.name || '').toLowerCase();

        if (shortName === '1' || shortName === 'X' || shortName === '2') {
          const outcomeName = shortName === '1' ? homeTeam : shortName === 'X' ? 'Draw' : awayTeam;
          h2hOutcomes.push({ name: outcomeName, price: value });
        } else if (name === 'over' || name === 'under') {
          const m = shortName.match(/([\d.]+)/);
          const point = m ? parseFloat(m[1]) : null;
          if (point == null) continue;
          const side = name === 'over' ? 'Over' : 'Under';
          totalsOutcomes.push({ name: side, price: value, point });
        }
      }
    }

    const markets = [];
    if (h2hOutcomes.length >= 2) markets.push({ key: 'h2h', outcomes: h2hOutcomes });
    if (totalsOutcomes.length >= 2) markets.push({ key: 'totals', outcomes: totalsOutcomes });
    if (markets.length === 0) return null;

    return {
      id: 'mozzart_' + item.id,
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: new Date(startMs).toISOString(),
      bookmakers: [{ key: 'mozzart', title: 'Mozzart', markets, _wa: true }],
    };
  } catch { return null; }
}

module.exports = { fetchMozzartOdds };
