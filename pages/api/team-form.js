// ─── TEAM FORM (results history) ───────────────────────────────────────────
// Feeds index.js's TEAM_FORM structure — chronological points-per-game per
// team, used by getFormDivergence() to flag "good team, bad recent stretch"
// mispricing. This is a DIFFERENT data type from odds.js: match RESULTS, not
// bookmaker PRICES, so it's its own endpoint/file rather than bolted onto
// odds.js's handler.
//
// Source: API-Football (api-sports.io), direct host (not the RapidAPI proxy).
// Needs API_FOOTBALL_KEY in env. Free tier is rate-limited (100 req/day on
// the free plan as of when this was written — verify current limits before
// relying on this in production) — the in-memory cache below exists mainly
// to avoid burning that quota on every client refresh, not for latency.

// ─── LEAGUE MAPPING ─────────────────────────────────────────────────────────
// API-Football numeric league IDs for the Top-5 — same sport keys used
// throughout index.js/odds.js so this plugs in without a translation layer
// on the client.
const LEAGUE_IDS = {
  soccer_epl:                 39,  // Premier League (England)
  soccer_spain_la_liga:       140, // La Liga (Spain)
  soccer_germany_bundesliga:  78,  // Bundesliga (Germany)
  soccer_italy_serie_a:       135, // Serie A (Italy)
  soccer_france_ligue_one:    61,  // Ligue 1 (France)
};

const API_HOST = 'https://v3.football.api-sports.io';

// ─── SEASON DEFAULTING ──────────────────────────────────────────────────────
// API-Football seasons are keyed by start year (e.g. "2025" = 2025-26).
// European top-flight seasons run ~Aug-May, so: if we're in the Jul-Dec
// window, the season that just started (or is about to) is the current
// year; if we're in the Jan-Jun window, we're still inside the season that
// started the previous year. This is a heuristic — pass ?season=2025
// explicitly if you need a specific one (e.g. testing against the completed
// 2025-26 season while off-season).
function defaultSeason() {
  const now = new Date();
  const month = now.getUTCMonth(); // 0 = Jan
  const year = now.getUTCFullYear();
  return month >= 6 ? year : year - 1; // Jul(6)-Dec -> this year; Jan-Jun -> prior year
}

// ─── TEAM NAME NORMALISATION ────────────────────────────────────────────────
// Mirrors normaliseTeamName() in index.js. KEPT IN SYNC MANUALLY — if you
// change one, change the other, or team-form lookups will silently return
// null in the client (normaliseTeamName treats a miss as "no data" rather
// than throwing, so a drift here fails quietly, not loudly. Check the two
// side by side after editing either).
function normaliseTeamName(name) {
  if (!name) return '';
  let n = name.trim().toLowerCase()
    .replace(/^afc\s+|^fc\s+|^1\.\s*fc\s+|^ss\s+|^ssc\s+|^as\s+/, '')
    .replace(/[öø]/g, 'o').replace(/[üù]/g, 'u').replace(/[ä]/g, 'a').replace(/[éè]/g, 'e')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
  if (/^internazionale$|^inter$/.test(n)) return 'inter milan';
  if (/^milan$|^ac milan$/.test(n)) return 'ac milan';
  if (/^roma$|^as roma$/.test(n)) return 'roma';
  n = n
    .replace(/\bman(chester)?\s*utd\b/, 'manchester united')
    .replace(/\bman(chester)?\s*city\b/, 'manchester city')
    .replace(/\bspurs\b/, 'tottenham hotspur')
    .replace(/\bwolves\b/, 'wolverhampton wanderers')
    .replace(/\bbrighton\b(?!.*albion)/, 'brighton and hove albion')
    .replace(/\bnottm forest\b|\bforest\b/, 'nottingham forest')
    .replace(/\bathletic bilbao\b/, 'athletic club')
    .replace(/\bfsv mainz( 05)?\b|\bmainz\b/, 'mainz 05')
    .replace(/\b1\s*fc\s*koln\b|\bcologne\b/, 'fc koln')
    .replace(/\bunion berlin\b|\b1 fc union berlin\b/, 'union berlin')
    .replace(/\bmonchengladbach\b|\bgladbach\b|\bborussia mgladbach\b/, 'borussia monchengladbach')
    .replace(/\bheidenheim\b/, 'fc heidenheim')
    .replace(/\bst pauli\b|\bfc st pauli\b/, 'st pauli');
  return n.trim();
}

