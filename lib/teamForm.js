// ─── SHARED TEAM FORM / RESULTS DATA (API-Football) ────────────────────────
// Used by /api/team-form (feeds index.js's TEAM_FORM for the scanner) AND by
// /api/analyze (feeds the Analyzer real match data instead of letting the
// model invent form/injuries/news from memory — this was the source of the
// stale/wrong "player X is injured" output).
//
// Source: API-Football (api-sports.io), direct host. Needs API_FOOTBALL_KEY
// in env. Free tier is rate-limited (100 req/day as of when this was
// written — verify current limits before relying on this in production).
// In-memory cache below exists to avoid burning quota, not for latency;
// resets on cold start, not shared across serverless instances.

export const LEAGUE_IDS = {
  soccer_epl:                 39,  // Premier League (England)
  soccer_spain_la_liga:       140, // La Liga (Spain)
  soccer_germany_bundesliga:  78,  // Bundesliga (Germany)
  soccer_italy_serie_a:       135, // Serie A (Italy)
  soccer_france_ligue_one:    61,  // Ligue 1 (France)
};

const API_HOST = 'https://v3.football.api-sports.io';

// European top-flight seasons run ~Aug-May: Jul-Dec -> season that just
// started; Jan-Jun -> season that started the previous year.
export function defaultSeason() {
  const now = new Date();
  const month = now.getUTCMonth(); // 0 = Jan
  const year = now.getUTCFullYear();
  return month >= 6 ? year : year - 1;
}

// Mirrors normaliseTeamName() in index.js — KEEP IN SYNC MANUALLY. A miss
// here fails quietly (no data for that team), not loudly.
export function normaliseTeamName(name) {
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

function resultToPoints(teamGoals, oppGoals) {
  if (teamGoals > oppGoals) return 3;
  if (teamGoals === oppGoals) return 1;
  return 0;
}

// ─── CACHE (in-memory, 6h TTL) ──────────────────────────────────────────────
const formCache = {};
const FORM_CACHE_TTL = 6 * 60 * 60 * 1000;

// Fetches a full season of finished fixtures for one league and returns TWO
// shapes:
//  - teams: { [normalisedName]: [points, points, ...] } (chronological) —
//    what index.js's TEAM_FORM / getFormDivergence() already expects.
//    Unchanged from the original team-form.js so the scanner keeps working
//    exactly as before.
//  - matches: { [normalisedName]: [{opponent, venue, goalsFor, goalsAgainst,
//    points, date}, ...] } (chronological) — per-match records, which is
//    what /api/analyze needs for goals/home-away splits/head-to-head.
export async function fetchLeagueForm(sportKey, season, apiKey) {
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
  const fixtures = (json.response || [])
    .filter(fx => fx.goals.home != null && fx.goals.away != null) // skip unfinished
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date)); // oldest first

  const teams = {};
  const matches = {};

  for (const fx of fixtures) {
    const homeGoals = fx.goals.home;
    const awayGoals = fx.goals.away;
    const homeKey = normaliseTeamName(fx.teams.home.name);
    const awayKey = normaliseTeamName(fx.teams.away.name);
    const date = fx.fixture.date;
    const homePts = resultToPoints(homeGoals, awayGoals);
    const awayPts = resultToPoints(awayGoals, homeGoals);

    (teams[homeKey] = teams[homeKey] || []).push(homePts);
    (teams[awayKey] = teams[awayKey] || []).push(awayPts);

    (matches[homeKey] = matches[homeKey] || []).push({
      opponent: awayKey, venue: 'home',
      goalsFor: homeGoals, goalsAgainst: awayGoals, points: homePts, date,
    });
    (matches[awayKey] = matches[awayKey] || []).push({
      opponent: homeKey, venue: 'away',
      goalsFor: awayGoals, goalsAgainst: homeGoals, points: awayPts, date,
    });
  }

  const data = {
    teams, matches,
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
