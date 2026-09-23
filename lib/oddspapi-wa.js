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
  soccer_france_ligue_one:      { sportId: 10, tournamentId: 34 },  // ✅ France (841=Algeria, 984=Tunisia, 1211=Ivory Coast, 1226=Senegal — don't use)
  basketball_nba:                { sportId: 11, tournamentId: 132 }, // ✅
  soccer_uefa_europa_conference_league: { sportId: 10, tournamentId: 34480 }, // ✅ bonus, not currently in your sport list

  // Everything below is from your Scanner's "Select sports to scan" list and
  // still needs a real API lookup — do NOT hand-fill these from search
  // results. Run /api/discover-and-check-coverage to resolve + verify each
  // one against your own key, since OddsPapi has real name collisions across
  // countries for every one of these except NBA/EPL/UCL (already confirmed).
  soccer_fifa_world_cup:              { sportId: 10, tournamentId: null },
  soccer_ghana_premiership:           { sportId: 10, tournamentId: null },
  soccer_africa_cup_of_nations:       { sportId: 10, tournamentId: null },
  soccer_conmebol_copa_libertadores:  { sportId: 10, tournamentId: null },
  soccer_usa_mls:                     { sportId: 10, tournamentId: null },
  soccer_efl_champ:                   { sportId: 10, tournamentId: null }, // Championship (England)
  soccer_netherlands_eredivisie:      { sportId: 10, tournamentId: null },
  soccer_portugal_primeira_liga:      { sportId: 10, tournamentId: null },
  soccer_belgium_first_div:           { sportId: 10, tournamentId: null },
  soccer_spl:                         { sportId: 10, tournamentId: null }, // Scottish Premiership
  soccer_norway_eliteserien:          { sportId: 10, tournamentId: null },
  soccer_sweden_allsvenskan:          { sportId: 10, tournamentId: null },
  soccer_brazil_campeonato:           { sportId: 10, tournamentId: null }, // Brazil Série A
};

// Search hints for the discovery route — categoryName is the disambiguator
// (OddsPapi has e.g. 35 tournaments named "Premier League"). nameMatch is a
// case-insensitive substring against tournamentName.
const DISCOVERY_HINTS = {
  soccer_fifa_world_cup:             { nameMatch: 'world cup',        categoryName: 'World' },
  soccer_ghana_premiership:          { nameMatch: 'premier league',   categoryName: 'Ghana' },
  soccer_africa_cup_of_nations:      { nameMatch: 'africa cup',       categoryName: null }, // also try 'afcon'
  soccer_conmebol_copa_libertadores: { nameMatch: 'libertadores',     categoryName: 'South America' },
  soccer_usa_mls:                    { nameMatch: 'mls',              categoryName: 'USA' },
  soccer_efl_champ:                  { nameMatch: 'championship',     categoryName: 'England' },
  soccer_netherlands_eredivisie:     { nameMatch: 'eredivisie',       categoryName: 'Netherlands' },
  soccer_portugal_primeira_liga:     { nameMatch: 'liga portugal',    categoryName: 'Portugal' },
  soccer_belgium_first_div:          { nameMatch: 'jupiler',          categoryName: 'Belgium' },
  soccer_spl:                        { nameMatch: 'premiership',      categoryName: 'Scotland' },
  soccer_norway_eliteserien:         { nameMatch: 'eliteserien',      categoryName: 'Norway' },
  soccer_sweden_allsvenskan:         { nameMatch: 'allsvenskan',      categoryName: 'Sweden' },
  soccer_brazil_campeonato:          { nameMatch: 'serie a',          categoryName: 'Brazil' },
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

module.exports = { fetchBetanoOddsPapi, fetch22BetOddsPapi, ODDSPAPI_TOURNAMENT_MAP, DISCOVERY_HINTS };
