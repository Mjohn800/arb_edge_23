// pages/api/verify-top-candidates.js
//
// Auto-verification for the highest-value/highest-risk arb candidates from a
// scan, BEFORE they're shown. Unlike /api/verify-arb (the manual "recheck"
// button, which the user triggers on one arb they're already looking at),
// this is called automatically right after findArbs() runs, on a small
// shortlist (top N by margin, or anything clearing HIGH_MARGIN_REVIEW) —
// see index.js's verifyTopCandidates() for the client side of this.
//
// WHY THIS QUERIES THE BOOKMAKER'S OWN API, NOT ODDSPAPI AGAIN:
// The bad-data cases we've hit (fabricated same-book multi-leg arbs, stale
// fixture links) originated AT OddsPapi — re-querying OddsPapi a second time
// would just ask the same possibly-broken source the same question. The only
// thing that gives real certainty is what the app's own UI already tells the
// user to do by hand: check the bookmaker's own page/API directly. This route
// automates exactly that, for whichever books we have a per-event API for.
//
// LIVE_VERIFIABLE_BOOKS: a book only goes in this set once it has a function
// here that can fetch ONE event fresh from that book's OWN platform (not
// OddsPapi). Right now that's just 22bet, via fetch22BetEventDetail (see
// scrapers/22bet.js) — reused here exactly as the WA scraper itself uses it,
// so this route can never drift out of sync with how normalise22BetEvent
// actually parses that book's response shape.
//
// betano and melbet are BOTH still OddsPapi-only sources (see the WA-scraper
// note in odds.js: "melbet is sourced via OddsPapi rather than direct
// scraping") — until one of them gets its own per-event API call the way
// 22bet has, there is no independent source to check them against, so their
// legs are marked "uncheckable" rather than silently trusted or silently
// dropped.
import { getUserPlan } from '../../lib/serverAuth';
import { fetch22BetEventDetail, normalise22BetEvent } from './scrapers/22bet';

const LIVE_VERIFIABLE_BOOKS = new Set(['22bet']);

// Fresh price within this band of the shown price still counts as "confirmed"
// (normal 22bet-side rounding/latency), not "moved".
const PRICE_TOLERANCE = 0.03; // 3%

// How many distinct legs (across ALL candidates in one request) this route
// will actually fetch live. Each one is a real request to 22bet (or, if their
// session cookie needs refreshing, a ScraperAPI-proxied one) — cap it so an
// unusually large candidate list can't turn into a burst of expensive calls.
const MAX_LEGS_PER_REQUEST = 10;

// A candidate only gets checked at all if it clears one of these — matches
// the same HIGH_MARGIN_REVIEW threshold findArbs() already uses client-side,
// plus a flat top-N so a quiet scan with no high-margin hits still gets its
// best few candidates checked.
const HIGH_MARGIN_REVIEW = 5;
const TOP_N = 3;

function pickCandidatesToVerify(candidates) {
  const sorted = [...candidates].sort((a, b) => b.margin - a.margin);
  const picked = new Set();
  sorted.slice(0, TOP_N).forEach(c => picked.add(c.id));
  sorted.filter(c => c.margin >= HIGH_MARGIN_REVIEW).forEach(c => picked.add(c.id));
  return sorted.filter(c => picked.has(c.id));
}

// Finds the outcome the arb actually used inside a freshly-fetched event
// (h2h only — 22bet's totals/spreads normalisation is still a TODO in
// normalise22BetEvent itself, so those legs are reported uncheckable too,
// not guessed at).
function findFreshPrice(freshEvent, leg) {
  const mkt = (freshEvent.bookmakers[0].markets || []).find(m => m.key === leg.marketKey);
  if (!mkt) return null;
  const wantName =
    leg.side === '__home__' ? freshEvent.home_team :
    leg.side === '__away__' ? freshEvent.away_team :
    leg.side === '__draw__' ? 'Draw' : null;
  if (!wantName) return null; // totals/spreads: not supported by the fresh source yet
  const out = mkt.outcomes.find(o => o.name === wantName);
  return out ? out.price : null;
}

