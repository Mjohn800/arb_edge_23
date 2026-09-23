// pages/api/scrapers/msport.js
const { fetchOddsPapiOdds } = require('../../../lib/oddspapi');

// ⚠️ UNVERIFIED: 'msport' gets HTTP 400 from OddsPapi's /odds-by-tournaments
// (confirmed in prod logs, 22:37:54 cycle — a 400, not a 429, so it's OddsPapi
// rejecting the slug itself, not a rate limit). OddsPapi doesn't validate
// bookmaker slugs client-side (see lib/oddspapi.js) — it just forwards
// whatever string you pass. The only reliable source of the real slug is
// GET /v4/bookmakers, which returns each bookmaker's canonical `slug` field.
// Run scripts/find-msport-slug.js (one-off, uses your existing ODDSPAPI_KEY)
// and replace the value below once you have it.
const MSPORT_BOOKMAKER_SLUG = 'msport'; // TODO: replace after /v4/bookmakers lookup

// Same Sportradar tournament IDs as BETFOX_TOURNAMENT_MAP in odds.js —
// confirmed identical against OddsPapi's own tournament list.
const TOURNAMENT_MAP = {
  soccer_epl: 17,
  soccer_uefa_champs_league: 7,
  soccer_spain_la_liga: 8,
  soccer_germany_bundesliga: 35,
  soccer_italy_serie_a: 23,
  soccer_france_ligue_one: 34,
  soccer_netherlands_eredivisie: 37,
  soccer_efl_champ: 18,
  soccer_norway_eliteserien: 20,
  soccer_fifa_world_cup: 16,
};

async function fetchMsportOdds(sportKey) {
  const tournamentId = TOURNAMENT_MAP[sportKey];
  if (!tournamentId) {
    return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };
  }
  return fetchOddsPapiOdds(MSPORT_BOOKMAKER_SLUG, tournamentId, 10, sportKey);
}

module.exports = { fetchMsportOdds };
