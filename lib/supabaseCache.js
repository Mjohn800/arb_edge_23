// lib/supabaseCache.js
// Shared, cross-instance cache + atomic rate limiter backed by Supabase (tables: kv_cache, rate_limits).
// Replaces in-memory Maps that don't coordinate across Vercel's multiple warm serverless instances.
//
// Env vars (server only, NEVER expose to the client):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (legacy service_role JWT "eyJ..." or the new "sb_secret_..." key)
//
// SQL (run once in the Supabase SQL editor): the kv_cache table from before, plus kv_rate_limit.sql
// (rate_limits table + check_rate_limit function).
//
// Design rules:
//  - Every call has a hard timeout (TIMEOUT_MS). A slow or dead Supabase must never slow a scan down.
//  - Every call FAILS OPEN: cacheGet -> null (a cache miss), cacheSet -> false, checkRateLimit -> allowed.
//    Callers need no try/catch of their own.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TIMEOUT_MS = 1500;

export function configured() {
  return !!(SUPABASE_URL && SERVICE_KEY);
}

function headers() {
  const h = { apikey: SERVICE_KEY, 'Content-Type': 'application/json' };
  // Legacy service_role keys are JWTs and go in Authorization too. The newer sb_secret_ keys are NOT
  // JWTs and must only be sent in the apikey header, or the gateway rejects the request.
  if (SERVICE_KEY && SERVICE_KEY.startsWith('eyJ')) h.Authorization = `Bearer ${SERVICE_KEY}`;
  return h;
}

// Log at most one failure per minute so an outage doesn't flood the function logs.
let lastLogAt = 0;
function logFailure(what, detail) {
  const now = Date.now();
  if (now - lastLogAt < 60 * 1000) return;
  lastLogAt = now;
  console.log(`[supabaseCache] ${what} failed:`, detail);
}

async function sb(path, init = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...(init.headers || {}) }, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function cacheGet(key) {
  if (!configured()) return null;
  try {
    const res = await sb(`kv_cache?key=eq.${encodeURIComponent(key)}&select=value,expires_at`);
    if (!res.ok) { logFailure('cacheGet', res.status); return null; }
    const row = (await res.json())[0];
    if (!row) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) return null; // expired -> miss
    return row.value;
  } catch (e) {
    logFailure('cacheGet', e.message);
    return null;
  }
}

export async function cacheSet(key, value, ttlMs) {
  if (!configured()) return false;
  try {
    const res = await sb('kv_cache?on_conflict=key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ key, value, expires_at: new Date(Date.now() + ttlMs).toISOString() }),
    });
    if (!res.ok) logFailure('cacheSet', res.status);
    return res.ok;
  } catch (e) {
    logFailure('cacheSet', e.message);
    return false;
  }
}

export async function cacheDelete(key) {
  if (!configured()) return false;
  try {
    const res = await sb(`kv_cache?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    logFailure('cacheDelete', e.message);
    return false;
  }
}

// Atomic fixed-window limiter (the check_rate_limit SQL function does the counting in ONE statement,
// so simultaneous requests can't both read an old count and both pass).
// Returns { allowed, retryAfterSeconds }. Fails open if Supabase or the function is unavailable.
export async function checkRateLimit(limiterKey, max, windowSeconds) {
  if (!configured()) return { allowed: true, retryAfterSeconds: 0 };
  try {
    const res = await sb('rpc/check_rate_limit', {
      method: 'POST',
      body: JSON.stringify({ p_key: limiterKey, p_max: max, p_window_seconds: windowSeconds }),
    });
    if (!res.ok) { logFailure('checkRateLimit', res.status); return { allowed: true, retryAfterSeconds: 0 }; }
    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== 'boolean') return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: row.allowed, retryAfterSeconds: row.retry_after_seconds || 0 };
  } catch (e) {
    logFailure('checkRateLimit', e.message);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
