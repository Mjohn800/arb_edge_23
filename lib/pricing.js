// Multi-currency pricing. Base price is GHS 50 / month; other currencies are
// converted from it at checkout, using a live rate (cached) with a fallback.
// Server-only: the server ALWAYS recomputes the price, never trusts the browser.

export const BASE_CURRENCY = 'GHS';
export const BASE_PRICE = 50;

// Currencies your Paystack account can actually charge. Must be enabled in
// Paystack (Settings -> Preferences / Payment channels). Override with the
// PAYSTACK_CURRENCIES env var, e.g. "GHS,NGN,USD".
export const SUPPORTED_CURRENCIES = (process.env.PAYSTACK_CURRENCIES || 'GHS,NGN,USD')
  .split(',')
  .map(s => s.trim().toUpperCase())
  .filter(Boolean);

// Only used if the live rate lookup fails. Add more via FALLBACK_RATES_JSON,
// e.g. {"USD":0.09}  (1 GHS = 0.09 USD). Check these occasionally.
const BUILTIN_FALLBACK = { GHS: 1, NGN: 120 };

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
  return { ...BUILTIN_FALLBACK, ...env };
}

// Round UP to a clean number so exchange-rate wobble never under-charges you.
function roundUp(currency, amount) {
  if (currency === 'GHS') return Math.ceil(amount);
  if (currency === 'NGN') return Math.ceil(amount / 100) * 100;
  if (currency === 'USD') return Math.ceil(amount * 2) / 2; // nearest 0.50 up
  return Math.ceil(amount);
}

export function formatPrice(currency, amount) {
  const n = Number.isInteger(amount)
    ? amount.toLocaleString('en-US')
    : amount.toFixed(2);
  return currency + ' ' + n;
}

export async function getQuote(currency) {
  currency = String(currency || '').toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(currency)) return null;
  if (currency === BASE_CURRENCY) {
    return { currency, amount: BASE_PRICE, minor: BASE_PRICE * 100, label: formatPrice(currency, BASE_PRICE) };
  }
  const rates = await getRates();
  const rate = rates[currency];
  if (!rate) return null;
  const amount = roundUp(currency, BASE_PRICE * rate);
  return { currency, amount, minor: Math.round(amount * 100), label: formatPrice(currency, amount) };
}

export async function getAllQuotes() {
  const out = {};
  for (const c of SUPPORTED_CURRENCIES) {
    const q = await getQuote(c);
    if (q) out[c] = q;
  }
  return out;
}

export function defaultCurrencyForCountry(cc) {
  if (cc === 'GH') return 'GHS';
  if (cc === 'NG') return 'NGN';
  return SUPPORTED_CURRENCIES.includes('USD') ? 'USD' : BASE_CURRENCY;
}

// Optional per-currency Paystack plan codes for auto-renew.
// PAYSTACK_PLAN_CODE = the GHS plan; PAYSTACK_PLAN_CODE_NGN / _USD for the others.
export function planCodeFor(currency) {
  return (
    process.env['PAYSTACK_PLAN_CODE_' + currency] ||
    (currency === BASE_CURRENCY ? process.env.PAYSTACK_PLAN_CODE : null) ||
    null
  );
}
export function allPlanCodes() {
  return SUPPORTED_CURRENCIES.map(planCodeFor).filter(Boolean);
}
