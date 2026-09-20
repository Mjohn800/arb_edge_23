import { getUser } from '../../lib/serverAuth';
import { getQuote, planCodeFor, BASE_CURRENCY } from '../../lib/pricing';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Please log in again.' });

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: 'Payments are not set up yet.' });

  const mode = req.body && req.body.mode === 'auto' ? 'auto' : 'prepaid';
  const wanted = (req.body && req.body.currency) || BASE_CURRENCY;

  // The server works out the price itself; the browser only says which currency.
  const quote = await getQuote(wanted);
  if (!quote) {
    return res.status(400).json({ error: 'That currency is not available right now. Try GHS.' });
  }

  const planCode = mode === 'auto' ? planCodeFor(quote.currency) : null;
  if (mode === 'auto' && !planCode) {
    return res.status(400).json({ error: 'Auto-renew is not available in ' + quote.currency + ' yet. Use the 30-day option.' });
  }

  const origin = process.env.APP_URL || req.headers.origin || 'https://' + req.headers.host;
  const reference = 'arb_' + user.id.slice(0, 8) + '_' + Date.now();

  const body = {
    email: user.email,
    amount: quote.minor,
    currency: quote.currency,
    reference,
    callback_url: origin + '/?paid=1',
    // Paystack echoes this back on the webhook; the webhook checks the amount against it.
    metadata: { user_id: user.id, mode, currency: quote.currency, expected_amount: quote.minor },
  };
  // With a plan code, Paystack takes the amount from the plan and renews the card.
  if (planCode) body.plan = planCode;

  try {
    const r = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok || !j.status) {
      console.warn('[checkout] paystack error', r.status, j && j.message);
      return res.status(502).json({ error: 'Could not start payment. Please try again.' });
    }
    return res.status(200).json({ url: j.data.authorization_url, reference });
  } catch (err) {
    console.warn('[checkout] failed', err);
    return res.status(502).json({ error: 'Could not start payment. Please try again.' });
  }
}
