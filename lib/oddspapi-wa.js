const { fetchOddsPapiOdds } = require('./oddspapi');

// OddsPapi's own sportId/tournamentId scheme — NOT the same IDs as Betano's
// leagueId or 22Bet's leagueId. sportId 10 = Soccer.
//
// ⚠️ OddsPapi has heavy tournamentName collisions across countries (their own
// docs note 35 competitions named "Premier League", 7 named "Ligue 1", etc).
// IDs below marked ✅ are confirmed from OddsPapi's own docs/blog. Everything
// marked TODO must be resolved via /api/debug-oddspapi-tournaments and
// matched on categoryName, NOT guessed — especially Ghana Premier League,
// AFCON, World Cup and MLS, which are exactly the kind of name that collides.
const ODDSPAPI_TOURNAMENT_MAP = {
  soccer_epl:                   { sportId: 10, tournamentId: 17 },  // ✅ England
  soccer_uefa_champs_league:    { sportId: 10, tournamentId: 7 },   // ✅
  soccer_uefa_europa_league:    { sportId: 10, tournamentId: 679 }, // ✅
  soccer_spain_la_liga:         { sportId: 10, tournamentId: 8 },   // ✅
  soccer_germany_bundesliga:    { sportId: 10, tournamentId: 35 },  // ✅ Germany (45 = Austria, don't use)
  soccer_italy_serie_a:         { sportId: 10, tournamentId: 23 },  // ✅
  soccer_france_ligue_one:      { sportId: 10, tournamentId: 34 },  // ✅ France
  soccer_fifa_world_cup:        { sportId: 10, tournamentId: null }, // TODO — confirm via debug route
  soccer_ghana_premiership:     { sportId: 10, tournamentId: null }, // TODO — confirm via debug route
  soccer_africa_cup_of_nations: { sportId: 10, tournamentId: null }, // TODO — confirm via debug route
  soccer_uefa_europa_conference_league: { sportId: 10, tournamentId: 34480 }, // ✅ bonus, not currently in your sport list
};

function makeFetcher(bookmaker) {
  return async function (sportKey) {
    const mapping = ODDSPAPI_TOURNAMENT_MAP[sportKey];
    if (!mapping || !mapping.tournamentId) {
      return {
        events: [],
        status: {
          ok: true,
          reason: mapping ? 'tournament_id_unknown' : 'unsupported_sport',
          fetchedAt: new Date().toISOString(),
        },
      };
    }
    return fetchOddsPapiOdds(bookmaker, mapping.tournamentId, mapping.sportId, sportKey);
  };
}

const fetchBetanoOddsPapi = makeFetcher('betano');
const fetch22BetOddsPapi  = makeFetcher('22bet');

module.exports = { fetchBetanoOddsPapi, fetch22BetOddsPapi, ODDSPAPI_TOURNAMENT_MAP };
