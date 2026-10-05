// pages/api/verify-top-candidates.js
//
// Auto-verification of EVERY arb that has a 22Bet leg, BEFORE it is shown.
// Each 22Bet leg is re-fetched from 22Bet's OWN API (not OddsPapi again) via
// fetch22BetEventDetail, the same function the WA scraper uses.
//
// What changed vs the old "top 3 / >=5%" version:
//  1. Every candidate with a 22Bet leg is checked, highest margin first, until
//     the per-request event budget runs out. Anything not reached is reported
//     as 'unverified' (the client hides those) instead of being silently skipped.
//  2. One 22Bet fetch per distinct EVENT (not per leg), shared by all legs/arbs
//     on that event.
//  3. Identity check: the freshly fetched event must be the same match
//     (kickoff within 30 min, and at least one team name matches, and not
//     home/away swapped). This catches OddsPapi linking a fixture to the wrong
//     22Bet event, which a price check alone cannot.
//  4. Legs 22Bet can't be parsed for (totals/spreads: normalise22BetEvent only
//     does 1X2 so far) are 'unverified', not 'vanished'.
import { getUserPlan } from '../../lib/serverAuth';
import { checkRateLimit } from '../../lib/supabaseCache';
import { fetch22BetEventDetail, normalise22BetEvent } from './scrapers/22bet';

// Raise the function timeout (Vercel). Event fetches can go through ScraperAPI.
export const config = { maxDuration: 60 };

const LIVE_VERIFIABLE_BOOKS = new Set(['22bet']);

const PRICE_TOLERANCE = 0.03;          // fresh price within 3% of shown = confirmed
const TIME_TOLERANCE_MS = 30 * 60 * 1000;

// Distinct 22Bet events fetched per request (each is a real request, sometimes via paid proxy).
const MAX_EVENTS_PER_REQUEST = 16;
const FETCH_CONCURRENCY = 4;
// Stop starting new fetch batches after this long, so we answer before the function times out.
const FETCH_DEADLINE_MS = 40 * 1000;

const VERIFY_LIMIT_MAX = 30;
const VERIFY_LIMIT_WINDOW_SECONDS = 10 * 60;
const MAX_CANDIDATES = 300;
const MAX_LEGS_PER_CANDIDATE = 4;

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);
const isNumericFixtureRef = ref => /^\d{1,15}$/.test(String(ref == null ? '' : ref));

const alnum = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const nameMatch = (a, b) => {
  const na = alnum(a), nb = alnum(b);
  return !!na && !!nb && (na === nb || na.includes(nb) || nb.includes(na));
};

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
    out.push({
      id, sport, margin: c.margin, outcomes,
      home: str(c.home, 80), away: str(c.away, 80), commenceTime: str(c.commenceTime, 40),
    });
  }
  return out.sort((a, b) => b.margin - a.margin).slice(0, MAX_CANDIDATES);
}

const has22betLeg = arb => arb.outcomes.some(l => LIVE_VERIFIABLE_BOOKS.has(l.book));

// Is the freshly fetched 22Bet event actually the match the arb is about?
function identityProblem(fresh, arb) {
  if (arb.commenceTime) {
    const diff = Math.abs(new Date(fresh.commence_time) - new Date(arb.commenceTime));
    if (Number.isFinite(diff) && diff > TIME_TOLERANCE_MS) {
      return 'fixture id points to a different kickoff time (' + fresh.commence_time + ' vs ' + arb.commenceTime + ')';
    }
  }
  if (arb.home && arb.away) {
    const homeOk = nameMatch(fresh.home_team, arb.home), awayOk = nameMatch(fresh.away_team, arb.away);
    if (!homeOk && !awayOk) {
      return 'fixture id points to a different match (22Bet: ' + fresh.home_team + ' vs ' + fresh.away_team + ')';
    }
    const swapped = nameMatch(fresh.home_team, arb.away) && nameMatch(fresh.away_team, arb.home);
    if (swapped && !homeOk && !awayOk) return 'home/away swapped on 22Bet';
  }
  return null;
}

function findFreshPrice(fresh, leg) {
  const mkt = (fresh.bookmakers[0].markets || []).find(m => m.key === leg.marketKey);
  if (!mkt) return null;
  const wantName =
    leg.side === '__home__' ? fresh.home_team :
    leg.side === '__away__' ? fresh.away_team :
    leg.side === '__draw__' ? 'Draw' : null;
  if (!wantName) return undefined; // undefined = market type we can't parse yet (totals/spreads)
  const out = mkt.outcomes.find(o => o.name === wantName);
  return out ? out.price : null;
}

