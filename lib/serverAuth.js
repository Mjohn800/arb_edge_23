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
// The 20 leagues ArbEdge scans. Nothing else can be scanned (protects the Odds API
// quota) except by the owner. Keys must match the Odds API sport keys exactly.
export const SCANNED_SPORTS = [
  'soccer_epl',
  'soccer_uefa_champs_league',
  'soccer_spain_la_liga',
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a',
  'soccer_france_ligue_one',
  'soccer_africa_cup_of_nations',
  'soccer_ghana_premiership',
  'soccer_fifa_world_cup',
  'soccer_uefa_europa_league',
  'soccer_conmebol_copa_libertadores',
  'soccer_usa_mls',
  'soccer_efl_champ',
  'soccer_netherlands_eredivisie',
  'soccer_portugal_primeira_liga',
  'soccer_belgium_first_div',
  'soccer_spl',
  'soccer_norway_eliteserien',
  'soccer_sweden_allsvenskan',
  'soccer_brazil_campeonato',
];
// Free tier: the 5 lower-volume leagues (fewest arb opportunities). Premium gets all 20.
export const FREE_SPORTS = [
  'soccer_norway_eliteserien',
  'soccer_sweden_allsvenskan',
  'soccer_belgium_first_div',
  'soccer_spl',
  'soccer_portugal_primeira_liga',
];
// -----------------------------------------------------------------------------

function serviceHeaders(extra = {}) {
  const h = { apikey: SERVICE_KEY, 'Content-Type': 'application/json', ...extra };
  // Legacy service_role keys are JWTs and go in Authorization too.
  // New-style secret keys (sb_secret_...) are NOT JWTs: apikey header only.
  if (!String(SERVICE_KEY || '').startsWith('sb_secret_')) {
    h.Authorization = 'Bearer ' + SERVICE_KEY;
  }
  return h;
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
    return u && u.id ? { id: u.id, email: u.email, confirmed: !!u.email_confirmed_at } : null;
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

// Owner override: emails listed in the OWNER_EMAILS env var (comma-separated)
// get full Premium access forever. Requires a CONFIRMED email so nobody can
// claim it by signing up with your address.
export function isOwner(user) {
  if (!user || !user.email || !user.confirmed) return false;
  const list = (process.env.OWNER_EMAILS || '')
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(user.email.toLowerCase());
}

// { user, isPremium, isOwner, subscription }
export async function getUserPlan(req) {
  const user = await getUser(req);
  if (!user) return { user: null, isPremium: false, isOwner: false, subscription: null };
  if (isOwner(user)) {
    return {
      user,
      isPremium: true,
      isOwner: true,
      subscription: { status: 'owner', current_period_end: '2999-01-01T00:00:00.000Z', auto_renew: false },
    };
  }
  let subscription = null;
  try {
    subscription = await getSubscription(user.id);
  } catch {}
  const isPremium =
    !!subscription && new Date(subscription.current_period_end).getTime() > Date.now();
  return { user, isPremium, isOwner: false, subscription };
}
