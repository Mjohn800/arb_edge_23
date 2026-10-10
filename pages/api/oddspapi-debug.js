// pages/api/oddspapi-debug.js
//
// Admin-only diagnostic: shows what OddsPapi returns for ONE fixture (spreads / totals / 1x2),
// side by side for 22bet and Betano, so you can compare each line with the bookmaker's own page.
// It also tests the "22bet's prices sit one line over from their label" theory.
//
// Needs env ADMIN_DEBUG_TOKEN (404s without it). Uses the cached 4-minute fixture pull when it
// is fresh, otherwise 1 OddsPapi call per bookmaker. 0 Odds API credits.
//
//   Arsenal vs Leeds, spreads, 22bet vs Betano (default):
//     /api/oddspapi-debug?token=TOKEN
//   Totals instead:
//     /api/oddspapi-debug?token=TOKEN&type=totals
//   Another match / league / only some lines:
//     /api/oddspapi-debug?token=TOKEN&sport=soccer_netherlands_eredivisie&team=ajax&lines=-1.75,-2.25
//   One bookmaker only, with the untouched OddsPapi data for those markets:
//     /api/oddspapi-debug?token=TOKEN&book=22bet&raw=1
//   Machine-readable output:
//     add &format=json
//
// 1xbet: /api/oddspapi-debug?token=TOKEN&book=1xbet&team=arsenal&type=totals&lines=2.5 (prints the link host of the feed's fixtures)
// Params: token, sport (default soccer_epl), team (name fragment, default arsenal),
//         type (spreads | totals | 1x2, default spreads), lines (comma list), book (22bet |
//         betano | melbet | all, default all = 22bet + betano), halves=1 (also show first/second-
//         half markets; hidden by default), raw=1, format=text|json.

import { ODDSPAPI_TOURNAMENT_MAP } from '../../lib/oddspapi-wa';
import { debugFixtureMarkets } from '../../lib/oddspapi';

export const config = { maxDuration: 60 };

const BOOKS_ALL = ['22bet', 'betano'];
const ALLOWED_BOOKS = new Set(['22bet', 'betano', 'melbet', '1xbet']); // 1xbet added 10 Oct 2026 to see which regional site its OddsPapi feed links to

// Hostname of a bookmaker fixture link (e.g. '1xbet.com' vs '1xbet.com.gh'), so the feed's regional site is visible.
const hostOf = u => {
  if (!u) return null;
  try { return new URL(String(u)).hostname; } catch { const m = String(u).match(/^(?:https?:\/\/)?([^\/\s]+)/); return m ? m[1] : null; }
};
const FLAG_PCT = 12; // flag a >12% gap between two books on the same line

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

// "1:2.44 2:1.45" (or an array of those) -> { '1': 2.44, '2': 1.45 }
function parsePrices(prices) {
  const s = Array.isArray(prices) ? prices.join(' ') : String(prices == null ? '' : prices);
  const out = {};
  for (const m of s.matchAll(/([A-Za-z0-9]+):([0-9]+(?:\.[0-9]+)?|inactive)/g)) out[m[1]] = m[2] === 'inactive' ? null : num(m[2]);
  return out;
}

const pct = (a, b) => (a && b ? ((a / b - 1) * 100) : null);
const fmt = (n, d = 1) => (n == null ? '-' : (n > 0 ? '+' : '') + n.toFixed(d));

