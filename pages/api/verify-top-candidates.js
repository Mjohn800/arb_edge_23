// pages/api/verify-top-candidates.js
//
// Auto-verification of scan candidates BEFORE they're shown. Unlike /api/verify-arb (the manual
// "recheck" button on one arb already on screen), this is called automatically right after
// findArbs() runs — see index.js's verifyTopCandidates() for the client side.
//
// WHY THIS QUERIES THE BOOKMAKER'S OWN SITE, NOT ODDSPAPI AGAIN:
// The bad-data cases we've hit (fabricated same-book multi-leg arbs, stale fixture links, 22bet
// prices that did not match 22bet's page) originated AT OddsPapi — asking OddsPapi a second time
// asks the same possibly-broken source. This route reads what 22bet's own platform shows for the
// exact event, and compares.
//
// WHAT CHANGED (21 Oct 2026) — the route used to check only the top 3 arbs by margin (plus >=5%),
// and any arb with a 22bet leg outside that shortlist was shown with no live check at all. Now:
//   1. EVERY candidate that has a 22bet leg is checked, highest margin first.
//   2. Cost is bounded by distinct 22bet EVENTS fetched live per request (MAX_LIVE_FETCHES_PER_REQUEST);
//      events already in the 60 s shared cache are free. Candidates that did not get a live check come
//      back as 'unchecked' and the client files them under "review" (hidden by default) — they are
//      never shown as if verified.
//   3. The fetched 22bet event must be the SAME MATCH as the arb (strict team match + kickoff within
//      10 min). A fixtureRef that points at a different match used to be compared price-for-price.
//   4. A leg is only "checked" when 22bet quotes one unambiguous price for it. A failed/blocked fetch, a
//      page with no readable 1X2, or several different prices for one selection come back 'unverifiable'
//      (hidden review tier) instead of being dropped as if the event had vanished. Totals / handicap legs
//      (the scraper cannot read them yet) are simply not checked here and keep the tier the client's
//      BOOK_PROFILES trust profile gave them.
//   5. The client shows 22bet's own price on checked legs, so the odds on the card are the site's.
//
// LIVE_VERIFIABLE_BOOKS: a book only goes in this set once it has a function here that can fetch ONE
// event fresh from that book's OWN platform. Right now that's just 22bet. betano is still an
// OddsPapi-only source, so its legs are not live-checked (arbs with only betano legs get no result).
import { getUserPlan } from '../../lib/serverAuth';
import { checkRateLimit, cacheGet, cacheSet } from '../../lib/supabaseCache';
import { fuzzyMatch } from '../../lib/teamMatch';
import { fetch22BetEventDetail, normalise22BetEvent } from './scrapers/22bet';

const LIVE_VERIFIABLE_BOOKS = new Set(['22bet']);

// A fresh price within this band of the shown price counts as "confirmed", beyond it as "moved".
// (The client shows 22bet's fresh price on every checked leg either way.)
const PRICE_TOLERANCE = 0.01; // 1% (was 3%)

// The fetched 22bet event must kick off within this of the arb's kickoff (same as MERGE_KICKOFF_MS in odds.js).
const KICKOFF_TOLERANCE_MS = 10 * 60 * 1000;

// How many distinct 22bet EVENTS one request may fetch live (each is a 22bet request, or a paid
// ScraperAPI proxy call when 22bet strips the direct one). Cache hits do not count. Was 10 legs;
// it is now 10 events so one match with several legs costs one fetch.
const MAX_LIVE_FETCHES_PER_REQUEST = 10;

// ─── ACCESS / INPUT LIMITS ───────────────────────────────────────────────────
const VERIFY_LIMIT_MAX = 30;
const VERIFY_LIMIT_WINDOW_SECONDS = 10 * 60;
const MAX_CANDIDATES = 300;
const MAX_LEGS_PER_CANDIDATE = 4;

// QUOTA: a freshly fetched event is shared for FRESH_EVENT_TTL_MS across users and instances
// (Supabase kv_cache), and concurrent requests for the same event on one instance share one fetch.
const FRESH_EVENT_TTL_MS = 60 * 1000;
const inFlightFresh = new Map(); // cacheKey -> Promise<{ state, fresh?, fetchedAt? }>

const eventCacheKey = (sport, fixtureRef) => 'verify22:' + sport + ':' + fixtureRef;

