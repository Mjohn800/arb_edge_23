export default async function handler(req, res) {
  const API_KEY = process.env.ODDSPAPI_KEY;
  const BASE = 'https://api.oddspapi.io/v4';
 const SEARCH_TERMS = ['msport', 'mozzart', 'melbet', 'betway'];

  if (!API_KEY) {
    return res.status(500).json({ error: 'Missing ODDSPAPI_KEY env var' });
  }

  try {
    const r = await fetch(`${BASE}/bookmakers?apiKey=${API_KEY}`);
    const status = r.status;
    let body;
    try { body = await r.json(); } catch { body = { raw: await r.text() }; }

    if (status >= 400) {
      return res.status(status).json({ error: body });
    }

    const list = Array.isArray(body) ? body : (body.bookmakers || body.data || []);

    // Show everything so we can see the real naming convention
    const allSlugs = list.map(b => b.slug ?? b.id ?? b.name ?? JSON.stringify(b));

    // Fuzzy-match against our search terms
    const matches = {};
    for (const term of SEARCH_TERMS) {
      matches[term] = allSlugs.filter(s => String(s).toLowerCase().includes(term));
    }

    return res.status(200).json({
      totalBookmakers: list.length,
      matches,
      allSlugsSample: allSlugs.slice(0, 60),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
