// lib/verifyArb.js
// Re-checks the legs of one arb against a FRESH pull from each leg's own
// source. Pure logic — the fetchers are injected so it can be tested without
// network calls. See pages/api/verify-arb.js for the real wiring.

const PRICE_TOL = 0.005;
const TIME_TOL_MS = 30 * 60 * 1000;

const alnum = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function fuzzyMatch(a, b) {
  if (!a || !b) return false;
  const na = alnum(a), nb = alnum(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

function findEvent(events, arb) {
  return (events || []).find(ev =>
    fuzzyMatch(ev.home_team, arb.home) &&
    fuzzyMatch(ev.away_team, arb.away) &&
    Math.abs(new Date(ev.commence_time) - new Date(arb.commenceTime)) < TIME_TOL_MS
  );
}

// Which side of THIS fetched event does an outcome name belong to?
function sideOf(name, fe) {
  const n = alnum(name);
  if (n === 'draw' || n === 'x') return '__draw__';
  if (n === alnum(fe.home_team) || n === '1' || n === 'home') return '__home__';
  if (n === alnum(fe.away_team) || n === '2' || n === 'away') return '__away__';
  return null;
}

function findLegPrice(fe, book, arb, leg) {
  const bm = (fe.bookmakers || []).find(b => b.key === book) || (fe.bookmakers || [])[0];
  const mkt = bm && (bm.markets || []).find(m => m.key === leg.marketKey);
  if (!mkt) return null;
  for (const o of mkt.outcomes || []) {
    if (!(o.price > 1)) continue;
    if (leg.marketKey === 'totals') {
      if (String(o.name).trim().toLowerCase() === leg.side && typeof o.point === 'number' && Math.abs(o.point - leg.point) < 1e-9) return o.price;
    } else if (leg.marketKey === 'spreads') {
      if (sideOf(o.name, fe) === leg.side && typeof o.point === 'number' && Math.abs(o.point - leg.point) < 1e-9) return o.price;
    } else if (leg.marketKey === 'h2h') {
      if (sideOf(o.name, fe) === leg.side) return o.price;
    }
  }
  return null;
}

/**
 * arb: { sport, home, away, commenceTime, outcomes: [{ book, side, marketKey, point, odds }] }
 * fetchers: { [bookKey]: async (sportKey) => ({ events, status }) }
 */
async function verifyArbLegs(arb, fetchers) {
  const books = [...new Set(arb.outcomes.map(o => o.book))];
  const fetched = {};
  await Promise.all(books.map(async book => {
    if (!fetchers[book]) { fetched[book] = { skipped: true }; return; }
    try {
      const r = await fetchers[book](arb.sport);
      fetched[book] = r && r.status && r.status.ok === false
        ? { error: r.status.reason || 'fetch failed' }
        : { events: (r && r.events) || [] };
    } catch (err) {
      fetched[book] = { error: err.message };
    }
  }));

  const legs = arb.outcomes.map(o => {
    const f = fetched[o.book];
    const base = { book: o.book, label: o.label, was: o.odds };
    if (f.skipped) return { ...base, status: 'not_rechecked', now: null };
    if (f.error) return { ...base, status: 'error', now: null, detail: f.error };
    const fe = findEvent(f.events, arb);
    if (!fe) return { ...base, status: 'event_not_found', now: null };
    const now = findLegPrice(fe, o.book, arb, o);
    if (now == null) return { ...base, status: 'selection_gone', now: null };
    return { ...base, status: Math.abs(now - o.odds) <= PRICE_TOL ? 'confirmed' : 'moved', now };
  });

  const unavailable = legs.some(l => ['selection_gone', 'event_not_found', 'error'].includes(l.status));
  const skipped = legs.some(l => l.status === 'not_rechecked');
  const prices = legs.map(l => (l.now != null ? l.now : l.was));
  const imp = prices.reduce((s, p) => s + 1 / p, 0);
  const freshMargin = parseFloat((((1 - imp) / imp) * 100).toFixed(2));

  let verdict;
  if (unavailable) verdict = 'unavailable';
  else if (freshMargin <= 0) verdict = 'gone';
  else if (skipped) verdict = 'partial';
  else verdict = 'confirmed';

  return { verdict, freshMargin: unavailable ? null : freshMargin, legs, checkedAt: new Date().toISOString() };
}

module.exports = { verifyArbLegs };
