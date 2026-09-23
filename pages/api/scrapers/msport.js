// pages/api/scrapers/msport.js
//
// CONFIRMED 23 Sep 2026: MSport is not covered by OddsPapi at all. Tested
// directly against /v4/odds-by-tournaments with bookmaker=msport (the
// correct slug per /v4/bookmakers — "MSPORT NG") on two different
// tournaments (Serie A id 23, EPL id 17) and both return the same error:
//   { "error": { "code": "INVALID_PARAMETER",
//       "details": "The bookmaker 'msport' is not supported or does not
//       have any fixtures available." } }
// Same result regardless of league, so this isn't a per-tournament gap —
// OddsPapi just doesn't carry MSport data. Matches "liveOdds": false on
// their bookmaker listing.
//
// Previously this called fetchOddsPapiOdds() unconditionally, which burned
// a full pass through the OddsPapi key rotation (up to 6 requests) on every
// scan for a call that was guaranteed to fail — that's what was flooding
// the ALL KEYS FAILED logs for msport specifically.
//
// Short-circuiting here instead: no network call, no wasted quota. Getting
// real MSport odds back would need a direct scraper (same pattern as
// betano.js / betfox.js) built from a DevTools capture of msport's own
// site — OddsPapi isn't a path to it.

async function fetchMsportOdds(sportKey) {
  return {
    events: [],
    status: {
      ok: true,
      reason: 'msport_not_covered_by_oddspapi',
      fetchedAt: new Date().toISOString(),
    },
  };
}

module.exports = { fetchMsportOdds };
