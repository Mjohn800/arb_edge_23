// ─── LEAGUE LOOKUP (temporary/diagnostic) ───────────────────────────────────
// Not part of the app's normal flow — a one-off tool to find real
// API-Football league IDs for leagues not already confirmed in
// lib/teamForm.js's LEAGUE_IDS. Delete this file once you've collected the
// IDs you need; it's not meant to stay in production.
//
// GET /api/league-lookup?q=<search term>[&country=<country name>]
// e.g. /api/league-lookup?q=Premier%20League&country=Ghana

export default async function handler(req, res) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API_FOOTBALL_KEY not set in environment' });
  }

  const { q, country } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'q query param required (league/competition name to search)' });
  }

  const params = new URLSearchParams({ search: q });
  if (country) params.set('country', country);

  try {
    const url = `https://v3.football.api-sports.io/leagues?${params}`;
    const response = await fetch(url, { headers: { 'x-apisports-key': apiKey } });
    const json = await response.json();

    const results = (json.response || []).map(l => ({
      id: l.league.id,
      name: l.league.name,
      type: l.league.type, // "League" or "Cup" — AFCON/World Cup show as Cup
      country: l.country?.name,
      currentSeason: (l.seasons || []).find(s => s.current)?.year,
    }));

    return res.status(200).json({ query: q, country: country || null, count: results.length, results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
