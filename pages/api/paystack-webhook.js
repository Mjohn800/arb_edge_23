import crypto from 'crypto';
import { allPlanCodes, TIERS, WA_COUNTRIES } from '../../lib/pricing';
import {
  PERIOD_DAYS,
  getSubscription,
  findSubscription,
  upsertSubscription,
  recordPayment,
  deletePayment,
} from '../../lib/serverAuth';
import { notifyOwner } from '../../lib/alerts';

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

      // Pricing guard: the cheap GHS tier is picked from the visitor's detected country, which a
      // VPN can fake. The card itself cannot: Paystack reports the card's issuing country. A card
      // from outside our African tier paying the cheap price is flagged to you on Telegram. It is
      // still granted by default (it may be a local with a foreign card). Set
      // PRICING_ENFORCE_CARD_COUNTRY=1 in Vercel to withhold Premium instead; you then refund
      // the payment by hand from the Paystack dashboard.
      {
        const auth = d.authorization || {};
        const cardCountry = String(auth.country_code || '').toUpperCase();
        const paidCheapTier = isOurPlan
          ? !!process.env.PAYSTACK_PLAN_CODE && d.plan.plan_code === process.env.PAYSTACK_PLAN_CODE
          : d.currency === 'GHS' && Number(meta.expected_amount) === TIERS.wa.display.amount * 100;
        const foreignCard = d.channel === 'card' && cardCountry && !WA_COUNTRIES.has(cardCountry);
        if (paidCheapTier && foreignCard) {
          try {
            await notifyOwner(
              'tier_mismatch_' + d.reference,
              `⚠️ Cheap-tier payment with a foreign card (${cardCountry}). Ref ${d.reference}, ${email || 'no email'}. ` +
                (process.env.PRICING_ENFORCE_CARD_COUNTRY === '1'
                  ? 'Premium was NOT granted: refund it in Paystack.'
                  : 'Premium was granted. Refund it if you do not want it.')
            );
          } catch (e) { console.error('[paystack] tier alert failed', e.message); }
          if (process.env.PRICING_ENFORCE_CARD_COUNTRY === '1') return res.status(200).end();
        }
      }

      const isNew = await recordPayment({
        reference: d.reference,
        userId,
        amount: d.amount,
        currency: d.currency,
      });
      if (!isNew) return res.status(200).end(); // duplicate webhook, already handled

      try {
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
      } catch (err) {
        // Saving failed AFTER the payment was recorded. Release the reference so Paystack's
        // retry is not treated as a duplicate (which would leave the customer paid but not Premium).
        try {
          await deletePayment(d.reference);
        } catch (e) {
          console.error('[paystack] could not release reference', d.reference, e.message);
          await notifyOwner(
            'webhook_release_failed_' + d.reference,
            `🚨 Paystack payment ${d.reference} (user ${userId}) was charged but Premium was NOT saved, and the retry lock could not be released. Grant Premium manually.`
          );
        }
        throw err; // outer catch returns 500 so Paystack retries
      }
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
          status: stopping ? 'cancelled' : 'active', // a new/renewed subscription is active again
          auto_renew: !stopping,
          paystack_subscription_code: d.subscription_code || existing.paystack_subscription_code || null,
        });
      }
    } else if (event.event === 'refund.processed' || event.event === 'charge.dispute.create') {
      // Not revoked automatically: a partial refund or a duplicate-charge refund should not
      // cancel Premium. You decide; the alert has what you need to find the user in Supabase.
      const tx = d.transaction || {};
      const ref = d.transaction_reference || tx.reference || d.reference || 'unknown';
      const cust = d.customer || tx.customer || {};
      const who = (cust && cust.email) || (typeof d.customer === 'string' ? d.customer : 'unknown email');
      const kind = event.event === 'refund.processed' ? 'Refund processed' : 'DISPUTE opened';
      await notifyOwner(
        'paystack_' + event.event + '_' + ref,
        `💸 ${kind} on payment ${ref} (${who}). Review it. To remove access, set the user's current_period_end to now in the subscriptions table.`
      );
    } else if (event.event === 'invoice.payment_failed') {
      // The customer keeps access until current_period_end, then simply lapses. Paystack emails them.
      console.warn('[paystack] renewal payment failed for', d.customer && d.customer.email);
    }
  } catch (err) {
    console.error('[paystack-webhook] handler error', err);
    return res.status(500).end(); // Paystack will retry
  }

  return res.status(200).end();
}
