export default async function handler(req, res) {
  const API_KEY = process.env.ODDSPAPI_KEY;
  const BASE = 'https://api.oddspapi.io/v4';

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

    // Broad fuzzy match on slug AND name this time — catches things like
    // "msport.gh" or a display name containing "Ghana" that a slug-only
    // search would miss.
    const msportVariants = list.filter(b => {
      const slug = (b.slug || '').toLowerCase();
      const name = (b.bookmakerName || b.name || '').toLowerCase();
      return slug.includes('msport') || name.includes('msport') || name.includes('m-sport');
    });

    // Separately, anything mentioning Ghana specifically — in case MSport GH
    // is listed under a totally different slug we wouldn't think to search.
    const ghanaVariants = list.filter(b => {
      const name = (b.bookmakerName || b.name || '').toLowerCase();
      return name.includes('ghana') || name.includes(' gh') || name.endsWith('gh');
    });

    return res.status(200).json({
      totalBookmakers: list.length,
      msportVariants,
      ghanaVariants,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
