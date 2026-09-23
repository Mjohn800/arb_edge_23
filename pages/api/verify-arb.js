// pages/api/verify-arb.js
// Re-checks the legs of ONE arb against a fresh pull from each leg's source.
// Only SportyBet (free scraper) and OddsPapi books (betano, 22bet, melbet — one API
// call each, cache bypassed) are re-checkable; anything else is reported as
// "not_rechecked". Deliberately never touches the-odds-api, so it can't burn
// credits. Called on demand from the UI, not during scans.
import { getUserPlan, FREE_SPORTS, SCANNED_SPORTS } from '../../lib/serverAuth';
import { fetchSportybetOdds } from './scrapers/sportybet';
import { fetchBetanoOddsPapi, fetch22BetOddsPapi, fetchMelbetOddsPapi } from '../../lib/oddspapi-wa';
import { verifyArbLegs } from '../../lib/verifyArb';

const FETCHERS = {
  sportybet: sportKey => fetchSportybetOdds(sportKey),
  betano:    sportKey => fetchBetanoOddsPapi(sportKey, { bypassCache: true }),
  '22bet':   sportKey => fetch22BetOddsPapi(sportKey, { bypassCache: true }),
  melbet:    sportKey => fetchMelbetOddsPapi(sportKey, { bypassCache: true }),
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const plan = await getUserPlan(req);
  if (!plan.user) return res.status(401).json({ error: 'login_required' });

  const arb = req.body || {};
  if (!arb.sport || (!plan.isOwner && !SCANNED_SPORTS.includes(arb.sport))) {
    return res.status(403).json({ error: 'sport_not_available' });
  }
  if (!plan.isPremium && !FREE_SPORTS.includes(arb.sport)) {
    return res.status(402).json({ error: 'premium_required' });
  }
  const legsOk = Array.isArray(arb.outcomes) && arb.outcomes.length >= 2 && arb.outcomes.length <= 4 &&
    arb.outcomes.every(o => o && typeof o.book === 'string' && typeof o.side === 'string' &&
      typeof o.marketKey === 'string' && typeof o.odds === 'number');
  if (!legsOk || !arb.home || !arb.away || !arb.commenceTime) {
    return res.status(400).json({ error: 'bad_request' });
  }

  try {
    const result = await verifyArbLegs(arb, FETCHERS);
    return res.status(200).json(result);
  } catch (err) {
    console.warn('[verify-arb] failed:', err.message);
    return res.status(500).json({ error: 'verify_failed' });
  }
}
