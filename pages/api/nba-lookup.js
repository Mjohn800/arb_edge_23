// ─── NBA LOOKUP (temporary/diagnostic) ──────────────────────────────────────
// Same idea as league-lookup.js, but for API-NBA instead of API-Football —
// used once, to see the REAL shape of a /games response before writing
// lib/teamFormNBA.js against it. NBA's season format is a single year
// ("2020"), not "2020-2021" like the football-style APIs — confirmed via
// API-Sports' own docs. The exact field names inside teams/scores are NOT
// yet confirmed against a live response, which is exactly what this checks.
// Delete this file once teamFormNBA.js is built and confirmed working.
//
// GET /api/nba-lookup?date=YYYY-MM-DD   (e.g. a recent real NBA game date)
// GET /api/nba-lookup?team=1&season=2025  (one team's games for a season)

const API_HOST = 'https://v2.nba.api-sports.io';

export default async function handler(req, res) {
  const apiKey = process.env.API_FOOTBALL_KEY; // same key, confirmed shared across all api-sports.io products
  if (!apiKey) {
    return res.status(500).json({ error: 'API_FOOTBALL_KEY not set in environment' });
  }

  const { date, team, season } = req.query;
  if (!date && !(team && season)) {
    return res.status(400).json({ error: 'Pass either ?date=YYYY-MM-DD or ?team=<id>&season=<year>' });
  }

  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (team) params.set('team', team);
  if (season) params.set('season', season);

  try {
    const url = `${API_HOST}/games?${params}`;
    const response = await fetch(url, { headers: { 'x-apisports-key': apiKey } });
    const json = await response.json();

    const hasApiErrors = json.errors && Object.keys(json.errors).length > 0;
    if (!response.ok || hasApiErrors) {
      return res.status(502).json({
        error: 'API-NBA returned an error',
        httpStatus: response.status,
        apiErrors: json.errors || null,
        rawResponse: json,
      });
    }

    // Returned raw and unprocessed on purpose — we're looking at real field
    // names (teams.*, scores.*, status.*, etc.) before writing any parsing
    // logic against assumptions.
    return res.status(200).json(json);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
