// lib/oddspapi.js
// Central OddsPapi client: handles key rotation, caching, and per-bookmaker fetches.
// Confirmed behavior: endpoint requires exactly ONE bookmaker per call — no batching.

const BASE_URL = 'https://api.oddspapi.io/v4/odds-by-tournaments';
const CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutes
const CALL_DELAY_MS = 1500; // gap between sequential calls to avoid 429s

const KEY_ENV_NAMES = [
  'ODDSPAPI_KEY',
  'ODDSPAPI_KEY_2',
  'ODDSPAPI_KEY_3',
  'ODDSPAPI_KEY_4',
  'ODDSPAPI_KEY_5',
  'ODDSPAPI_KEY_6',
];

// Module-level state — persists across warm serverless invocations,
// resets on cold start (acceptable; rotation just restarts at key 0).
let currentKeyIndex = 0;
const cache = new Map(); // key: "bookmaker:tournamentId" -> { data, expiresAt }

function getAvailableKeys() {
  return KEY_ENV_NAMES
    .map(name => process.env[name])
    .filter(Boolean);
}

function getCacheKey(bookmaker, tournamentId) {
  return `${bookmaker}:${tournamentId}`;
}

function getFromCache(bookmaker, tournamentId) {
  const entry = cache.get(getCacheKey(bookmaker, tournamentId));
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }
  return null;
}

function setCache(bookmaker, tournamentId, data) {
  cache.set(getCacheKey(bookmaker, tournamentId), {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Statuses that mean "this key is done for now, try the next one"
const KEY_EXHAUSTED_STATUSES = [401, 403, 429];

async function fetchWithKeyRotation(bookmaker, tournamentId) {
  const keys = getAvailableKeys();
  if (keys.length === 0) {
    throw new Error('No OddsPapi keys configured (ODDSPAPI_KEY through ODDSPAPI_KEY_6 all missing)');
  }

  let lastError = null;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const keyIndex = (currentKeyIndex + attempt) % keys.length;
    const key = keys[keyIndex];
    const url = `${BASE_URL}?apiKey=${key}&tournamentIds=${tournamentId}&bookmaker=${bookmaker}`;

    try {
      const res = await fetch(url);

      if (KEY_EXHAUSTED_STATUSES.includes(res.status)) {
        // This key is spent or rate-limited — advance rotation and try next key
        currentKeyIndex = (keyIndex + 1) % keys.length;
        lastError = new Error(`Key index ${keyIndex} returned status ${res.status} for ${bookmaker}`);
        continue;
      }

      if (!res.ok) {
        // Non-key-related error (e.g. bad bookmaker slug, bad tournament id) — don't rotate, just fail
        const body = await res.text();
        throw new Error(`OddsPapi error ${res.status} for ${bookmaker}: ${body}`);
      }

      // Success — keep using this key next time (don't rotate on success)
      currentKeyIndex = keyIndex;
      return await res.json();
    } catch (err) {
      lastError = err;
      // Network-level errors: try next key too, just in case
      currentKeyIndex = (keyIndex + 1) % keys.length;
    }
  }

  throw new Error(`All ${keys.length} OddsPapi keys exhausted or failing for ${bookmaker}. Last error: ${lastError?.message}`);
}

/**
 * Fetch odds for a single bookmaker + tournament, using cache if fresh.
 */
async function getOddsForBookmaker(bookmaker, tournamentId) {
  const cached = getFromCache(bookmaker, tournamentId);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const data = await fetchWithKeyRotation(bookmaker, tournamentId);
  setCache(bookmaker, tournamentId, data);
  return { ...data, fromCache: false };
}

/**
 * Fetch odds for multiple bookmakers sequentially (required — API allows
 * only one bookmaker per call), spacing calls out to avoid rate limits.
 * Cached bookmakers are returned immediately with no delay/API call.
 */
async function getOddsForBookmakers(bookmakers, tournamentId) {
  const results = {};
  for (const bookmaker of bookmakers) {
    try {
      results[bookmaker] = await getOddsForBookmaker(bookmaker, tournamentId);
      // Only delay if we actually hit the network (skip delay for cache hits)
      if (!results[bookmaker].fromCache) {
        await sleep(CALL_DELAY_MS);
      }
    } catch (err) {
      results[bookmaker] = { error: err.message };
    }
  }
  return results;
}

module.exports = {
  getOddsForBookmaker,
  getOddsForBookmakers,
  CONFIRMED_BOOKMAKERS: ['msport', 'mozzartbet', 'melbet', 'betway'],
};