async function verifyLeg(leg) {
  if (!LIVE_VERIFIABLE_BOOKS.has(leg.book)) {
    return { checked: false, reason: 'no live-verification source wired for ' + leg.bookName + ' yet' };
  }
  if (!leg.fixtureRef) {
    return { checked: false, reason: 'no fixture id captured for this leg (scanned before the fixtureRef fix, or this book path doesn\'t attach one)' };
  }
  const raw = await fetch22BetEventDetail(leg.fixtureRef);
  if (!raw) return { checked: true, vanished: true, reason: '22bet event not found on re-fetch — likely suspended, settled, or removed' };

  const fresh = normalise22BetEvent(raw, leg.sportKeyForRefetch);
  if (!fresh) return { checked: true, vanished: true, reason: 'could not parse fresh 22bet data for this event' };

  const freshPrice = findFreshPrice(fresh, leg);
  if (freshPrice == null) return { checked: true, vanished: true, reason: 'this exact outcome is no longer quoted (market suspended or line changed)' };

  const moved = Math.abs(freshPrice / leg.odds - 1) > PRICE_TOLERANCE;
  return { checked: true, vanished: false, freshPrice, moved };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const plan = await getUserPlan(req);
  if (!plan.user) return res.status(401).json({ error: 'login_required' });

  const { candidates } = req.body || {};
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({ error: 'candidates array required' });
  }

  const toCheck = pickCandidatesToVerify(candidates);

  // Dedupe legs across candidates by (book, fixtureRef, marketKey, side) —
  // the same real-world fixture can show up as a leg of more than one
  // candidate (e.g. two different lines/markets on the same match), and
  // there's no reason to fetch that event twice.
  const legJobs = new Map(); // dedupeKey -> { leg, promise }
  let legBudget = MAX_LEGS_PER_REQUEST;

  for (const arb of toCheck) {
    for (const leg of arb.outcomes || []) {
      if (!LIVE_VERIFIABLE_BOOKS.has(leg.book)) continue;
      const dedupeKey = leg.book + '|' + leg.fixtureRef + '|' + leg.marketKey + '|' + leg.side;
      if (legJobs.has(dedupeKey)) continue;
      if (legBudget <= 0) continue; // over budget — leave uncheckable rather than silently skip accounting
      legBudget--;
      legJobs.set(dedupeKey, verifyLeg({ ...leg, sportKeyForRefetch: arb.sport }));
    }
  }

  const dedupeKeyOf = leg => leg.book + '|' + leg.fixtureRef + '|' + leg.marketKey + '|' + leg.side;
  const resolvedEntries = await Promise.all([...legJobs.entries()].map(async ([k, p]) => [k, await p]));
  const legResults = new Map(resolvedEntries);

  const results = toCheck.map(arb => {
    let impliedFromFresh = 0;
    let vanished = false;
    const legReports = (arb.outcomes || []).map(leg => {
      const key = dedupeKeyOf(leg);
      const v = legResults.get(key);
      if (!v) {
        // not in our budget/dedupe set at all — either unverifiable book, or budget-capped
        impliedFromFresh += 1 / leg.odds;
        return { ...leg, checked: false, reason: (v && v.reason) || 'not checked (unverifiable book or over per-request budget)' };
      }
      if (!v.checked) { impliedFromFresh += 1 / leg.odds; return { ...leg, checked: false, reason: v.reason }; }
      if (v.vanished) { vanished = true; return { ...leg, checked: true, vanished: true, reason: v.reason }; }
      impliedFromFresh += 1 / v.freshPrice;
      return { ...leg, checked: true, freshPrice: v.freshPrice, moved: v.moved };
    });

    if (vanished) {
      return { id: arb.id, status: 'dropped', freshMargin: null, legs: legReports };
    }
    const freshMargin = parseFloat((((1 - impliedFromFresh) / impliedFromFresh) * 100).toFixed(2));
    const anyMoved = legReports.some(l => l.checked && l.moved);
    const status = freshMargin < 0 ? 'dropped' : anyMoved ? 'adjusted' : 'confirmed';
    return { id: arb.id, status, freshMargin, legs: legReports };
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ results, checkedCount: toCheck.length, totalCandidates: candidates.length });
}
