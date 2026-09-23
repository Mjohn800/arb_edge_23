const { fetchOddsPapiOdds } = require('../../lib/oddspapi');

// Same confirmed Sportradar tournament IDs used elsewhere in odds.js.
const TEST_CASES = [
  { sportKey: 'soccer_epl', tournamentId: 17 },
  { sportKey: 'soccer_germany_bundesliga', tournamentId: 35 },
  { sportKey: 'soccer_italy_serie_a', tournamentId: 23 },
  { sportKey: 'soccer_netherlands_eredivisie', tournamentId: 37 },
];

export default async function handler(req, res) {
  const results = { melbet: {}, betway: {} };

  for (const bookmaker of ['melbet', 'betway']) {
    for (const { sportKey, tournamentId } of TEST_CASES) {
      const result = await fetchOddsPapiOdds(bookmaker, tournamentId, 10, sportKey);
      results[bookmaker][sportKey] = {
        ok: result.status.ok,
        reason: result.status.reason,
        eventCount: result.events.length,
        sample: result.events[0] || null,
      };
    }
  }

  return res.status(200).json(results);
}