// Does 22bet's price at line L look like Betano's price at line L+offset? Mean absolute %
// difference of outcome "1" (or Over) over every line both books list. Offset 0 should win when
// the feed is labelled correctly; a different winner means the feed's labels are shifted.
function shiftTest(rowsByBook, a = '22bet', b = 'betano') {
  const A = rowsByBook[a], B = rowsByBook[b];
  if (!A || !B) return null;
  const first = p => (p['1'] != null ? p['1'] : p.Over != null ? p.Over : p.over != null ? p.over : null);
  const mapOf = rows => {
    const m = new Map();
    for (const r of rows) {
      const px = first(parsePrices(r.prices));
      if (r.line != null && px) m.set(Math.round(r.line * 100) / 100, px);
    }
    return m;
  };
  const mA = mapOf(A), mB = mapOf(B);
  const results = [];
  for (const off of [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]) {
    let sum = 0, n = 0;
    for (const [line, pa] of mA) {
      const pb = mB.get(Math.round((line + off) * 100) / 100);
      if (pb) { sum += Math.abs(pa / pb - 1); n++; }
    }
    if (n >= 3) results.push({ offset: off, meanAbsDiffPct: +(sum / n * 100).toFixed(1), linesCompared: n });
  }
  results.sort((x, y) => x.meanAbsDiffPct - y.meanAbsDiffPct);
  return results.length ? results : null;
}

export default async function handler(req, res) {
  const token = process.env.ADMIN_DEBUG_TOKEN;
  if (!token || req.query.token !== token) return res.status(404).json({ error: 'not_found' });
  res.setHeader('Cache-Control', 'no-store');
  // Behind the token check, so it is safe to show the real error instead of an opaque 500.
  try {
    return await run(req, res);
  } catch (err) {
    console.error('[oddspapi-debug] crashed', err);
    return res.status(500).json({
      error: 'debug_route_crashed',
      message: String(err && err.message ? err.message : err),
      where: String(err && err.stack ? err.stack : '').split('\n').slice(0, 4).map(l => l.trim()),
      imports: { tournamentMap: typeof ODDSPAPI_TOURNAMENT_MAP, debugFixtureMarkets: typeof debugFixtureMarkets },
    });
  }
}

