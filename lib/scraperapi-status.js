/**
 * lib/scraperapi-status.js
 *
 * Shared circuit-breaker for ScraperAPI credit exhaustion.
 *
 * When ScraperAPI rejects a call with its "exhausted the API Credits" body
 * (confirmed 403 response, seen from both Betano and Paripesa this cycle),
 * every retry from any scraper for the rest of the cycle is guaranteed to
 * fail the same way. Rather than each scraper independently re-discovering
 * that 403, they share one flag here.
 *
 * Module-scope cache — persists across warm serverless invocations, same
 * pattern as betfox.js's _cache and api/team-form.js.
 */

// Re-probe occasionally rather than trusting the flag for the rest of the
// calendar month — credits can be topped up or overages enabled mid-cycle,
// and this file has no reliable way to know the account's actual reset date.
const RECHECK_MS = 60 * 60 * 1000; // 1 hour

let _state = { exhausted: false, markedAt: 0 };

/**
 * Call before attempting a ScraperAPI request. Returns true if ScraperAPI
 * is known-exhausted and this call should be skipped.
 */
function isScraperApiExhausted() {
  if (!_state.exhausted) return false;
  if (Date.now() - _state.markedAt > RECHECK_MS) {
    _state = { exhausted: false, markedAt: 0 }; // window elapsed — allow one probe
    return false;
  }
  return true;
}

/**
 * Call after a failed ScraperAPI response with its response body text.
 * Sets the shared flag if the body matches the known exhaustion message.
 * Returns true if it matched (so the caller can log/short-circuit).
 */
function markScraperApiExhausted(bodyText) {
  if (typeof bodyText === 'string' && /exhausted the API Credits/i.test(bodyText)) {
    _state = { exhausted: true, markedAt: Date.now() };
    return true;
  }
  return false;
}

module.exports = { isScraperApiExhausted, markScraperApiExhausted };
