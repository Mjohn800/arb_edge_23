// pages/api/scrapers/melbet.js
const { fetchOddsPapiOdds } = require('../../../lib/oddspapi');
const TOURNAMENT_MAP = {
  soccer_epl: 17, soccer_uefa_champs_league: 7, soccer_spain_la_liga: 8,
  soccer_germany_bundesliga: 35, soccer_italy_serie_a: 23, soccer_france_ligue_one: 34,
  soccer_netherlands_eredivisie: 37, soccer_efl_champ: 18, soccer_norway_eliteserien: 20,
  soccer_fifa_world_cup: 16,
};
async function fetchMelbetOdds(sportKey) {
  const tournamentId = TOURNAMENT_MAP[sportKey];
  if (!tournamentId) return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };
return fetchOddsPapiOdds('melbet', tournamentId, 10, sportKey);
}
module.exports = { fetchMelbetOdds };