// Fetch each distinct event once, in small batches, within the deadline.
async function fetchEvents(refsInPriorityOrder, startedAt) {
  const results = new Map(); // ref -> { raw } | { error }
  const refs = refsInPriorityOrder.slice(0, MAX_EVENTS_PER_REQUEST);
  for (let i = 0; i < refs.length; i += FETCH_CONCURRENCY) {
    if (Date.now() - startedAt > FETCH_DEADLINE_MS) break;
    const batch = refs.slice(i, i + FETCH_CONCURRENCY);
    await Promise.all(batch.map(async ref => {
      try { results.set(ref, { raw: await fetch22BetEventDetail(ref) }); }
      catch (err) { results.set(ref, { error: err.message }); }
    }));
  }
  return results;
}

function verifyArb(arb, fetched) {
  let impliedFromFresh = 0;
  let dropReason = null;
  const legs = arb.outcomes.map(leg => {
    if (!LIVE_VERIFIABLE_BOOKS.has(leg.book)) {
      impliedFromFresh += 1 / leg.odds;
      return { ...leg, checked: false, reason: 'no independent source for ' + leg.bookName };
    }
    if (!leg.fixtureRef || !isNumericFixtureRef(leg.fixtureRef)) {
      impliedFromFresh += 1 / leg.odds;
      return { ...leg, checked: false, reason: 'no valid 22Bet event id on this leg' };
    }
    const f = fetched.get(leg.fixtureRef);
    if (!f || f.error) {
      impliedFromFresh += 1 / leg.odds;
      return { ...leg, checked: false, reason: f ? 'fetch error: ' + f.error : 'not reached (over per-request budget/time)' };
    }
    if (!f.raw) {
      dropReason = dropReason || '22Bet event not found on re-fetch (suspended, settled or removed)';
      return { ...leg, checked: true, vanished: true, reason: '22Bet event not found on re-fetch' };
    }
    const fresh = normalise22BetEvent(f.raw, arb.sport);
    if (!fresh) {
      dropReason = dropReason || 'could not parse fresh 22Bet data';
      return { ...leg, checked: true, vanished: true, reason: 'could not parse fresh 22Bet data' };
    }
    const idProblem = identityProblem(fresh, arb);
    if (idProblem) {
      dropReason = dropReason || idProblem;
      return { ...leg, checked: true, vanished: true, reason: idProblem };
    }
    const freshPrice = findFreshPrice(fresh, leg);
    if (freshPrice === undefined) {
      impliedFromFresh += 1 / leg.odds;
      return { ...leg, checked: false, reason: 'totals/spreads not parsed from 22Bet yet' };
    }
    if (freshPrice == null) {
      dropReason = dropReason || 'this outcome is no longer quoted on 22Bet';
      return { ...leg, checked: true, vanished: true, reason: 'outcome no longer quoted' };
    }
    impliedFromFresh += 1 / freshPrice;
    return { ...leg, checked: true, freshPrice, moved: Math.abs(freshPrice / leg.odds - 1) > PRICE_TOLERANCE };
  });

  const legsChecked = legs.filter(l => l.checked).length;
  const legs22 = arb.outcomes.filter(l => LIVE_VERIFIABLE_BOOKS.has(l.book)).length;
  const legs22Checked = legs.filter(l => l.checked && LIVE_VERIFIABLE_BOOKS.has(l.book)).length;
  const base = { id: arb.id, legsChecked, legsTotal: legs.length, legs };

  if (dropReason) return { ...base, status: 'dropped', freshMargin: null, reason: dropReason };

  // Every 22Bet leg must have been verified; otherwise we can't vouch for the arb.
  if (legs22Checked < legs22) return { ...base, status: 'unverified', freshMargin: null, reason: 'one or more 22Bet legs could not be verified' };

  const freshMargin = parseFloat((((1 - impliedFromFresh) / impliedFromFresh) * 100).toFixed(2));
  const anyMoved = legs.some(l => l.checked && l.moved);
  const status = freshMargin <= 0 ? 'dropped'
    : anyMoved ? 'adjusted'
    : legsChecked === legs.length ? 'confirmed'
    : 'partial';
  return { ...base, status, freshMargin, reason: status === 'dropped' ? 'margin gone at fresh prices' : null };
}

export default async function handler(req, res) {
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
    if (!rl.allowed) return res.status(429).json({ error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds });
  }

  const candidates = sanitizeCandidates(rawCandidates);
  if (candidates.length === 0) return res.status(400).json({ error: 'no valid candidates' });

  const startedAt = Date.now();
  const toCheck = candidates.filter(has22betLeg); // already sorted by margin desc

  // Distinct 22Bet event ids in priority order (highest-margin arbs first).
  const refs = [];
  for (const arb of toCheck) {
    for (const leg of arb.outcomes) {
      if (LIVE_VERIFIABLE_BOOKS.has(leg.book) && isNumericFixtureRef(leg.fixtureRef) && !refs.includes(leg.fixtureRef)) refs.push(leg.fixtureRef);
    }
  }
  const fetched = await fetchEvents(refs, startedAt);

  const results = toCheck.map(arb => verifyArb(arb, fetched));

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ results, checkedCount: toCheck.length, totalCandidates: candidates.length, eventsFetched: fetched.size, eventsWanted: refs.length });
}
