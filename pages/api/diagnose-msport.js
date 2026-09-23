// pages/api/diagnose-msport-coverage.js
export default async function handler(req, res) {
  const API_KEY = process.env.ODDSPAPI_KEY;
  const r = await fetch(`https://api.oddspapi.io/v4/bookmakers?apiKey=${API_KEY}`);
  const body = await r.json();
  const list = Array.isArray(body) ? body : (body.bookmakers || body.data || []);
  const msport = list.find(b => (b.slug || b.id || b.name) === 'msport');
  return res.status(200).json({ msportEntry: msport || 'not found in list' });
}