async function getFreshEvent(fixtureRef, sport) {
  const key = eventCacheKey(sport, fixtureRef);
  const hit = await cacheGet(key);
  if (hit && hit.fresh) return { state: 'ok', fresh: hit.fresh, fetchedAt: hit.fetchedAt };
  if (inFlightFresh.has(key)) return inFlightFresh.get(key);
  const p = (async () => {
    const raw = await fetch22BetEventDetail(fixtureRef);
    if (!raw) return { state: 'missing' };            // not cached: re-check next time
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
// id is whatever the client sends back to us (index.js sends arb id + legs so the same event in the
// global and WA lists cannot collide); we only echo it.
function sanitizeCandidates(raw) {
  const out = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const id = str(c.id, 400), sport = str(c.sport, 60);
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
    out.push({ id, sport, home: str(c.home, 80), away: str(c.away, 80), commenceTime: str(c.commenceTime, 40), margin: c.margin, outcomes });
  }
  return out.sort((a, b) => b.margin - a.margin).slice(0, MAX_CANDIDATES);
}

// Every candidate that has at least one leg we can check live, best margin first.
function pickCandidatesToVerify(candidates) {
  return candidates
    .filter(c => c.outcomes.some(o => LIVE_VERIFIABLE_BOOKS.has(o.book)))
    .sort((a, b) => b.margin - a.margin);
}

const UNSUPPORTED = { unsupported: true };

// Finds the price the arb used inside a freshly-fetched 22bet event. Only the 1X2 market is parsed from
// 22bet today (totals / handicap normalisation is still a TODO in normalise22BetEvent), so any other
// leg is UNSUPPORTED — "cannot read", not "gone". If 22bet quotes the same selection at several
// different prices (the scraper's 1X2 detection can pick up more than one 3-way market), the answer
// is ambiguous and nothing is confirmed.
function findFreshPrice(freshEvent, leg) {
  if (leg.marketKey !== 'h2h') return UNSUPPORTED;
  const wantName =
    leg.side === '__home__' ? freshEvent.home_team :
    leg.side === '__away__' ? freshEvent.away_team :
    leg.side === '__draw__' ? 'Draw' : null;
  if (!wantName) return UNSUPPORTED;
  const prices = [];
  for (const m of freshEvent.bookmakers[0].markets || []) {
    if (m.key !== 'h2h') continue;
    for (const o of m.outcomes || []) if (o.name === wantName && o.price > 1) prices.push(o.price);
  }
  if (prices.length === 0) return null;
  if (prices.some(p => Math.abs(p / prices[0] - 1) > 0.005)) return { ambiguous: true };
  return prices[0];
}

// One leg, one arb. Returns:
//   { checked: true, freshPrice, moved, fetchedAt }   -> read from 22bet's own page and matched to this match
//   { checked: true, vanished: true, reason }         -> 22bet no longer quotes this exact outcome
//   { checked: false, kind, reason }                  -> kind: 'other_book' | 'unsupported' | 'unreadable' | 'over_budget'
function judgeLeg(leg, arb, got) {
  if (!LIVE_VERIFIABLE_BOOKS.has(leg.book)) {
    return { checked: false, kind: 'other_book', reason: 'no live-verification source wired for ' + leg.bookName + ' yet' };
  }
  if (!leg.fixtureRef) {
    return { checked: false, kind: 'unreadable', reason: 'no fixture id captured for this leg' };
  }
  if (!isNumericFixtureRef(leg.fixtureRef)) {
    return { checked: false, kind: 'unreadable', reason: 'fixture id is not a valid 22bet event id' };
  }
  if (!got) {
    return { checked: false, kind: 'over_budget', reason: 'not live-checked this scan (per-request limit reached)' };
  }
  if (got.state === 'missing') {
    return { checked: false, kind: 'unreadable', reason: '22bet event could not be fetched (blocked, suspended or removed)' };
  }
  if (got.state === 'unparsed') {
    return { checked: false, kind: 'unreadable', reason: '22bet page had no readable 1X2 prices' };
  }

  const fresh = got.fresh;
  // The id must lead to THIS match. A wrong id used to be compared price-for-price against another match.
  const kickDiff = Math.abs(new Date(fresh.commence_time) - new Date(arb.commenceTime));
  if (!arb.home || !arb.away || !fuzzyMatch(fresh.home_team, arb.home) || !fuzzyMatch(fresh.away_team, arb.away) || !(kickDiff <= KICKOFF_TOLERANCE_MS)) {
    return { checked: false, kind: 'unreadable', reason: 'fixture id leads to "' + fresh.home_team + ' vs ' + fresh.away_team + '", not this match' };
  }

  const fp = findFreshPrice(fresh, leg);
  if (fp === UNSUPPORTED) {
    // Not a failure: the scraper just cannot read this market yet. The arb keeps whatever tier the client's
    // per-book trust profile (BOOK_PROFILES in index.js) already gave it, so it is neither dropped nor hidden here.
    return { checked: false, kind: 'unsupported', reason: '22bet ' + leg.marketKey + ' prices cannot be read from 22bet yet' };
  }
  if (fp && fp.ambiguous) {
    return { checked: false, kind: 'unreadable', reason: '22bet shows more than one price for this selection' };
  }
  if (fp == null) {
    return { checked: true, vanished: true, reason: 'this exact outcome is no longer quoted on 22bet (market suspended or changed)' };
  }
  const moved = Math.abs(fp / leg.odds - 1) > PRICE_TOLERANCE;
  return { checked: true, vanished: false, freshPrice: fp, moved, fetchedAt: got.fetchedAt };
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

  // Distinct 22bet events across all candidates, in order of the best margin they appear under.
  const eventOrder = [];
  const seenEvents = new Set();
  for (const arb of toCheck) {
    for (const leg of arb.outcomes) {
      if (!LIVE_VERIFIABLE_BOOKS.has(leg.book) || !isNumericFixtureRef(leg.fixtureRef)) continue;
      const key = eventCacheKey(arb.sport, leg.fixtureRef);
      if (seenEvents.has(key)) continue;
      seenEvents.add(key);
      eventOrder.push({ key, sport: arb.sport, ref: leg.fixtureRef });
    }
  }

  // Events already in the shared cache are free; only misses spend the live-fetch budget.
  const cachedFlags = await Promise.all(eventOrder.map(e => Promise.resolve(cacheGet(e.key)).then(h => !!(h && h.fresh)).catch(() => false)));
  let liveBudget = MAX_LIVE_FETCHES_PER_REQUEST;
  const eventJobs = new Map(); // cacheKey -> Promise
  eventOrder.forEach((e, i) => {
    if (!cachedFlags[i]) {
      if (liveBudget <= 0) return; // over budget: its legs come back 'over_budget' -> arb is 'unchecked'
      liveBudget--;
    }
    eventJobs.set(e.key, getFreshEvent(e.ref, e.sport));
  });
  const eventResults = new Map(await Promise.all([...eventJobs.entries()].map(async ([k, p]) => [k, await p])));

  const results = [];
  for (const arb of toCheck) {
    let impliedFromFresh = 0;
    let vanished = false, unreadable = 0, overBudget = 0, checkedLegs = 0, anyMoved = false;

    const legReports = arb.outcomes.map(leg => {
      const isLive = LIVE_VERIFIABLE_BOOKS.has(leg.book);
      const got = isLive && isNumericFixtureRef(leg.fixtureRef) ? eventResults.get(eventCacheKey(arb.sport, leg.fixtureRef)) : null;
      const v = judgeLeg(leg, arb, got);

      if (!v.checked) {
        impliedFromFresh += 1 / leg.odds;
        if (v.kind === 'unreadable') unreadable++;
        else if (v.kind === 'over_budget') overBudget++;
        return { ...leg, checked: false, kind: v.kind, reason: v.reason };
      }
      if (v.vanished) { vanished = true; return { ...leg, checked: true, vanished: true, reason: v.reason }; }
      checkedLegs++;
      if (v.moved) anyMoved = true;
      impliedFromFresh += 1 / v.freshPrice;
      return { ...leg, checked: true, freshPrice: v.freshPrice, moved: v.moved, fetchedAt: v.fetchedAt };
    });

    const legsTotal = legReports.length;
    // Nothing was live-checked and nothing went wrong (e.g. only an unsupported 22bet totals leg): say nothing,
    // so the client shows the arb exactly as its own trust profile ranks it.
    if (checkedLegs === 0 && !vanished && unreadable === 0 && overBudget === 0) continue;
    let status, freshMargin = null;
    if (vanished) status = 'dropped';
    else if (unreadable > 0) status = 'unverifiable';   // a 22bet leg could not be read from 22bet's own page
    else if (overBudget > 0) status = 'unchecked';      // not enough live-fetch budget this request
    else {
      freshMargin = parseFloat((((1 - impliedFromFresh) / impliedFromFresh) * 100).toFixed(2));
      // 'confirmed' only when EVERY leg was checked live; otherwise the 22bet leg(s) are verified, the rest are not.
      status = freshMargin <= 0 ? 'dropped' : anyMoved ? 'adjusted' : checkedLegs === legsTotal ? 'confirmed' : 'partial';
    }
    results.push({ id: arb.id, status, freshMargin, legsChecked: checkedLegs, legsTotal, legs: legReports });
  }

  return res.status(200).json({ results, checkedCount: toCheck.length, totalCandidates: candidates.length, liveFetches: eventJobs.size });
}
