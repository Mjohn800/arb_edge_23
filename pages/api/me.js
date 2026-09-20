import { getUserPlan, FREE_SPORTS } from '../../lib/serverAuth';
import { getAllQuotes, defaultCurrencyForCountry, planCodeFor, SUPPORTED_CURRENCIES } from '../../lib/pricing';

export default async function handler(req, res) {
  const plan = await getUserPlan(req);
  if (!plan.user) return res.status(401).json({ error: 'login_required' });
  const sub = plan.subscription;
  const quotes = await getAllQuotes();
  return res.status(200).json({
    isPremium: plan.isPremium,
    status: sub ? sub.status : 'free',
    currentPeriodEnd: sub ? sub.current_period_end : null,
    autoRenew: sub ? !!sub.auto_renew : false,
    quotes, // { GHS: {amount,label}, NGN: {...}, USD: {...} }
    defaultCurrency: defaultCurrencyForCountry(req.headers['x-vercel-ip-country']),
    autoCurrencies: SUPPORTED_CURRENCIES.filter(c => planCodeFor(c)),
    freeSports: FREE_SPORTS,
  });
}
