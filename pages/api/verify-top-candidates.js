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
// betano is still an OddsPapi-only source — until it gets its own per-event
// API call the way 22bet has, there is no independent source to check it
// against, so its legs are marked "uncheckable" rather than silently trusted
// or silently dropped. (Melbet was removed: its scraper has ended.)
import { getUserPlan } from '../../lib/serverAuth';
import { checkRateLimit, cacheGet, cacheSet } from '../../lib/supabaseCache';
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

// ─── ACCESS / INPUT LIMITS ───────────────────────────────────────────────────
// Premium only, per-user rate limit shared across instances (Supabase). Every candidate leg the
// route fetches live is a real request to 22bet (sometimes via a paid ScraperAPI proxy).
const VERIFY_LIMIT_MAX = 30;
const VERIFY_LIMIT_WINDOW_SECONDS = 10 * 60;
// The client sends every arb a scan found. Keep only the highest-margin ones so a huge request
// body cannot turn into a huge amount of work (only ~10 legs are fetched live anyway).
const MAX_CANDIDATES = 300;
const MAX_LEGS_PER_CANDIDATE = 4;

// QUOTA: every live 22bet event fetch can fall back to a ScraperAPI ultra_premium proxy call (see 22bet.js: "an
// expensive call per event"). This route runs automatically after every scan for every open tab, and the same
// top arbs are shown to every user. So a freshly fetched event is shared for FRESH_EVENT_TTL_MS across users and
// instances (Supabase kv_cache), and concurrent requests for the same event on one instance share one fetch.
// 60 s keeps the check "live" (the client treats a check as fresh for 5 min) while cutting duplicate paid fetches.
const FRESH_EVENT_TTL_MS = 60 * 1000;
const inFlightFresh = new Map(); // cacheKey -> Promise<{ state, fresh?, fetchedAt? }>

async function getFreshEvent(fixtureRef, sport) {
  const key = 'verify22:' + sport + ':' + fixtureRef;
  const hit = await cacheGet(key);
  if (hit && hit.fresh) return { state: 'ok', fresh: hit.fresh, fetchedAt: hit.fetchedAt };
  if (inFlightFresh.has(key)) return inFlightFresh.get(key);
  const p = (async () => {
    const raw = await fetch22BetEventDetail(fixtureRef);
    if (!raw) return { state: 'missing' };            // not cached: a vanished event should be re-checked next time
    const fresh = normalise22BetEvent(raw, sport);
    if (!fresh) return { state: 'unparsed' };
    const fetchedAt = new Date().toISOString();
    await cacheSet(key, { fresh, fetchedAt }, FRESH_EVENT_TTL_MS);
    return { state: 'ok', fresh, fetchedAt };
  })().finally(() => inFlightFresh.delete(key));
  inFlightFresh.set(key, p);
  return p;
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);

// 22bet event ids are plain numbers. fixtureRef goes straight into the request URL, so anything
// that is not digits is rejected: it could otherwise inject extra query parameters.
const isNumericFixtureRef = ref => /^\d{1,15}$/.test(String(ref == null ? '' : ref));

