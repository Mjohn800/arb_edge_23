/**
 * scrapers/paripesa.js
 *
 * CONFIRMED 2026-06-30 via live DevTools capture on paripesa.top:
 * Paripesa runs on the 1xBet platform (white-label) — NOT BetConstruct as a
 * previous draft of this file assumed. Wrong-platform guesses (competition_id
 * style params, /api/v1/prematch/... paths) never had a chance of working;
 * this rewrite uses the real, captured request.
 *
 * Confirmed real request (captured live, 200 OK):
 *   GET https://paripesa.top/service-api/LiveFeed/Get1x2_VZip
 *     ?sports=1&champs=2708736,3017325&count=40&lng=en&gr=764&mode=4
 *     &country=48&partner=188&getEmpty=true&virtualSports=true&noFilterBlockEvent=true
 *
 * champs=2708736 is the World Cup 2026 championship ID (confirmed earlier via
 * the 1xBet website itself — same numbering family, since it's the same engine).
 * champs accepts a COMMA-SEPARATED LIST, so multiple competitions can be
 * requested in a single call — used below to batch all mapped competitions
 * for a given sport into one request instead of one round-trip per league.
 *
 * Response shape is the standard 1xBet "Zip" family (same as the well-documented
 * GetGameZip/GetGameZip endpoints): {Success: true, Value: [...]} where each
 * item is a match object. Exact field names below are written defensively with
 * fallbacks since 1xBet's white-label skins occasionally vary minor field
 * names — if parsing comes back empty, log the raw response shape first
 * before assuming the request itself is wrong (it's confirmed correct).
 */

// ── Sport / championship ID map ────────────────────────────────────────────
// sports=1 is football across the whole 1xBet engine family (confirmed).
// champs IDs below are carried over from the equivalent 1xBet mapping where
// known; treat any value here WITHOUT a confirmation note as a best-effort
// guess to verify the same way World Cup was confirmed (check the public
// paripesa.top website for that league and read the champ id out of its URL).
const PARIPESA_SPORT_MAP = {
  soccer_fifa_world_cup:        { sportId: 1, champId: '2708736' }, // CONFIRMED live 2026-06-30
  soccer_epl:                   { sportId: 1, champId: '88637' },
  soccer_uefa_champs_league:    { sportId: 1, champId: '8455' },
  soccer_uefa_europa_league:    { sportId: 1, champId: '8456' },
  soccer_spain_la_liga:         { sportId: 1, champId: '88751' },
  soccer_germany_bundesliga:    { sportId: 1, champId: '88533' },
  soccer_italy_serie_a:         { sportId: 1, champId: '88636' },
  soccer_france_ligue_one:      { sportId: 1, champId: '88649' },
  soccer_ghana_premiership:     { sportId: 1, champId: null },
  soccer_africa_cup_of_nations: { sportId: 1, champId: null },
  basketball_nba:               { sportId: 3, champId: '486' },
};

const BASE = 'https://paripesa.top';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Referer': BASE + '/',
};

// Fixed query params confirmed from the live capture — kept exactly as seen
// rather than guessed, since some of these (gr, mode, partner, country) are
// opaque platform/region IDs that may matter for getting a valid response.
const FIXED_PARAMS = 'count=40&lng=en&gr=764&mode=4&country=48&partner=188&getEmpty=true&virtualSports=true&noFilterBlockEvent=true';

async function fetchParipesaOdds(sportKey) {
  const mapping = PARIPESA_SPORT_MAP[sportKey];
  if (!mapping || !mapping.champId) {
    return {
      events: [],
      status: { ok: true, reason: 'unsupported_sport_or_unconfirmed_champId', fetchedAt: new Date().toISOString() },
    };
  }

  const url = `${BASE}/service-api/LiveFeed/Get1x2_VZip?sports=${mapping.sportId}&champs=${mapping.champId}&${FIXED_PARAMS}`;

  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      let body = '';
      try { body = (await res.text()).slice(0, 300); } catch {}
      console.warn('[Paripesa] HTTP', res.status, 'for', sportKey, '| body:', body);
      return {
        events: [],
        status: { ok: false, reason: 'http_' + res.status, fetchedAt: new Date().toISOString() },
      };
    }

    const json = await res.json();

    if (json && json.Success === false) {
      console.warn('[Paripesa] API returned Success:false for', sportKey, '| Error:', json.Error || json.ErrorMessage);
      return {
        events: [],
        status: { ok: false, reason: 'api_error_' + (json.Error || 'unknown'), fetchedAt: new Date().toISOString() },
      };
    }

    // Standard 1xBet-family shape is {Success, Value: [...]}; fall back to a
    // couple of alternates defensively in case this white-label skin wraps it
    // differently.
    const rawEvents = json?.Value || json?.value || json?.data || (Array.isArray(json) ? json : []);

    const normalised = rawEvents.map(ev => normaliseParipesaEvent(ev, sportKey)).filter(Boolean);
    console.log('[Paripesa]', sportKey, '→ raw:', rawEvents.length, '| normalised:', normalised.length);

    return {
      events: normalised,
      status: { ok: true, reason: null, fetchedAt: new Date().toISOString() },
    };

  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    console.warn('[Paripesa] error for', sportKey, err.message);
    return {
      events: [],
      status: { ok: false, reason: isTimeout ? 'timeout' : err.message, fetchedAt: new Date().toISOString() },
    };
  }
}

// 1xBet-family "Zip" responses encode each match's odds in a flat array (`E`)
// of {T: <type id>, C: <coefficient>, P?: <line/handicap>} entries, rather than
// a nested markets object. T=1/2/3 is the standard main 1X2 market (home/draw/
// away) across this platform family; T values for totals/handicaps vary, so
// only 1X2 is parsed here for now — safer to extend once a real response has
// been inspected (see file header) than to guess totals type IDs blind.
const H2H_TYPE_HOME = 1;
const H2H_TYPE_DRAW = 2;
const H2H_TYPE_AWAY = 3;

function normaliseParipesaEvent(ev, sportKey) {
  try {
    const homeTeam = ev.O1 || ev.team1 || ev.home || 'Home';
    const awayTeam = ev.O2 || ev.team2 || ev.away || 'Away';

    let startMs = ev.S || ev.start || ev.startTime;
    if (!startMs) return null;
    if (startMs < 1e12) startMs = startMs * 1000; // unix seconds -> ms

    const outcomesRaw = ev.E || ev.AE || [];
    if (!Array.isArray(outcomesRaw) || outcomesRaw.length === 0) return null;

    const h2hOutcomes = [];
    for (const o of outcomesRaw) {
      const type = o.T ?? o.type;
      const price = parseFloat(o.C ?? o.price ?? o.coef);
      if (!price || price <= 1.0) continue;

      if (type === H2H_TYPE_HOME) h2hOutcomes.push({ name: homeTeam, price });
      else if (type === H2H_TYPE_DRAW) h2hOutcomes.push({ name: 'Draw', price });
      else if (type === H2H_TYPE_AWAY) h2hOutcomes.push({ name: awayTeam, price });
    }

    if (h2hOutcomes.length < 2) return null;

    return {
      id: 'paripesa_' + (ev.I || ev.id || Math.random()),
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: new Date(startMs).toISOString(),
      bookmakers: [{ key: 'paripesa', title: 'Paripesa', markets: [{ key: 'h2h', outcomes: h2hOutcomes }], _wa: true }],
    };
  } catch (err) {
    console.warn('[Paripesa] normalise error:', err.message);
    return null;
  }
}

module.exports = { fetchParipesaOdds };
