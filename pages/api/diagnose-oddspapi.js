export default async function handler(req, res) {
  const API_KEY = process.env.ODDSPAPI_KEY;
  const BASE = 'https://api.oddspapi.io/v4';

  if (!API_KEY) {
    return res.status(500).json({ error: 'Missing ODDSPAPI_KEY env var' });
  }

  async function get(path) {
    const r = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}apiKey=${API_KEY}`);
    let body;
    try { body = await r.json(); } catch { body = { raw: await r.text() }; }
    return { status: r.status, body };
  }

  // Resolve the two participant IDs from our real fixture (42, 34)
 const participants = await get('/participants?participantIds=42,34&sportId=10');

  // Pull the full soccer market reference table
  const markets = await get('/markets?sportId=10');

  return res.status(200).json({
    participantsStatus: participants.status,
    participants: participants.body,
    marketsStatus: markets.status,
    marketCount: Array.isArray(markets.body) ? markets.body.length : 'not an array',
    // Just the ones we actually saw in our fixture, to confirm the mapping
    relevantMarkets: Array.isArray(markets.body)
      ? markets.body.filter(m => [101, 104, 108, 1010].includes(m.marketId))
      : 'see marketsRaw',
    marketsRawSample: JSON.stringify(markets.body).slice(0, 1500),
  });
}
