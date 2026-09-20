// Server-only helpers: verify the logged-in user and check their premium plan.
// Imported by the /api routes. Never import this from pages/index.js.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ---- Plan settings (change these in ONE place) ------------------------------
// (Price and currencies live in lib/pricing.js: GHS 50 base, others converted.)
export const PERIOD_DAYS = 30;
// Sports free users may scan. Everything else needs Premium.
export const FREE_SPORTS = ['soccer_epl', 'soccer_uefa_champs_league'];
// -----------------------------------------------------------------------------

function serviceHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Returns { id, email } for a valid login token, otherwise null.
export async function getUser(req) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || !SUPABASE_URL || !ANON_KEY) return null;
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: u.email } : null;
  } catch {
    return null;
  }
}

export async function getSubscription(userId) {
  const r = await fetch(
    SUPABASE_URL + '/rest/v1/subscriptions?user_id=eq.' + encodeURIComponent(userId) + '&select=*',
    { headers: serviceHeaders() }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

// Look up a subscription by Paystack customer code or email (used for renewals).
export async function findSubscription({ customerCode, email }) {
  const tries = [];
  if (customerCode) tries.push('paystack_customer_code=eq.' + encodeURIComponent(customerCode));
  if (email) tries.push('email=eq.' + encodeURIComponent(email));
  for (const q of tries) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/subscriptions?' + q + '&select=*', {
      headers: serviceHeaders(),
    });
    if (r.ok) {
      const rows = await r.json();
      if (rows[0]) return rows[0];
    }
  }
  return null;
}

export async function upsertSubscription(row) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/subscriptions?on_conflict=user_id', {
    method: 'POST',
    headers: serviceHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error('upsertSubscription failed: ' + r.status + ' ' + (await r.text()));
}

// Returns true if this payment reference is new, false if we already processed it.
export async function recordPayment({ reference, userId, amount, currency }) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/payments?on_conflict=reference', {
    method: 'POST',
    headers: serviceHeaders({ Prefer: 'resolution=ignore-duplicates,return=representation' }),
    body: JSON.stringify({ reference, user_id: userId, amount, currency }),
  });
  if (!r.ok) throw new Error('recordPayment failed: ' + r.status + ' ' + (await r.text()));
  const rows = await r.json();
  return rows.length > 0;
}

// { user, isPremium, subscription }
export async function getUserPlan(req) {
  const user = await getUser(req);
  if (!user) return { user: null, isPremium: false, subscription: null };
  let subscription = null;
  try {
    subscription = await getSubscription(user.id);
  } catch {}
  const isPremium =
    !!subscription && new Date(subscription.current_period_end).getTime() > Date.now();
  return { user, isPremium, subscription };
}
