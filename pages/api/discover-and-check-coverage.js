const { listTournaments, fetchOddsPapiOdds } = require('../../lib/oddspapi');
const { ODDSPAPI_TOURNAMENT_MAP, DISCOVERY_HINTS } = require('../../lib/oddspapi-wa');

// TEMP DEBUG ROUTE — delete once every league in ODDSPAPI_TOURNAMENT_MAP has
// a real tournamentId and confirmed bookmaker coverage.
//
// Two passes:
//   1. Discover candidate tournamentId(s) for each unconfirmed league key,
//      using DISCOVERY_HINTS (name substring + categoryName) rather than
//      guessed IDs — OddsPapi has real name collisions across countries.
//   2. For every candidate, actually query odds-by-tournaments for betano
//      and 22bet to see if either book prices it for real.
//
// Usage: GET /api/discover-and-check-coverage
//        GET /api/discover-and-check-coverage?sport=soccer_ghana_premiership
//        (single-league mode — use this if the full scan times out)
export default async function handler(req, res) {
  try {
    const onlyKey = req.query.sport || null;
    const unconfirmed = Object.entries(ODDSPAPI_TOURNAMENT_MAP)
      .filter(([key, mapping]) => !mapping.tournamentId && DISCOVERY_HINTS[key])
      .filter(([key]) => !onlyKey || key === onlyKey);

    if (unconfirmed.length === 0) {
      return res.status(200).json({ message: 'Nothing left to resolve — every hinted league already has a tournamentId, or the ?sport= key was not found.' });
    }

    // Fetch the full soccer tournament list once and reuse it for every
    // lookup below (cheap after the first call — cached 24h in oddspapi.js).
    const allSoccerTournaments = await listTournaments(10);

    const results = {};

    for (const [sportKey, mapping] of unconfirmed) {
      const hint = DISCOVERY_HINTS[sportKey];
      const nameMatch = hint.nameMatch.toLowerCase();

      let candidates = allSoccerTournaments.filter(t =>
        (t.tournamentName || '').toLowerCase().includes(nameMatch)
      );
      if (hint.categoryName) {
        const preferred = candidates.filter(t =>
          (t.categoryName || '').toLowerCase().includes(hint.categoryName.toLowerCase())
        );
        if (preferred.length > 0) candidates = preferred;
      }
      // Cap it — some substrings (e.g. "premier league") match dozens of
      // countries; only check coverage on the first handful.
      candidates = candidates.slice(0, 5);

      if (candidates.length === 0) {
        results[sportKey] = { candidates: [], note: 'no tournamentName match found — try a different nameMatch in DISCOVERY_HINTS' };
        continue;
      }

      const checked = [];
      for (const c of candidates) {
        const [betano, twobet] = await Promise.all([
          fetchOddsPapiOdds('betano', c.tournamentId, mapping.sportId, sportKey),
          fetchOddsPapiOdds('22bet', c.tournamentId, mapping.sportId, sportKey),
        ]);
        checked.push({
          tournamentId: c.tournamentId,
          tournamentName: c.tournamentName,
          categoryName: c.categoryName,
          futureFixtures: c.futureFixtures,
          betano: { covered: betano.events.length > 0, events: betano.events.length },
          '22bet': { covered: twobet.events.length > 0, events: twobet.events.length },
        });
      }
      results[sportKey] = { candidates: checked };
    }

    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
