// pages/api/list-tournaments.js
export default async function handler(req, res) {
  const API_KEY = process.env.ODDSPAPI_KEY;
  const BASE = 'https://api.oddspapi.io/v4';

  if (!API_KEY) {
    return res.status(500).json({ error: 'Missing ODDSPAPI_KEY env var' });
  }

  try {
    // Step 1: discover sports and their IDs
    const sportsRes = await fetch(`${BASE}/sports?apiKey=${API_KEY}`);
    const sportsStatus = sportsRes.status;
    let sportsBody;
    try { sportsBody = await sportsRes.json(); } catch { sportsBody = { raw: await sportsRes.text() }; }

    if (sportsStatus >= 400) {
      return res.status(sportsStatus).json({ step: 'sports', error: sportsBody });
    }

    const sportsList = Array.isArray(sportsBody) ? sportsBody : (sportsBody.sports || sportsBody.data || []);

    // Try to find football/soccer specifically
    const football = sportsList.find(s => {
      const name = (s.name || s.sportName || '').toLowerCase();
      return name.includes('football') || name.includes('soccer');
    });

    const chosenSport = football || sportsList[0];
    const sportId = chosenSport?.id ?? chosenSport?.sportId ?? null;

    if (!sportId) {
      return res.status(200).json({
        note: 'Could not determine sportId automatically — inspect raw sports list below',
        sportsRaw: JSON.stringify(sportsBody).slice(0, 1000),
      });
    }

    // Step 2: use that sportId to fetch tournaments
    const tourRes = await fetch(`${BASE}/tournaments?apiKey=${API_KEY}&sportId=${sportId}`);
    const tourStatus = tourRes.status;
    let tourBody;
    try { tourBody = await tourRes.json(); } catch { tourBody = { raw: await tourRes.text() }; }

    if (tourStatus >= 400) {
      return res.status(tourStatus).json({ step: 'tournaments', sportIdUsed: sportId, error: tourBody });
    }

    const list = Array.isArray(tourBody) ? tourBody : (tourBody.tournaments || tourBody.data || []);
    const simplified = list.slice(0, 30).map(t => ({
      id: t.id ?? t.tournamentId ?? t.tournament_id ?? null,
      name: t.name ?? t.tournamentName ?? t.title ?? null,
    }));

    return res.status(200).json({
      sportIdUsed: sportId,
      sportName: chosenSport?.name ?? chosenSport?.sportName ?? 'unknown',
      count: list.length,
      tournaments: simplified,
      rawSample: JSON.stringify(tourBody).slice(0, 500),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
