// pages/api/fixtures.js
// Fetches upcoming fixtures from TheSportsDB (free, no API key needed)
// Free key '123' returns next 1 event per league — we call multiple leagues
// to build a full fixture list across all selected sports.

const BASE = 'https://www.thesportsdb.com/api/v1/json/123';

// Map our sport group names / keys to TheSportsDB league IDs
// Full list: https://www.thesportsdb.com/api/v1/json/123/all_leagues.php
const LEAGUE_IDS = {
  // Football / Soccer
  soccer_fifa_world_cup:                   '4960',
  soccer_fifa_club_world_cup:              '4966',
  soccer_africa_cup_of_nations:            '4460',
  soccer_ghana_premiership:                '4961',
  soccer_epl:                              '4328',
  soccer_efl_champ:                        '4329',
  soccer_fa_cup:                           '4330',
  soccer_germany_bundesliga:               '4331',
  soccer_spain_la_liga:                    '4335',
  soccer_italy_serie_a:                    '4332',
  soccer_france_ligue_one:                 '4334',
  soccer_portugal_primeira_liga:           '4344',
  soccer_netherlands_eredivisie:           '4337',
  soccer_turkey_super_league:              '4340',
  soccer_spl:                              '4336',
  soccer_uefa_champs_league:               '4480',
  soccer_uefa_europa_league:               '4481',
  soccer_conmebol_copa_libertadores:       '4482',
  soccer_brazil_campeonato:                '4351',
  soccer_argentina_primera_division:       '4406',
  soccer_mexico_ligamx:                    '4350',
  soccer_usa_mls:                          '4346',
  soccer_saudi_arabia_pro_league:          '4943',
  soccer_australia_aleague:               '4356',
  soccer_japan_j_league:                   '4355',
  // Basketball
  basketball_nba:                          '4387',
  basketball_wnba:                         '4389',
  basketball_euroleague:                   '4422',
  // American Football
  americanfootball_nfl:                    '4391',
  americanfootball_ncaaf:                  '4479',
  // Ice Hockey
  icehockey_nhl:                           '4380',
  // Baseball
  baseball_mlb:                            '4424',
  // Cricket
  cricket_ipl:                             '4425',
  cricket_international_t20:               '4457',
  // Combat Sports
  mma_mixed_martial_arts:                  '4443',
  boxing_boxing:                           '4444',
  // Rugby
  rugbyleague_nrl:                         '4424',
  rugbyunion_six_nations:                  '4461',
  // Tennis (no league-based fixtures in SportsDB — skip)
};

export default async function handler(req, res) {
  const { sports } = req.query;
  const sportKeys = sports ? sports.split(',') : Object.keys(LEAGUE_IDS);

  const results = [];
  const seen = new Set();

  for (const key of sportKeys) {
    const leagueId = LEAGUE_IDS[key];
    if (!leagueId) continue;

    try {
      const r = await fetch(`${BASE}/eventsnextleague.php?id=${leagueId}`);
      if (!r.ok) continue;
      const data = await r.json();
      const events = data.events || [];

      for (const ev of events) {
        if (seen.has(ev.idEvent)) continue;
        seen.add(ev.idEvent);

        // Only include upcoming events (not past)
        const eventDate = new Date(ev.strTimestamp || ev.dateEvent);
        if (eventDate < new Date()) continue;

        results.push({
          id: ev.idEvent,
          sport: key,
          league: ev.strLeague,
          match: ev.strEvent,
          homeTeam: ev.strHomeTeam,
          awayTeam: ev.strAwayTeam,
          commenceTime: ev.strTimestamp || ev.dateEvent + 'T' + (ev.strTime || '12:00:00') + 'Z',
          venue: ev.strVenue || '',
          country: ev.strCountry || '',
          thumbUrl: ev.strThumb || '',
        });
      }
    } catch (err) {
      console.warn('SportsDB fetch failed for', key, err.message);
    }
  }

  // Sort by date ascending
  results.sort((a, b) => new Date(a.commenceTime) - new Date(b.commenceTime));

  return res.status(200).json({ fixtures: results, count: results.length });
}
