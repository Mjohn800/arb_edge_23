// pages/api/fixtures.js
// Combines hardcoded FIFA World Cup 2026 fixtures with TheSportsDB for other sports

const BASE = 'https://www.thesportsdb.com/api/v1/json/123';

// TheSportsDB league IDs for non-World Cup sports
const LEAGUE_IDS = {
  soccer_epl:                              '4328',
  soccer_efl_champ:                        '4329',
  soccer_germany_bundesliga:               '4331',
  soccer_spain_la_liga:                    '4335',
  soccer_italy_serie_a:                    '4332',
  soccer_france_ligue_one:                 '4334',
  soccer_portugal_primeira_liga:           '4344',
  soccer_netherlands_eredivisie:           '4337',
  soccer_uefa_champs_league:               '4480',
  soccer_uefa_europa_league:               '4481',
  soccer_conmebol_copa_libertadores:       '4482',
  soccer_brazil_campeonato:                '4351',
  soccer_argentina_primera_division:       '4406',
  soccer_mexico_ligamx:                    '4350',
  soccer_usa_mls:                          '4346',
  soccer_saudi_arabia_pro_league:          '4943',
  basketball_nba:                          '4387',
  basketball_wnba:                         '4389',
  americanfootball_nfl:                    '4391',
  icehockey_nhl:                           '4380',
  baseball_mlb:                            '4424',
  cricket_ipl:                             '4425',
  mma_mixed_martial_arts:                  '4443',
};

