import crypto from 'crypto';
import { allPlanCodes } from '../../lib/pricing';
import {
  PERIOD_DAYS,
  getSubscription,
  findSubscription,
  upsertSubscription,
  recordPayment,
} from '../../lib/serverAuth';

// We need the RAW body to verify Paystack's signature, so turn off body parsing.
export const config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.status(500).end();

  const raw = await readRaw(req);
  const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');
  const got = String(req.headers['x-paystack-signature'] || '');
  const ok =
    got.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  if (!ok) return res.status(401).end();

  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).end();
  }
  const d = event.data || {};

  try {
    if (event.event === 'charge.success') {
      if (d.status !== 'success') return res.status(200).end();
      // Accept a payment only if it matches what OUR server asked for at checkout,
      // or it is a renewal of one of our own Paystack plans.
      const meta = d.metadata || {};
      const isOurPlan = !!(d.plan && d.plan.plan_code && allPlanCodes().includes(d.plan.plan_code));
      const matchesQuote =
        meta.expected_amount != null &&
        d.currency === meta.currency &&
        d.amount >= Number(meta.expected_amount);
      if (!isOurPlan && !matchesQuote) {
        console.warn('[paystack] payment does not match a quote', d.reference, d.amount, d.currency);
        return res.status(200).end();
      }

      const customerCode = d.customer && d.customer.customer_code;
      const email = d.customer && d.customer.email;
      let userId = d.metadata && d.metadata.user_id;
      let existing = userId ? await getSubscription(userId) : null;
      if (!userId) {
        // Auto-renewals don't carry our metadata: find the user by customer code / email.
        existing = await findSubscription({ customerCode, email });
        userId = existing && existing.user_id;
      }
      if (!userId) {
        console.warn('[paystack] payment with no matching user', d.reference);
        return res.status(200).end();
      }

      const isNew = await recordPayment({
        reference: d.reference,
        userId,
        amount: d.amount,
        currency: d.currency,
      });
      if (!isNew) return res.status(200).end(); // duplicate webhook, already handled

      const now = Date.now();
      const currentEnd = existing ? new Date(existing.current_period_end).getTime() : 0;
      const base = Math.max(now, currentEnd);
      const newEnd = new Date(base + PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

      await upsertSubscription({
        user_id: userId,
        email: email || (existing && existing.email) || null,
        plan: 'premium',
        status: 'active',
        current_period_end: newEnd,
        paystack_customer_code: customerCode || (existing && existing.paystack_customer_code) || null,
        last_reference: d.reference,
        auto_renew: d.plan && d.plan.plan_code ? true : !!(existing && existing.auto_renew),
      });
    } else if (
      event.event === 'subscription.create' ||
      event.event === 'subscription.disable' ||
      event.event === 'subscription.not_renew'
    ) {
      const customerCode = d.customer && d.customer.customer_code;
      const email = d.customer && d.customer.email;
      const existing = await findSubscription({ customerCode, email });
      if (existing) {
        const stopping = event.event !== 'subscription.create';
        await upsertSubscription({
          user_id: existing.user_id,
          email: existing.email,
          current_period_end: existing.current_period_end, // access continues to the end
          plan: existing.plan,
          status: stopping ? 'cancelled' : existing.status,
          auto_renew: !stopping,
          paystack_subscription_code: d.subscription_code || existing.paystack_subscription_code || null,
        });
      }
    }
  } catch (err) {
    console.error('[paystack-webhook] handler error', err);
    return res.status(500).end(); // Paystack will retry
  }

  return res.status(200).end();
}