// ─── CACHE (in-memory, 6h TTL) ──────────────────────────────────────────────
// Results don't need odds.js's 3-min freshness — a league plays at most a
// handful of matches per day. 6h keeps quota usage low without going stale
// mid-matchday. Same caveat as odds.js's cache: resets on cold start, this
// is a courtesy not a guarantee.
const formCache = {};
const FORM_CACHE_TTL = 6 * 60 * 60 * 1000;

function resultToPoints(teamGoals, oppGoals) {
  if (teamGoals > oppGoals) return 3;
  if (teamGoals === oppGoals) return 1;
  return 0;
}

async function fetchLeagueForm(sportKey, season, apiKey) {
  const leagueId = LEAGUE_IDS[sportKey];
  if (!leagueId) throw new Error('Unknown sport key: ' + sportKey);

  const cacheKey = sportKey + ':' + season;
  const cached = formCache[cacheKey];
  if (cached && Date.now() - cached.ts < FORM_CACHE_TTL) {
    return { ...cached.data, fromCache: true };
  }

  const url = `${API_HOST}/fixtures?league=${leagueId}&season=${season}&status=FT`;
  const response = await fetch(url, { headers: { 'x-apisports-key': apiKey } });

  if (!response.ok) {
    let body = null;
    try { body = await response.json(); } catch {}
    throw new Error(`API-Football ${response.status}: ${JSON.stringify(body)}`);
  }

  const json = await response.json();
  const fixtures = json.response || [];

  // Sort oldest-first — TEAM_FORM arrays must be chronological for the
  // last-10 / last-30 slicing in getFormDivergence() to mean anything.
  fixtures.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

  const teams = {};
  for (const fx of fixtures) {
    const homeGoals = fx.goals.home;
    const awayGoals = fx.goals.away;
    if (homeGoals == null || awayGoals == null) continue; // skip anything not actually finished

    const homeKey = normaliseTeamName(fx.teams.home.name);
    const awayKey = normaliseTeamName(fx.teams.away.name);

    (teams[homeKey] = teams[homeKey] || []).push(resultToPoints(homeGoals, awayGoals));
    (teams[awayKey] = teams[awayKey] || []).push(resultToPoints(awayGoals, homeGoals));
  }

  const data = {
    teams,
    meta: {
      sportKey, season, leagueId,
      fixturesUsed: fixtures.length,
      teamsFound: Object.keys(teams).length,
      fetchedAt: new Date().toISOString(),
    },
  };

  formCache[cacheKey] = { data, ts: Date.now() };
  return { ...data, fromCache: false };
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
// GET /api/team-form?sport=soccer_epl              -> single league, default season
// GET /api/team-form?sport=soccer_epl&season=2025  -> single league, explicit season
// GET /api/team-form?sport=all                     -> all 5 leagues in one response,
//                                                      shaped to drop straight into
//                                                      index.js's TEAM_FORM constant
export default async function handler(req, res) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API_FOOTBALL_KEY not set in environment' });
  }

  const { sport, season: seasonParam } = req.query;
  const season = seasonParam ? parseInt(seasonParam, 10) : defaultSeason();

  if (!sport) {
    return res.status(400).json({ error: 'sport query param required (a Top-5 sport key, or "all")' });
  }

  try {
    if (sport === 'all') {
      const sportKeys = Object.keys(LEAGUE_IDS);
      const results = await Promise.allSettled(
        sportKeys.map(k => fetchLeagueForm(k, season, apiKey))
      );

      const TEAM_FORM = {};
      const meta = {};
      results.forEach((r, i) => {
        const key = sportKeys[i];
        if (r.status === 'fulfilled') {
          TEAM_FORM[key] = r.value.teams;
          meta[key] = r.value.meta;
        } else {
          TEAM_FORM[key] = {};
          meta[key] = { error: r.reason?.message || 'unknown error' };
          console.log('[team-form]', key, 'failed:', r.reason?.message);
        }
      });

      return res.status(200).json({ TEAM_FORM, meta, season });
    }

    if (!LEAGUE_IDS[sport]) {
      return res.status(400).json({ error: 'Unknown sport key: ' + sport, known: Object.keys(LEAGUE_IDS) });
    }

    const result = await fetchLeagueForm(sport, season, apiKey);
    console.log('[team-form]', sport, season, '-> teams:', result.meta.teamsFound, 'fixtures:', result.meta.fixturesUsed, result.fromCache ? '(cached)' : '(fresh)');

    return res.status(200).json({
      TEAM_FORM: { [sport]: result.teams },
      meta: { [sport]: result.meta },
      season,
    });
  } catch (err) {
    console.log('[team-form] error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
