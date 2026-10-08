// pages/api/debug-22bet-event.js
// Owner-only debug route: dumps ONE 22bet event's raw market data straight from 22bet's own API, so totals and
// spreads can be checked against the 22bet page without going through OddsPapi.
//
// USAGE (mobile friendly, just open the URL):
//   /api/debug-22bet-event?secret=XXXX&id=369147714
//   /api/debug-22bet-event?secret=XXXX&id=369147714&view=raw        full raw JSON (long)
//   /api/debug-22bet-event?secret=XXXX&id=369147714&g=17            only one market group (17 = totals in the 1xBet family)
//   /api/debug-22bet-event?secret=XXXX&id=369147714&via=scraper     route through ScraperAPI (geo-block workaround)
//
// id     = the number at the end of the 22bet link on an arb leg (the "Check price on 22Bet" link).
// secret = must equal the DEBUG_SECRET env var in Vercel. No DEBUG_SECRET set = the route refuses everything.
//
// UNVERIFIED ASSUMPTIONS (this is why the raw view exists): 22bet runs the 1xBet-family engine (Paripesa is a
// confirmed 1xBet white-label). The endpoint path and the group/type codes below are the usual ones for that family
// but have NOT been confirmed for 22bet. Compare the "decoded" table with the 22bet page and trust the raw view if
// they disagree. If 22bet's existing live check (pages/api/verify-arb.js) uses a different host/path, set
// BET22_HOST / BET22_PATH below or via env to match it.

const ALLOWED_HOST = /^(?:[a-z0-9-]+\.)*22bet\.(?:com|net|org|info|[a-z]{2}|(?:com|co)\.[a-z]{2})$/i;
const HOST = process.env.BET22_HOST || '22bet.com.gh';
const PATH = process.env.BET22_PATH || '/service-api/LineFeed/GetGameZip';

// 1xBet-family group ids (G) and type ids (T). Assumed, see note above.
const GROUPS = { 1: '1X2', 2: 'Handicap (Asian handicap)', 8: 'Double chance', 17: 'Total (over/under)', 15: 'Team 1 total', 62: 'Team 2 total' };
const TYPES = {
  1: { 1: 'Home' , 2: 'Draw', 3: 'Away' },
  2: { 7: 'Home handicap', 8: 'Away handicap' },
  17: { 9: 'Over', 10: 'Under' },
  15: { 11: 'Over', 12: 'Under' },
  62: { 13: 'Over', 14: 'Under' },
};

function decode(value) {
  const groups = (value && value.GE) || [];
  const out = [];
  for (const grp of groups) {
    const g = grp.G;
    const rows = [];
    for (const col of grp.E || []) {
      for (const ev of Array.isArray(col) ? col : [col]) {
        rows.push({
          type: (TYPES[g] && TYPES[g][ev.T]) || 'T' + ev.T,
          t: ev.T,
          line: ev.P != null ? ev.P : null,
          price: ev.C,
          blocked: ev.B === true || undefined,
        });
      }
    }
    out.push({ g, name: GROUPS[g] || 'group ' + g, n: rows.length, rows });
  }
  return out;
}

// Group the totals / handicap rows by line so Over/Under (or Home/Away) pairs sit side by side, the way the page shows them.
function byLine(rows) {
  const m = {};
  for (const r of rows) {
    const k = r.line == null ? 'none' : String(r.line);
    (m[k] = m[k] || {})[r.type] = r.price;
  }
  return Object.entries(m)
    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    .map(([line, sides]) => ({ line, ...sides }));
}

export default async function handler(req, res) {
  const secret = process.env.DEBUG_SECRET;
  if (!secret || req.query.secret !== secret) return res.status(401).json({ error: 'unauthorized' });

  const id = String(req.query.id || '');
  if (!/^\d{6,12}$/.test(id)) return res.status(400).json({ error: 'id must be the numeric 22bet event id (6-12 digits)' });

  const host = String(req.query.host || HOST);
  if (!ALLOWED_HOST.test(host)) return res.status(400).json({ error: 'host must be a 22bet domain' });

  const qs = new URLSearchParams({ id, lng: 'en', isSubGames: 'true', GroupEvents: 'true', countevents: '250', grMode: '4', partner: '151', country: '66' });
  let url = 'https://' + host + PATH + '?' + qs.toString();
  if (req.query.via === 'scraper' && process.env.SCRAPERAPI_KEY) {
    url = 'https://api.scraperapi.com/?api_key=' + process.env.SCRAPERAPI_KEY + '&country_code=gh&url=' + encodeURIComponent(url);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let r, text;
  try {
    r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36', Accept: 'application/json', Referer: 'https://' + host + '/' } });
    text = await r.text();
  } catch (err) {
    return res.status(502).json({ error: 'fetch failed', detail: String(err && err.message || err), host, path: PATH });
  } finally { clearTimeout(timer); }

  let json;
  try { json = JSON.parse(text); } catch { return res.status(502).json({ error: 'not JSON', status: r.status, host, path: PATH, bodyStart: text.slice(0, 300) }); }
  if (!r.ok || json.Success === false) return res.status(502).json({ error: 'upstream refused', status: r.status, host, path: PATH, body: JSON.stringify(json).slice(0, 300) });

  const v = json.Value || {};
  if (req.query.view === 'raw') return res.status(200).json({ host, path: PATH, fetchedAt: new Date().toISOString(), raw: json });

  let groups = decode(v);
  if (req.query.g) groups = groups.filter(x => String(x.g) === String(req.query.g));

  res.status(200).json({
    host, path: PATH, fetchedAt: new Date().toISOString(),
    match: [v.O1, v.O2].filter(Boolean).join(' vs ') || null,
    league: v.L || null,
    kickoffUnix: v.S || null,
    groupsFound: groups.map(x => x.g + ':' + x.name + ' (' + x.n + ')'),
    // Over/Under and handicap pairs by line, ready to compare with the 22bet page.
    totals: byLine((groups.find(x => x.g === 17) || { rows: [] }).rows),
    handicaps: byLine((groups.find(x => x.g === 2) || { rows: [] }).rows),
    decoded: req.query.g ? groups : undefined,
    note: 'Codes assumed from the 1xBet family, unverified for 22bet. If these rows disagree with the page, use &view=raw.',
  });
}
