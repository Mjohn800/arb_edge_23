const { fetchOddsPapiOdds } = require('../../lib/oddspapi');

// Same Sportradar tournament IDs confirmed against OddsPapi's own list earlier.
const TEST_CASES = [
  { sportKey: 'soccer_epl', tournamentId: 17 },
  { sportKey: 'soccer_germany_bundesliga', tournamentId: 35 },
  { sportKey: 'soccer_italy_serie_a', tournamentId: 23 },
];

export default async function handler(req, res) {
  const results = {};

  for (const { sportKey, tournamentId } of TEST_CASES) {
    const result = await fetchOddsPapiOdds('msport', tournamentId, 10, sportKey);
    results[sportKey] = {
      ok: result.status.ok,
      reason: result.status.reason,
      eventCount: result.events.length,
      sample: result.events[0] || null,
    };
  }

  return res.status(200).json(results);
}
