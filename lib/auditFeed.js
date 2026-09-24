// lib/auditFeed.js
// Data-quality audit across bookmaker feeds for ONE league. Pure logic (no
// network). It does not assume anything is right: it measures internal
// consistency and cross-book agreement, and prints concrete examples so they
// can be checked by hand against the bookmaker's own page.
//
// Input: { betano: [events], '22bet': [events], ... } where each event is the
// app's normalised shape { home_team, away_team, commence_time, bookmakers:[{markets:[{key, outcomes:[{name,price,point}]}]}] }.

const alnum = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const fuzzy = (a, b) => { const x = alnum(a), y = alnum(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
const median = arr => { const a = [...arr].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

function sideOf(name, ev) {
  const n = alnum(name);
  if (n === 'draw' || n === 'x') return 'draw';
  if (n === '1' || n === 'home' || fuzzy(name, ev.home_team)) return 'home';
  if (n === '2' || n === 'away' || fuzzy(name, ev.away_team)) return 'away';
  return null;
}

// Pull comparable quotes out of one book's event: {h2h:{home,draw,away}, totals:{line:{over,under}}, spreads:{homeLine:{home,away}}}
function extract(ev) {
  const out = { h2h: null, totals: {}, spreads: {}, dupes: 0 };
  const bm = (ev.bookmakers || [])[0];
  if (!bm) return out;
  for (const m of bm.markets || []) {
    if (m.key === 'h2h') {
      const h = {};
      for (const o of m.outcomes || []) { const s = sideOf(o.name, ev); if (s && o.price > 1) h[s] = o.price; }
      if (out.h2h) out.dupes++; else out.h2h = h;
    } else if (m.key === 'totals') {
      for (const o of m.outcomes || []) {
        const n = String(o.name).trim().toLowerCase();
        if ((n !== 'over' && n !== 'under') || typeof o.point !== 'number' || !(o.price > 1)) continue;
        out.totals[o.point] = out.totals[o.point] || {};
        if (out.totals[o.point][n] && out.totals[o.point][n] !== o.price) out.dupes++;
        out.totals[o.point][n] = o.price;
      }
    } else if (m.key === 'spreads') {
      for (const o of m.outcomes || []) {
        const s = sideOf(o.name, ev);
        if ((s !== 'home' && s !== 'away') || typeof o.point !== 'number' || !(o.price > 1)) continue;
        const line = s === 'home' ? o.point : -o.point;      // home-perspective line
        out.spreads[line] = out.spreads[line] || {};
        if (out.spreads[line][s] && out.spreads[line][s] !== o.price) out.dupes++;
        out.spreads[line][s] = o.price;
      }
    }
  }
  return out;
}

function groupMatches(eventsByBook) {
  const groups = [];
  for (const [book, events] of Object.entries(eventsByBook)) {
    for (const ev of events || []) {
      let g = groups.find(x => fuzzy(x.home, ev.home_team) && fuzzy(x.away, ev.away_team) && Math.abs(new Date(x.time) - new Date(ev.commence_time)) < 30 * 60000);
      if (!g) { g = { home: ev.home_team, away: ev.away_team, time: ev.commence_time, byBook: {} }; groups.push(g); }
      g.byBook[book] = { ev, q: extract(ev) };
    }
  }
  return groups;
}

function stat() { return { n: 0, bad: 0, min: null, max: null, sum: 0 }; }
function add(s, v, bad) { s.n++; s.sum += v; s.min = s.min === null ? v : Math.min(s.min, v); s.max = s.max === null ? v : Math.max(s.max, v); if (bad) s.bad++; }
const fin = s => s.n ? { n: s.n, bad: s.bad, min: +s.min.toFixed(3), avg: +(s.sum / s.n).toFixed(3), max: +s.max.toFixed(3) } : { n: 0 };

function auditEvents(eventsByBook) {
  const groups = groupMatches(eventsByBook);
  const books = Object.keys(eventsByBook);
  const perBook = {};
  for (const b of books) perBook[b] = { events: (eventsByBook[b] || []).length, h2hOverround: stat(), totalsOverround: stat(), spreadsOverround: stat(), totalsLadderViolations: 0, spreadsLadderViolations: 0, ahHalfVs1x2: stat(), duplicateConflicts: 0, examples: [] };
  const ratios = {}; // "book|type|side" -> {n, sumLog, off10, worst}

  for (const g of groups) {
    const label = g.home + ' vs ' + g.away;
    for (const [book, { q }] of Object.entries(g.byBook)) {
      const P = perBook[book];
      P.duplicateConflicts += q.dupes;
      if (q.h2h && q.h2h.home && q.h2h.away) {
        const sides = Object.values(q.h2h); const imp = sides.reduce((s, p) => s + 1 / p, 0);
        const complete = sides.length === 3 || (sides.length === 2 && !q.h2h.draw);
        if (complete) { const bad = imp < 1.0 || imp > 1.2; add(P.h2hOverround, imp, bad); if (bad && P.examples.length < 4) P.examples.push({ match: label, issue: '1X2 overround ' + imp.toFixed(3), prices: q.h2h }); }
      }
      const tl = Object.keys(q.totals).map(Number).sort((a, b) => a - b);
      for (const L of tl) { const t = q.totals[L]; if (t.over && t.under) { const imp = 1 / t.over + 1 / t.under; const bad = imp < 1.0 || imp > 1.25; add(P.totalsOverround, imp, bad); if (bad && P.examples.length < 4) P.examples.push({ match: label, issue: 'Total ' + L + ' overround ' + imp.toFixed(3), prices: t }); } }
      for (let i = 1; i < tl.length; i++) { const a = q.totals[tl[i - 1]], b = q.totals[tl[i]];
        if (a.over && b.over && b.over < a.over * 0.99) P.totalsLadderViolations++;
        if (a.under && b.under && b.under > a.under * 1.01) P.totalsLadderViolations++; }
      const sl = Object.keys(q.spreads).map(Number).sort((a, b) => a - b);
      for (const L of sl) { const s = q.spreads[L]; if (s.home && s.away) { const imp = 1 / s.home + 1 / s.away; add(P.spreadsOverround, imp, imp < 1.0 || imp > 1.25); } }
      for (let i = 1; i < sl.length; i++) { const a = q.spreads[sl[i - 1]], b = q.spreads[sl[i]]; if (a.home && b.home && b.home > a.home * 1.01) P.spreadsLadderViolations++; }
      // AH home -0.5 should be ~ the 1X2 home price
      if (q.spreads[-0.5] && q.spreads[-0.5].home && q.h2h && q.h2h.home) { const r = q.spreads[-0.5].home / q.h2h.home; add(P.ahHalfVs1x2, r, Math.abs(r - 1) > 0.05); }
    }

    // Cross-book: each book's price vs the median of the OTHER books, same match/market/line/side
    const slots = []; // {type, key, side, book, price}
    for (const [book, { q }] of Object.entries(g.byBook)) {
      if (q.h2h) for (const [s, p] of Object.entries(q.h2h)) slots.push({ type: 'h2h', key: 'h2h', side: s, book, price: p });
      for (const [L, t] of Object.entries(q.totals)) for (const [s, p] of Object.entries(t)) slots.push({ type: 'totals', key: 'totals_' + L, side: s, book, price: p });
      for (const [L, t] of Object.entries(q.spreads)) for (const [s, p] of Object.entries(t)) slots.push({ type: 'spreads', key: 'spreads_' + L, side: s, book, price: p });
    }
    for (const x of slots) {
      const others = slots.filter(y => y.key === x.key && y.side === x.side && y.book !== x.book).map(y => y.price);
      if (others.length < 2) continue;
      const med = median(others), r = x.price / med;
      const k = x.book + '|' + x.type + '|' + x.side;
      const R = ratios[k] = ratios[k] || { n: 0, sumLog: 0, off10: 0, worst: null };
      R.n++; R.sumLog += Math.log(r); if (Math.abs(r - 1) > 0.10) R.off10++;
      if (!R.worst || Math.abs(r - 1) > Math.abs(R.worst.ratio - 1)) R.worst = { ratio: +r.toFixed(3), match: label, market: x.key, price: x.price, otherBooksMedian: +med.toFixed(3), othersCount: others.length };
    }
  }

  const summary = {};
  for (const b of books) { const P = perBook[b];
    summary[b] = { events: P.events, h2hOverround: fin(P.h2hOverround), totalsOverround: fin(P.totalsOverround), spreadsOverround: fin(P.spreadsOverround), totalsLadderViolations: P.totalsLadderViolations, spreadsLadderViolations: P.spreadsLadderViolations, ah_minus0_5_vs_1x2_home_ratio: fin(P.ahHalfVs1x2), duplicateConflicts: P.duplicateConflicts, examples: P.examples }; }
  const crossBook = Object.entries(ratios).map(([k, R]) => { const [book, type, side] = k.split('|'); return { book, type, side, n: R.n, meanRatioVsOthers: +Math.exp(R.sumLog / R.n).toFixed(3), shareOff10pct: +(R.off10 / R.n).toFixed(2), worst: R.worst }; })
    .sort((a, b) => Math.abs(b.meanRatioVsOthers - 1) - Math.abs(a.meanRatioVsOthers - 1));
  const flags = [];
  for (const c of crossBook) if (c.n >= 8 && Math.abs(c.meanRatioVsOthers - 1) > 0.04) flags.push(c.book + ' ' + c.type + ' ' + c.side + ': prices average ' + ((c.meanRatioVsOthers - 1) * 100).toFixed(1) + '% vs the other books (n=' + c.n + ')');
  for (const b of books) { const S = summary[b];
    if (S.h2hOverround.bad || S.totalsOverround.bad || S.spreadsOverround.bad) flags.push(b + ': ' + (S.h2hOverround.bad || 0) + ' 1X2, ' + (S.totalsOverround.bad || 0) + ' totals, ' + (S.spreadsOverround.bad || 0) + ' handicap markets with an impossible overround (<100% or >120-125%)');
    if (S.totalsLadderViolations || S.spreadsLadderViolations) flags.push(b + ': ' + S.totalsLadderViolations + ' totals and ' + S.spreadsLadderViolations + ' handicap lines out of order');
    if (S.ah_minus0_5_vs_1x2_home_ratio.bad) flags.push(b + ': AH -0.5 home price differs >5% from the 1X2 home price in ' + S.ah_minus0_5_vs_1x2_home_ratio.bad + ' matches');
    if (S.duplicateConflicts) flags.push(b + ': ' + S.duplicateConflicts + ' selections quoted at two different prices'); }
  return { matchesSeenByAtLeastOneBook: groups.length, matchesSeenByTwoPlusBooks: groups.filter(g => Object.keys(g.byBook).length >= 2).length, flags, perBook: summary, crossBook: crossBook.slice(0, 12) };
}

module.exports = { auditEvents };
