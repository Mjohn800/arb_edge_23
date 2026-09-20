// Regional pricing, charged in Ghana cedis (GHS).
//
// Why GHS only: Paystack can charge in USD only for businesses registered in Nigeria or
// Kenya. A Ghana business charges in GHS; customers with foreign cards (with international
// payments enabled on the Paystack account) pay the equivalent in their own currency.
//
// Two price tiers, chosen by the visitor's DETECTED country (not the region picked in
// the app, so it can't be used to get a cheaper price):
//   'wa'   : Ghana, Nigeria and other African countries we serve. Shown as GHS 50.
//   'intl' : everyone else. Shown as USD 25, charged as the GHS equivalent at checkout.
// Each visitor only ever receives THEIR tier's price; other tiers' prices are never sent.
// The server ALWAYS recomputes the price; never the browser.

export const BASE_CURRENCY = 'GHS';   // exchange rates are fetched relative to this
export const CHARGE_CURRENCY = 'GHS'; // the currency Paystack actually charges

export const WA_COUNTRIES = new Set(['GH','NG','SN','CI','CM','KE','TZ','UG','RW','ZM','ET','MZ','SL','LR','GM','BJ','BF','ML','NE','GN','TG','MR','MW','ZW','AO','CD','CG','GA','TD','BI','DJ','ER','SO','SD','SS']);

// display = what the visitor sees. Change these two numbers to change prices.
export const TIERS = {
  wa:   { display: { currency: 'GHS', amount: 50 } },
  intl: { display: { currency: 'USD', amount: 25 } },
};

// PRICING_TIER_FORCE=intl (or wa) in Vercel lets you preview a tier while testing.
export function tierForCountry(cc) {
  const forced = String(process.env.PRICING_TIER_FORCE || '').toLowerCase();
  if (TIERS[forced]) return forced;
  if (!cc || cc === 'unknown' || cc === 'XX') return 'wa';
  return WA_COUNTRIES.has(cc) ? 'wa' : 'intl';
}

// Used only if the live rate lookup fails. Format: 1 GHS = x <currency>, e.g.
// FALLBACK_RATES_JSON={"USD":0.09}. There is no built-in fallback because a wrong
// rate would mis-price Premium, so set this yourself and check it now and then.
const TTL = 6 * 60 * 60 * 1000;
let cache = { ts: 0, rates: null };

async function getRates() {
  if (cache.rates && Date.now() - cache.ts < TTL) return cache.rates;
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/' + BASE_CURRENCY);
    if (r.ok) {
      const j = await r.json();
      if (j && j.rates) {
        cache = { ts: Date.now(), rates: j.rates };
        return j.rates;
      }
    }
  } catch {}
  let env = {};
  try { env = JSON.parse(process.env.FALLBACK_RATES_JSON || '{}'); } catch {}
  return { GHS: 1, ...env };
}

export function formatPrice(currency, amount) {
  const n = Number.isInteger(amount) ? amount.toLocaleString('en-US') : amount.toFixed(2);
  return currency + ' ' + n;
}

// Round UP to the next 5 cedis so exchange-rate wobble never under-charges you.
const ceilTo = (x, step) => Math.ceil(x / step) * step;

// key = the DISPLAY currency of the visitor's tier ('GHS' or 'USD').
export async function getQuote(key, tier = 'wa') {
  key = String(key || '').toUpperCase();
  const d = (TIERS[tier] || TIERS.wa).display;
  if (key !== d.currency) return null;

  let chargeAmount;
  if (d.currency === CHARGE_CURRENCY) {
    chargeAmount = d.amount;
  } else {
    const rates = await getRates(); // 1 GHS = rates[X]
    const perGhs = rates[d.currency];
    if (!perGhs) return null;
    chargeAmount = ceilTo(d.amount / perGhs, 5); // GHS per 1 unit = 1 / perGhs
  }
  return {
    currency: CHARGE_CURRENCY,          // what Paystack charges
    amount: chargeAmount,
    minor: Math.round(chargeAmount * 100),
    label: formatPrice(d.currency, d.amount),          // what the visitor sees
    displayCurrency: d.currency,
    chargeLabel: formatPrice(CHARGE_CURRENCY, chargeAmount),
  };
}

// Quotes for one tier, keyed by display currency.
export async function getAllQuotes(tier = 'wa') {
  const d = (TIERS[tier] || TIERS.wa).display;
  const q = await getQuote(d.currency, tier);
  return q ? { [d.currency]: q } : {};
}

export function defaultCurrencyForTier(tier) {
  return (TIERS[tier] || TIERS.wa).display.currency;
}

// Optional Paystack plan codes for auto-renew (a plan has a fixed amount):
//   wa tier:   PAYSTACK_PLAN_CODE       (a GHS 50 monthly plan)
//   intl tier: PAYSTACK_PLAN_CODE_INTL  (a monthly plan at the GHS amount shown at checkout)
export function planCodeFor(tier = 'wa') {
  return (tier === 'intl' ? process.env.PAYSTACK_PLAN_CODE_INTL : process.env.PAYSTACK_PLAN_CODE) || null;
}
export function allPlanCodes() {
  return [process.env.PAYSTACK_PLAN_CODE, process.env.PAYSTACK_PLAN_CODE_INTL].filter(Boolean);
}
