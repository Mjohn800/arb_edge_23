import { getUserPlan, FREE_SPORTS, SCANNED_SPORTS } from '../../lib/serverAuth';
import { getAllQuotes, tierForCountry, defaultCurrencyForTier, planCodeFor } from '../../lib/pricing';

export default async function handler(req, res) {
  const plan = await getUserPlan(req);
  if (!plan.user) return res.status(401).json({ error: 'login_required' });
  const sub = plan.subscription;
  const cc = req.headers['x-vercel-ip-country'];
  const tier = tierForCountry(cc);
  // ArbEdge has no odds coverage for US sportsbooks, so it is not available in the US.
  const notAvailable = cc === 'US' && !plan.isOwner;
  const quotes = notAvailable ? {} : await getAllQuotes(tier);
  return res.status(200).json({
    isPremium: plan.isPremium,
    isOwner: !!plan.isOwner,
    status: sub ? sub.status : 'free',
    currentPeriodEnd: sub ? sub.current_period_end : null,
    autoRenew: sub ? !!sub.auto_renew : false,
    notAvailable,
    quotes, // this visitor's own price only; other regions' prices are never sent
    defaultCurrency: defaultCurrencyForTier(tier),
    autoCurrencies: planCodeFor(tier) ? Object.keys(quotes) : [],
    freeSports: FREE_SPORTS,
    scannedSports: SCANNED_SPORTS,
  });
}
