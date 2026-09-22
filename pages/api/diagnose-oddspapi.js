export default async function handler(req, res) {
  const API_KEY = process.env.ODDSPAPI_KEY;
  const TOURNAMENT_ID = process.env.TEST_TOURNAMENT_ID;
  const BASE_URL = 'https://api.oddspapi.io/v4/odds-by-tournaments';
  const BOOKS = ['msport', 'mozzart', 'melbet'];

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

  function seenBooks(body) {
    const str = JSON.stringify(body).toLowerCase();
    return BOOKS.filter(b => str.includes(b));
  }

  const combined = await callOddsPapi(BOOKS.join(','));
  const combinedSeen = seenBooks(combined.body);

  const separate = {};
  for (const book of BOOKS) {
    const r = await callOddsPapi(book);
    separate[book] = { status: r.status, seen: seenBooks(r.body) };
    await new Promise(r2 => setTimeout(r2, 300));
  }

  let verdict;
  if (combinedSeen.length === BOOKS.length) verdict = 'Comma-separated param WORKS — all 3 books in one call.';
  else if (combinedSeen.length <= 1) verdict = 'Comma-separated param likely IGNORED — use separate calls per bookmaker.';
  else verdict = 'Ambiguous — inspect raw below manually.';

  return res.status(200).json({
    verdict,
    combinedCallStatus: combined.status,
    combinedBooksSeen: combinedSeen,
    separateCalls: separate,
    combinedRawSample: JSON.stringify(combined.body).slice(0, 800),
  });
}
