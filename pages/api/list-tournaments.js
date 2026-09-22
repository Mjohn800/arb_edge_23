// pages/api/list-tournaments.js
export default async function handler(req, res) {
  const API_KEY = process.env.ODDSPAPI_KEY;
  const BASE_URL = 'https://api.oddspapi.io/v4/tournaments';

  if (!API_KEY) {
    return res.status(500).json({ error: 'Missing ODDSPAPI_KEY env var' });
  }

  try {
    const url = `${BASE_URL}?apikey=${API_KEY}`;
    const r = await fetch(url);
    const status = r.status;
    let body;
    try { body = await r.json(); } catch { body = { raw: await r.text() }; }

    if (status >= 400) {
      return res.status(status).json({ error: 'OddsPapi returned an error', status, body });
    }

    // Try to normalize into a simple list regardless of exact response shape
    const list = Array.isArray(body) ? body : (body.tournaments || body.data || []);

    const simplified = list.slice(0, 30).map(t => ({
      id: t.id ?? t.tournamentId ?? t.tournament_id ?? null,
      name: t.name ?? t.tournamentName ?? t.title ?? null,
      sport: t.sport ?? t.sportName ?? null,
      country: t.country ?? t.countryName ?? null,
    }));

    return res.status(200).json({
      count: list.length,
      showing: simplified.length,
      tournaments: simplified,
      rawSample: JSON.stringify(body).slice(0, 500),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
