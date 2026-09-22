export default async function handler(req, res) {
  const API_KEY = process.env.ODDSPAPI_KEY;
  const TOURNAMENT_ID = process.env.TEST_TOURNAMENT_ID;
  const BASE_URL = 'https://api.oddspapi.io/v4/odds-by-tournaments';
  const BOOKS = ['msport', 'mozzartbet', 'melbet', 'betway'];

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

  async function callWithoutBookmaker() {
    const url = `${BASE_URL}?apiKey=${API_KEY}&tournamentIds=${TOURNAMENT_ID}`;
    const r = await fetch(url);
    let body;
    try { body = await r.json(); } catch { body = { raw: await r.text() }; }
    return { status: r.status, body };
  }

  // Only look inside actual odds data (bookmakerOdds keys), not the whole
  // response — avoids false positives from error messages listing valid slugs.
  function booksInResponse(body) {
    if (!body || typeof body !== 'object') return [];
    const found = new Set();
    const fixtures = Array.isArray(body) ? body : (body.fixtures || body.data || [body]);
    for (const fixture of fixtures) {
      const odds = fixture?.bookmakerOdds;
      if (odds && typeof odds === 'object') {
        for (const key of Object.keys(odds)) found.add(key);
      }
    }
    return [...found];
  }

  // Test 1: comma-separated bookmaker param
  const combined = await callOddsPapi(BOOKS.join(','));
  const combinedSeen = booksInResponse(combined.body);

  // Test 2: separate call per bookmaker
  const separate = {};
  for (const book of BOOKS) {
    const r = await callOddsPapi(book);
    separate[book] = { status: r.status, seen: booksInResponse(r.body) };
    await new Promise(r2 => setTimeout(r2, 1500)); // longer gap to avoid 429s
  }

  // Test 3: omit bookmaker param entirely — does it return the full board?
  const noParam = await callWithoutBookmaker();
  const noParamSeen = booksInResponse(noParam.body);

  let verdict;
  if (combined.status >= 400) {
    verdict = `Combined call errored (status ${combined.status}) — see combinedRawSample.`;
  } else if (combinedSeen.length >= 2) {
    verdict = `Comma-separated param WORKS — found ${combinedSeen.length} books in one call: ${combinedSeen.join(', ')}`;
  } else {
    verdict = `Comma-separated param likely IGNORED — only found: ${combinedSeen.join(', ') || '(none)'}`;
  }

  return res.status(200).json({
    verdict,
    combinedCallStatus: combined.status,
    combinedBooksSeen: combinedSeen,
    separateCalls: separate,
    combinedRawSample: JSON.stringify(combined.body).slice(0, 800),
    noBookmakerParamStatus: noParam.status,
    noBookmakerParamBooksSeen: noParamSeen,
    noBookmakerParamCount: noParamSeen.length,
  });
}
