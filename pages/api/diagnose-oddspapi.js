export default async function handler(req, res) {
  const API_KEY = process.env.ODDSPAPI_KEY;
  const TOURNAMENT_ID = process.env.TEST_TOURNAMENT_ID;
  const BASE_URL = 'https://api.oddspapi.io/v4/odds-by-tournaments';

  if (!API_KEY || !TOURNAMENT_ID) {
    return res.status(500).json({ error: 'Missing ODDSPAPI_KEY or TEST_TOURNAMENT_ID env var' });
  }

  async function callOddsPapi(bookmakerParam) {
    const url = `${BASE_URL}?apiKey=${API_KEY}&tournamentIds=${TOURNAMENT_ID}&bookmaker=${bookmakerParam}`;
    const r = await fetch(url);
    let body;
    try { body = await r.json(); } catch { body = { raw: await r.text() }; }
    return { status: r.status, body };
  }

  // One clean call — just msport, no repeated tests, no wasted quota.
  const result = await callOddsPapi('msport');

  if (result.status >= 400) {
    return res.status(200).json({
      note: 'Call failed — inspect error below',
      status: result.status,
      body: result.body,
    });
  }

  // Figure out the top-level shape (array vs object with a wrapper key)
  const topLevelKeys = Array.isArray(result.body) ? 'ARRAY' : Object.keys(result.body || {});
  const fixtures = Array.isArray(result.body) ? result.body : (result.body?.fixtures || result.body?.data || []);

  return res.status(200).json({
    status: result.status,
    topLevelShape: topLevelKeys,
    fixtureCount: fixtures.length,
    // The full, untruncated first fixture — this is what we actually need
    fullFirstFixture: fixtures[0] || 'no fixtures returned',
    // A second one too, in case the first is missing fields (e.g. no odds yet)
    fullSecondFixture: fixtures[1] || 'only one fixture available',
  });
}
