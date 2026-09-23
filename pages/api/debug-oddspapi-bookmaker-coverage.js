const { fetchOddsPapiOdds } = require('../../lib/oddspapi');
const { ODDSPAPI_TOURNAMENT_MAP } = require('../../lib/oddspapi-wa');

// TEMP DEBUG ROUTE — delete once you've confirmed real Betano/22Bet coverage.
// Actually queries OddsPapi's odds-by-tournaments per league, per bookmaker
// (not just "does the tournament exist") so you know for certain whether to
// keep or skip each one — rather than assuming a tournamentId being valid
// means either book prices it.
export default async function handler(req, res) {
  const results = {};

  for (const [sportKey, mapping] of Object.entries(ODDSPAPI_TOURNAMENT_MAP)) {
    if (!mapping.tournamentId) {
      results[sportKey] = { tournamentId: null, skipped: 'no_tournament_id_yet' };
      continue;
    }

    const [betano, twobet] = await Promise.all([
      fetchOddsPapiOdds('betano', mapping.tournamentId, mapping.sportId, sportKey),
      fetchOddsPapiOdds('22bet', mapping.tournamentId, mapping.sportId, sportKey),
    ]);

    results[sportKey] = {
      tournamentId: mapping.tournamentId,
      betano: { covered: betano.events.length > 0, events: betano.events.length, ok: betano.status.ok, reason: betano.status.reason },
      '22bet': { covered: twobet.events.length > 0, events: twobet.events.length, ok: twobet.status.ok, reason: twobet.status.reason },
    };
  }

  res.status(200).json(results);
}