// FIFA World Cup 2026 upcoming fixtures (Group stage + Knockout)
// All times UTC. Ghana is in Group L with England, Panama, Croatia.
const WORLD_CUP_FIXTURES = [
  // June 18
  { id: 'wc_001', match: 'Czechia vs South Africa', homeTeam: 'Czechia', awayTeam: 'South Africa', commenceTime: '2026-06-18T16:00:00Z', league: 'FIFA World Cup 2026 - Group A', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { id: 'wc_002', match: 'Switzerland vs Bosnia and Herzegovina', homeTeam: 'Switzerland', awayTeam: 'Bosnia and Herzegovina', commenceTime: '2026-06-18T19:00:00Z', league: 'FIFA World Cup 2026 - Group B', venue: 'SoFi Stadium, Los Angeles' },
  { id: 'wc_003', match: 'Canada vs Qatar', homeTeam: 'Canada', awayTeam: 'Qatar', commenceTime: '2026-06-18T22:00:00Z', league: 'FIFA World Cup 2026 - Group B', venue: 'BC Place, Vancouver' },
  { id: 'wc_004', match: 'Mexico vs South Korea', homeTeam: 'Mexico', awayTeam: 'South Korea', commenceTime: '2026-06-19T02:00:00Z', league: 'FIFA World Cup 2026 - Group A', venue: 'Estadio Akron, Guadalajara' },
  // June 19
  { id: 'wc_005', match: 'USA vs Australia', homeTeam: 'USA', awayTeam: 'Australia', commenceTime: '2026-06-19T19:00:00Z', league: 'FIFA World Cup 2026 - Group D', venue: 'Lumen Field, Seattle' },
  { id: 'wc_006', match: 'Scotland vs Morocco', homeTeam: 'Scotland', awayTeam: 'Morocco', commenceTime: '2026-06-19T22:00:00Z', league: 'FIFA World Cup 2026 - Group C', venue: 'Gillette Stadium, Boston' },
  { id: 'wc_007', match: 'Brazil vs Haiti', homeTeam: 'Brazil', awayTeam: 'Haiti', commenceTime: '2026-06-20T01:00:00Z', league: 'FIFA World Cup 2026 - Group C', venue: 'Lincoln Financial Field, Philadelphia' },
  // June 20
  { id: 'wc_008', match: 'Turkiye vs Paraguay', homeTeam: 'Turkiye', awayTeam: 'Paraguay', commenceTime: '2026-06-20T16:00:00Z', league: 'FIFA World Cup 2026 - Group D', venue: 'Levi\'s Stadium, San Francisco' },
  { id: 'wc_009', match: 'Netherlands vs Sweden', homeTeam: 'Netherlands', awayTeam: 'Sweden', commenceTime: '2026-06-20T17:00:00Z', league: 'FIFA World Cup 2026 - Group F', venue: 'NRG Stadium, Houston' },
  { id: 'wc_010', match: 'Germany vs Ivory Coast', homeTeam: 'Germany', awayTeam: 'Ivory Coast', commenceTime: '2026-06-20T20:00:00Z', league: 'FIFA World Cup 2026 - Group E', venue: 'BMO Field, Toronto' },
  { id: 'wc_011', match: 'Ecuador vs Curacao', homeTeam: 'Ecuador', awayTeam: 'Curacao', commenceTime: '2026-06-20T23:00:00Z', league: 'FIFA World Cup 2026 - Group E', venue: 'Arrowhead Stadium, Kansas City' },
  // June 21
  { id: 'wc_012', match: 'Spain vs Saudi Arabia', homeTeam: 'Spain', awayTeam: 'Saudi Arabia', commenceTime: '2026-06-21T16:00:00Z', league: 'FIFA World Cup 2026 - Group H', venue: 'Estadio Akron, Guadalajara' },
  { id: 'wc_013', match: 'Belgium vs Iran', homeTeam: 'Belgium', awayTeam: 'Iran', commenceTime: '2026-06-21T19:00:00Z', league: 'FIFA World Cup 2026 - Group G', venue: 'Lumen Field, Seattle' },
  { id: 'wc_014', match: 'Uruguay vs Cabo Verde', homeTeam: 'Uruguay', awayTeam: 'Cabo Verde', commenceTime: '2026-06-21T22:00:00Z', league: 'FIFA World Cup 2026 - Group H', venue: 'Estadio Akron, Guadalajara' },
  { id: 'wc_015', match: 'New Zealand vs Egypt', homeTeam: 'New Zealand', awayTeam: 'Egypt', commenceTime: '2026-06-22T01:00:00Z', league: 'FIFA World Cup 2026 - Group G', venue: 'BC Place, Vancouver' },
  // June 22
  { id: 'wc_016', match: 'Argentina vs Austria', homeTeam: 'Argentina', awayTeam: 'Austria', commenceTime: '2026-06-22T17:00:00Z', league: 'FIFA World Cup 2026 - Group J', venue: 'AT&T Stadium, Dallas' },
  { id: 'wc_017', match: 'France vs Iraq', homeTeam: 'France', awayTeam: 'Iraq', commenceTime: '2026-06-22T21:00:00Z', league: 'FIFA World Cup 2026 - Group I', venue: 'Gillette Stadium, Boston' },
  { id: 'wc_018', match: 'Norway vs Senegal', homeTeam: 'Norway', awayTeam: 'Senegal', commenceTime: '2026-06-23T00:00:00Z', league: 'FIFA World Cup 2026 - Group I', venue: 'BMO Field, Toronto' },
  // June 23
  { id: 'wc_019', match: 'Portugal vs Uzbekistan', homeTeam: 'Portugal', awayTeam: 'Uzbekistan', commenceTime: '2026-06-23T17:00:00Z', league: 'FIFA World Cup 2026 - Group K', venue: 'NRG Stadium, Houston' },
  { id: 'wc_020', match: 'England vs Ghana', homeTeam: 'England', awayTeam: 'Ghana', commenceTime: '2026-06-23T20:00:00Z', league: 'FIFA World Cup 2026 - Group L 🇬🇭', venue: 'Gillette Stadium, Boston' },
  { id: 'wc_021', match: 'Panama vs Croatia', homeTeam: 'Panama', awayTeam: 'Croatia', commenceTime: '2026-06-23T23:00:00Z', league: 'FIFA World Cup 2026 - Group L', venue: 'MetLife Stadium, New York' },
  { id: 'wc_022', match: 'Colombia vs DR Congo', homeTeam: 'Colombia', awayTeam: 'DR Congo', commenceTime: '2026-06-24T02:00:00Z', league: 'FIFA World Cup 2026 - Group K', venue: 'Hard Rock Stadium, Miami' },
  // June 24
  { id: 'wc_023', match: 'Switzerland vs Canada', homeTeam: 'Switzerland', awayTeam: 'Canada', commenceTime: '2026-06-24T19:00:00Z', league: 'FIFA World Cup 2026 - Group B', venue: 'BC Place, Vancouver' },
  { id: 'wc_024', match: 'Bosnia and Herzegovina vs Qatar', homeTeam: 'Bosnia and Herzegovina', awayTeam: 'Qatar', commenceTime: '2026-06-24T19:00:00Z', league: 'FIFA World Cup 2026 - Group B', venue: 'AT&T Stadium, Dallas' },
  { id: 'wc_025', match: 'Scotland vs Brazil', homeTeam: 'Scotland', awayTeam: 'Brazil', commenceTime: '2026-06-24T22:00:00Z', league: 'FIFA World Cup 2026 - Group C', venue: 'SoFi Stadium, Los Angeles' },
  { id: 'wc_026', match: 'Morocco vs Haiti', homeTeam: 'Morocco', awayTeam: 'Haiti', commenceTime: '2026-06-24T22:00:00Z', league: 'FIFA World Cup 2026 - Group C', venue: 'Arrowhead Stadium, Kansas City' },
  { id: 'wc_027', match: 'Czechia vs Mexico', homeTeam: 'Czechia', awayTeam: 'Mexico', commenceTime: '2026-06-25T01:00:00Z', league: 'FIFA World Cup 2026 - Group A', venue: 'Estadio Azteca, Mexico City' },
  { id: 'wc_028', match: 'South Africa vs South Korea', homeTeam: 'South Africa', awayTeam: 'South Korea', commenceTime: '2026-06-25T01:00:00Z', league: 'FIFA World Cup 2026 - Group A', venue: 'Estadio BBVA, Monterrey' },
  // June 25
  { id: 'wc_029', match: 'Ecuador vs Germany', homeTeam: 'Ecuador', awayTeam: 'Germany', commenceTime: '2026-06-25T20:00:00Z', league: 'FIFA World Cup 2026 - Group E', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { id: 'wc_030', match: 'Curacao vs Ivory Coast', homeTeam: 'Curacao', awayTeam: 'Ivory Coast', commenceTime: '2026-06-25T20:00:00Z', league: 'FIFA World Cup 2026 - Group E', venue: 'Levi\'s Stadium, San Francisco' },
  { id: 'wc_031', match: 'Japan vs Sweden', homeTeam: 'Japan', awayTeam: 'Sweden', commenceTime: '2026-06-25T23:00:00Z', league: 'FIFA World Cup 2026 - Group F', venue: 'NRG Stadium, Houston' },
  { id: 'wc_032', match: 'Tunisia vs Netherlands', homeTeam: 'Tunisia', awayTeam: 'Netherlands', commenceTime: '2026-06-25T23:00:00Z', league: 'FIFA World Cup 2026 - Group F', venue: 'Arrowhead Stadium, Kansas City' },
  { id: 'wc_033', match: 'Turkiye vs USA', homeTeam: 'Turkiye', awayTeam: 'USA', commenceTime: '2026-06-26T02:00:00Z', league: 'FIFA World Cup 2026 - Group D', venue: 'Levi\'s Stadium, San Francisco' },
  { id: 'wc_034', match: 'Paraguay vs Australia', homeTeam: 'Paraguay', awayTeam: 'Australia', commenceTime: '2026-06-26T02:00:00Z', league: 'FIFA World Cup 2026 - Group D', venue: 'AT&T Stadium, Dallas' },
  // June 26
  { id: 'wc_035', match: 'Norway vs France', homeTeam: 'Norway', awayTeam: 'France', commenceTime: '2026-06-26T19:00:00Z', league: 'FIFA World Cup 2026 - Group I', venue: 'MetLife Stadium, New York' },
  { id: 'wc_036', match: 'Senegal vs Iraq', homeTeam: 'Senegal', awayTeam: 'Iraq', commenceTime: '2026-06-26T19:00:00Z', league: 'FIFA World Cup 2026 - Group I', venue: 'BMO Field, Toronto' },
  { id: 'wc_037', match: 'Cabo Verde vs Saudi Arabia', homeTeam: 'Cabo Verde', awayTeam: 'Saudi Arabia', commenceTime: '2026-06-27T00:00:00Z', league: 'FIFA World Cup 2026 - Group H', venue: 'NRG Stadium, Houston' },
  { id: 'wc_038', match: 'Uruguay vs Spain', homeTeam: 'Uruguay', awayTeam: 'Spain', commenceTime: '2026-06-27T00:00:00Z', league: 'FIFA World Cup 2026 - Group H', venue: 'Estadio Akron, Guadalajara' },
  // June 27
  { id: 'wc_039', match: 'Panama vs England', homeTeam: 'Panama', awayTeam: 'England', commenceTime: '2026-06-27T21:00:00Z', league: 'FIFA World Cup 2026 - Group L', venue: 'MetLife Stadium, New York' },
  { id: 'wc_040', match: 'Croatia vs Ghana', homeTeam: 'Croatia', awayTeam: 'Ghana', commenceTime: '2026-06-27T21:00:00Z', league: 'FIFA World Cup 2026 - Group L 🇬🇭', venue: 'Lincoln Financial Field, Philadelphia' },
  { id: 'wc_041', match: 'Colombia vs Portugal', homeTeam: 'Colombia', awayTeam: 'Portugal', commenceTime: '2026-06-28T01:30:00Z', league: 'FIFA World Cup 2026 - Group K', venue: 'Hard Rock Stadium, Miami' },
  { id: 'wc_042', match: 'DR Congo vs Uzbekistan', homeTeam: 'DR Congo', awayTeam: 'Uzbekistan', commenceTime: '2026-06-28T01:30:00Z', league: 'FIFA World Cup 2026 - Group K', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { id: 'wc_043', match: 'Algeria vs Austria', homeTeam: 'Algeria', awayTeam: 'Austria', commenceTime: '2026-06-28T02:00:00Z', league: 'FIFA World Cup 2026 - Group J', venue: 'Arrowhead Stadium, Kansas City' },
  { id: 'wc_044', match: 'Jordan vs Argentina', homeTeam: 'Jordan', awayTeam: 'Argentina', commenceTime: '2026-06-28T02:00:00Z', league: 'FIFA World Cup 2026 - Group J', venue: 'AT&T Stadium, Dallas' },
  // Belgium/Iran/etc June 26-27 group G
  { id: 'wc_045', match: 'Egypt vs Iran', homeTeam: 'Egypt', awayTeam: 'Iran', commenceTime: '2026-06-27T03:00:00Z', league: 'FIFA World Cup 2026 - Group G', venue: 'Lumen Field, Seattle' },
  { id: 'wc_046', match: 'New Zealand vs Belgium', homeTeam: 'New Zealand', awayTeam: 'Belgium', commenceTime: '2026-06-27T03:00:00Z', league: 'FIFA World Cup 2026 - Group G', venue: 'BC Place, Vancouver' },
];

export default async function handler(req, res) {
  const { sports } = req.query;
  const sportKeys = sports ? sports.split(',') : [];

  const now = new Date();
  const results = [];

  // Always include World Cup fixtures that are upcoming
  const wantsWorldCup = !sports || sportKeys.includes('soccer_fifa_world_cup') ||
    sportKeys.some(k => k.startsWith('soccer_'));

  if (wantsWorldCup) {
    const upcoming = WORLD_CUP_FIXTURES.filter(f => new Date(f.commenceTime) > now);
    upcoming.forEach(f => results.push({ ...f, sport: 'soccer_fifa_world_cup' }));
  }

  // Fetch other sports from TheSportsDB
  const leaguesToFetch = sportKeys
    .filter(k => k !== 'soccer_fifa_world_cup' && LEAGUE_IDS[k])
    .map(k => ({ key: k, id: LEAGUE_IDS[k] }));

  for (const { key, id } of leaguesToFetch) {
    try {
      const r = await fetch(`${BASE}/eventsnextleague.php?id=${id}`);
      if (!r.ok) continue;
      const data = await r.json();
      const events = data.events || [];
      for (const ev of events) {
        const eventDate = new Date(ev.strTimestamp || ev.dateEvent);
        if (eventDate < now) continue;
        results.push({
          id: ev.idEvent,
          sport: key,
          league: ev.strLeague,
          match: ev.strEvent,
          homeTeam: ev.strHomeTeam,
          awayTeam: ev.strAwayTeam,
          commenceTime: ev.strTimestamp || ev.dateEvent + 'T12:00:00Z',
          venue: ev.strVenue || '',
        });
      }
    } catch (err) {
      console.warn('SportsDB fetch failed for', key, err.message);
    }
  }

  // Sort by date
  results.sort((a, b) => new Date(a.commenceTime) - new Date(b.commenceTime));

  return res.status(200).json({ fixtures: results, count: results.length });
}