// Keeps only the fields this route uses, and only well-formed candidates.
function sanitizeCandidates(raw) {
  const out = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const id = str(c.id, 120), sport = str(c.sport, 60);
    if (!id || !sport || typeof c.margin !== 'number' || !Number.isFinite(c.margin)) continue;
    if (!Array.isArray(c.outcomes) || c.outcomes.length < 2 || c.outcomes.length > MAX_LEGS_PER_CANDIDATE) continue;
    const outcomes = [];
    for (const o of c.outcomes) {
      const book = o && str(o.book, 40);
      if (!book || typeof o.odds !== 'number' || !Number.isFinite(o.odds) || o.odds <= 1) break;
      outcomes.push({
        book,
        bookName: str(o.bookName, 40) || book,
        fixtureRef: o.fixtureRef == null ? null : String(o.fixtureRef).slice(0, 40),
        marketKey: str(o.marketKey, 20) || '',
        side: str(o.side, 60) || '',
        odds: o.odds,
      });
    }
    if (outcomes.length !== c.outcomes.length) continue;
    out.push({ id, sport, margin: c.margin, outcomes });
  }
  return out.sort((a, b) => b.margin - a.margin).slice(0, MAX_CANDIDATES);
}

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
  if (!isNumericFixtureRef(leg.fixtureRef)) {
    return { checked: false, reason: 'fixture id is not a valid 22bet event id' };
  }
  const got = await getFreshEvent(leg.fixtureRef, leg.sportKeyForRefetch);
  if (got.state === 'missing') return { checked: true, vanished: true, reason: '22bet event not found on re-fetch — likely suspended, settled, or removed' };
  if (got.state === 'unparsed') return { checked: true, vanished: true, reason: 'could not parse fresh 22bet data for this event' };

  const fresh = got.fresh;
  const freshPrice = findFreshPrice(fresh, leg);
  if (freshPrice == null) return { checked: true, vanished: true, reason: 'this exact outcome is no longer quoted (market suspended or line changed)' };

  const moved = Math.abs(freshPrice / leg.odds - 1) > PRICE_TOLERANCE;
  return { checked: true, vanished: false, freshPrice, moved, fetchedAt: got.fetchedAt };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const plan = await getUserPlan(req);
  if (!plan.user) return res.status(401).json({ error: 'login_required' });
  if (!plan.isPremium) return res.status(402).json({ error: 'premium_required' });

  const rawCandidates = (req.body || {}).candidates;
  if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) {
    return res.status(400).json({ error: 'candidates array required' });
  }

  if (!plan.isOwner) {
    const rl = await checkRateLimit('verifytop:' + plan.user.id, VERIFY_LIMIT_MAX, VERIFY_LIMIT_WINDOW_SECONDS);
    if (!rl.allowed) {
      return res.status(429).json({ error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds });
    }
  }

  const candidates = sanitizeCandidates(rawCandidates);
  if (candidates.length === 0) return res.status(400).json({ error: 'no valid candidates' });

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

  const results = [];
  for (const arb of toCheck) {
    let impliedFromFresh = 0;
    let vanished = false;
    const legReports = (arb.outcomes || []).map(leg => {
      const v = legResults.get(dedupeKeyOf(leg));
      if (!v) {
        // unverifiable book, or over the per-request budget
        impliedFromFresh += 1 / leg.odds;
        return { ...leg, checked: false, reason: 'not checked (unverifiable book or over per-request budget)' };
      }
      if (!v.checked) { impliedFromFresh += 1 / leg.odds; return { ...leg, checked: false, reason: v.reason }; }
      if (v.vanished) { vanished = true; return { ...leg, checked: true, vanished: true, reason: v.reason }; }
      impliedFromFresh += 1 / v.freshPrice;
      return { ...leg, checked: true, freshPrice: v.freshPrice, moved: v.moved, fetchedAt: v.fetchedAt };
    });

    const legsChecked = legReports.filter(l => l.checked).length;
    const legsTotal = legReports.length;

    // Nothing was actually verified (e.g. no 22bet leg): say nothing rather than "confirmed".
    // The client then shows the normal "not verified live" state for this arb.
    if (legsChecked === 0) continue;

    if (vanished) {
      results.push({ id: arb.id, status: 'dropped', freshMargin: null, legsChecked, legsTotal, legs: legReports });
      continue;
    }
    const freshMargin = parseFloat((((1 - impliedFromFresh) / impliedFromFresh) * 100).toFixed(2));
    const anyMoved = legReports.some(l => l.checked && l.moved);
    // "confirmed" only when EVERY leg was checked live; otherwise it is only partly verified.
    const status = freshMargin < 0 ? 'dropped'
      : anyMoved ? 'adjusted'
      : legsChecked === legsTotal ? 'confirmed'
      : 'partial';
    results.push({ id: arb.id, status, freshMargin, legsChecked, legsTotal, legs: legReports });
  }

  return res.status(200).json({ results, checkedCount: toCheck.length, totalCandidates: candidates.length });
}