async function run(req, res) {

  const sport = String(req.query.sport || 'soccer_epl');
  const team = String(req.query.team || 'arsenal');
  const type = String(req.query.type || 'spreads');
  const wantJson = req.query.format === 'json';
  const wantRaw = req.query.raw === '1' || req.query.raw === 'true';
  const lines = req.query.lines
    ? String(req.query.lines).split(',').map(s => parseFloat(s)).filter(Number.isFinite)
    : [];
  const bookParam = String(req.query.book || 'all');
  const books = bookParam === 'all' ? BOOKS_ALL : bookParam.split(',').filter(b => ALLOWED_BOOKS.has(b));

  if (req.query.sport === 'list') return res.status(200).json({ sports: Object.keys(ODDSPAPI_TOURNAMENT_MAP) });
  const mapping = ODDSPAPI_TOURNAMENT_MAP[sport];
  if (!mapping) return res.status(400).json({ error: 'unknown_sport', hint: 'try ?sport=list' });
  if (!books.length) return res.status(400).json({ error: 'no_valid_book', allowed: [...ALLOWED_BOOKS] });

  const filter = { type, lines, raw: wantRaw };
  const rawLine = lines.length === 1 ? lines[0] : undefined;

  const results = {};
  for (const book of books) {
    try {
      results[book] = await debugFixtureMarkets(book, mapping.tournamentId, mapping.sportId, team, rawLine, filter);
    } catch (err) {
      results[book] = { error: String(err && err.message ? err.message : err) };
    }
  }

  // Half-time markets share a line number with the full-time market (e.g. "Over 2.5" exists for
  // the whole match AND for the second half), so they are hidden unless halves=1. Without this
  // filter one market would silently overwrite the other in the side-by-side view.
  const includeHalves = req.query.halves === '1' || req.query.halves === 'true';
  const isHalfMarket = r => /half|1st|2nd/i.test(String(r.marketName || ''));
  const rowsByBook = {};
  for (const book of books) {
    const all = (results[book] && results[book].markets) || (results[book] && results[book].rows) || [];
    rowsByBook[book] = includeHalves ? all : all.filter(r => !isHalfMarket(r));
  }
  const shift = rowsByBook['22bet'] && rowsByBook['betano'] ? shiftTest(rowsByBook) : null;

  if (wantJson) return res.status(200).json({ sport, team, type, books, results, shiftTest: shift });

  // ── plain-text report, laid out for a phone screen ─────────────────────────
  const out = [];
  out.push(`OddsPapi debug | ${sport} | "${team}" | ${type}${lines.length ? ' | lines ' + lines.join(',') : ''}`);
  for (const book of books) {
    const r = results[book];
    if (!r) continue;
    if (r.error) { out.push(`[${book}] ${r.error}${r.available ? ' | available: ' + r.available.slice(0, 8).join('; ') : ''}`); continue; }
    out.push(`[${book}] ${r.match || '?'} | fixtures for this pair in feed: ${r.fixturesForThisPairInFeed != null ? r.fixturesForThisPairInFeed : '?'}${r.startTime ? ' | start ' + r.startTime : ''}`);
    // Which regional site does this bookmaker's feed link to? (host of each fixturePath for this pair)
    const links = (r.sameTeamFixtures || []).map(f => f.fixturePath).filter(Boolean);
    const hosts = [...new Set(links.map(hostOf).filter(Boolean))];
    out.push(`[${book}] link host: ${hosts.length ? hosts.join(', ') : '(no fixturePath in feed)'}${links[0] ? ' | e.g. ' + links[0] : ''}`);
  }
  out.push('');

  // group rows by market type + line across books
  const grouped = new Map();
  for (const book of books) {
    for (const row of rowsByBook[book] || []) {
      const k = `${row.marketType}|${row.line == null ? '' : row.line}|${row.marketName}`;
      if (!grouped.has(k)) grouped.set(k, { marketType: row.marketType, marketName: row.marketName, line: row.line, perBook: {} });
      grouped.get(k).perBook[book] = row;
    }
  }
  const ordered = [...grouped.values()].sort((a, b) => (a.marketType + '').localeCompare(b.marketType + '') || (a.line ?? 0) - (b.line ?? 0) || String(a.marketName).localeCompare(String(b.marketName)));
  if (!ordered.length) out.push('No matching markets returned (check type/lines, or the fixture may have no odds yet).');
  if (!includeHalves) out.push('(half-time markets hidden; add &halves=1 to show them)');

  for (const g of ordered) {
    out.push(`${g.marketType} line ${g.line == null ? '-' : g.line}${includeHalves ? '  (' + g.marketName + ')' : ''}`);
    for (const book of books) {
      const row = g.perBook[book];
      out.push(row
        ? `  ${book.padEnd(6)} ${String(row.prices)}  [id ${row.marketId} "${row.marketName}"${row.whitelisted ? '' : ', NOT whitelisted'}]`
        : `  ${book.padEnd(6)} -`);
    }
    // gap between the first two books on the same line
    if (books.length >= 2 && g.perBook[books[0]] && g.perBook[books[1]]) {
      const pa = parsePrices(g.perBook[books[0]].prices), pb = parsePrices(g.perBook[books[1]].prices);
      const diffs = Object.keys(pa).filter(k => pb[k] != null && pa[k] != null).map(k => ({ k, d: pct(pa[k], pb[k]) }));
      if (diffs.length) {
        const bad = diffs.some(x => Math.abs(x.d) > FLAG_PCT);
        out.push(`  gap ${books[0]} vs ${books[1]}: ${diffs.map(x => x.k + ' ' + fmt(x.d) + '%').join('  ')}${bad ? '   <-- over ' + FLAG_PCT + '%' : ''}`);
      }
    }
  }

  if (shift) {
    out.push('');
    out.push('Line-shift test (22bet vs Betano, outcome 1 / Over). offset = which Betano line 22bet\'s price matches best:');
    shift.slice(0, 4).forEach((s, i) => out.push(`  ${i === 0 ? '>>' : '  '} offset ${s.offset > 0 ? '+' : ''}${s.offset}: mean gap ${s.meanAbsDiffPct}% over ${s.linesCompared} lines`));
    const best = shift[0];
    out.push(best.offset === 0
      ? '  => labels line up (offset 0 fits best).'
      : `  => 22bet's prices fit Betano's lines SHIFTED by ${best.offset > 0 ? '+' : ''}${best.offset}; its labels look off by that much.`);
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(out.join('\n'));
}
