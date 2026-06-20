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

// FIFA World Cup 2026 — Full Group Stage + Round of 32
// All times UTC. Ghana is in Group L with England, Panama, Croatia. 🇬🇭
const WORLD_CUP_FIXTURES = [

  // ── GROUP STAGE MATCHDAY 1 ─────────────────────────────────────────────────
  // June 18
  { id: 'wc_001', match: 'Czechia vs South Africa',               homeTeam: 'Czechia',               awayTeam: 'South Africa',          commenceTime: '2026-06-18T16:00:00Z', league: 'FIFA World Cup 2026 - Group A', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { id: 'wc_002', match: 'Switzerland vs Bosnia and Herzegovina', homeTeam: 'Switzerland',            awayTeam: 'Bosnia and Herzegovina', commenceTime: '2026-06-18T19:00:00Z', league: 'FIFA World Cup 2026 - Group B', venue: 'SoFi Stadium, Los Angeles' },
  { id: 'wc_003', match: 'Canada vs Qatar',                       homeTeam: 'Canada',                awayTeam: 'Qatar',                  commenceTime: '2026-06-18T22:00:00Z', league: 'FIFA World Cup 2026 - Group B', venue: 'BC Place, Vancouver' },
  { id: 'wc_004', match: 'Mexico vs South Korea',                 homeTeam: 'Mexico',                awayTeam: 'South Korea',            commenceTime: '2026-06-19T02:00:00Z', league: 'FIFA World Cup 2026 - Group A', venue: 'Estadio Akron, Guadalajara' },
  // June 19
  { id: 'wc_005', match: 'USA vs Australia',                      homeTeam: 'USA',                   awayTeam: 'Australia',              commenceTime: '2026-06-19T19:00:00Z', league: 'FIFA World Cup 2026 - Group D', venue: 'Lumen Field, Seattle' },
  { id: 'wc_006', match: 'Scotland vs Morocco',                   homeTeam: 'Scotland',              awayTeam: 'Morocco',                commenceTime: '2026-06-19T22:00:00Z', league: 'FIFA World Cup 2026 - Group C', venue: 'Gillette Stadium, Boston' },
  { id: 'wc_007', match: 'Brazil vs Haiti',                       homeTeam: 'Brazil',                awayTeam: 'Haiti',                  commenceTime: '2026-06-20T01:00:00Z', league: 'FIFA World Cup 2026 - Group C', venue: 'Lincoln Financial Field, Philadelphia' },
  // June 20
  { id: 'wc_008', match: 'Turkiye vs Paraguay',                   homeTeam: 'Turkiye',               awayTeam: 'Paraguay',               commenceTime: '2026-06-20T16:00:00Z', league: 'FIFA World Cup 2026 - Group D', venue: "Levi's Stadium, San Francisco" },
  { id: 'wc_009', match: 'Netherlands vs Sweden',                 homeTeam: 'Netherlands',           awayTeam: 'Sweden',                 commenceTime: '2026-06-20T17:00:00Z', league: 'FIFA World Cup 2026 - Group F', venue: 'NRG Stadium, Houston' },
  { id: 'wc_010', match: 'Germany vs Ivory Coast',                homeTeam: 'Germany',               awayTeam: 'Ivory Coast',            commenceTime: '2026-06-20T20:00:00Z', league: 'FIFA World Cup 2026 - Group E', venue: 'BMO Field, Toronto' },
  { id: 'wc_011', match: 'Ecuador vs Curacao',                    homeTeam: 'Ecuador',               awayTeam: 'Curacao',                commenceTime: '2026-06-20T23:00:00Z', league: 'FIFA World Cup 2026 - Group E', venue: 'Arrowhead Stadium, Kansas City' },
  // June 21
  { id: 'wc_012', match: 'Japan vs Tunisia',                      homeTeam: 'Japan',                 awayTeam: 'Tunisia',                commenceTime: '2026-06-21T13:00:00Z', league: 'FIFA World Cup 2026 - Group F', venue: 'Levi\'s Stadium, San Francisco' },
  { id: 'wc_013', match: 'Spain vs Saudi Arabia',                 homeTeam: 'Spain',                 awayTeam: 'Saudi Arabia',           commenceTime: '2026-06-21T16:00:00Z', league: 'FIFA World Cup 2026 - Group H', venue: 'Estadio Akron, Guadalajara' },
  { id: 'wc_014', match: 'Belgium vs Iran',                       homeTeam: 'Belgium',               awayTeam: 'Iran',                   commenceTime: '2026-06-21T19:00:00Z', league: 'FIFA World Cup 2026 - Group G', venue: 'Lumen Field, Seattle' },
  { id: 'wc_015', match: 'Uruguay vs Cabo Verde',                 homeTeam: 'Uruguay',               awayTeam: 'Cabo Verde',             commenceTime: '2026-06-21T22:00:00Z', league: 'FIFA World Cup 2026 - Group H', venue: 'Estadio Akron, Guadalajara' },
  { id: 'wc_016', match: 'New Zealand vs Egypt',                  homeTeam: 'New Zealand',           awayTeam: 'Egypt',                  commenceTime: '2026-06-22T01:00:00Z', league: 'FIFA World Cup 2026 - Group G', venue: 'BC Place, Vancouver' },
  // June 22
  { id: 'wc_017', match: 'Argentina vs Austria',                  homeTeam: 'Argentina',             awayTeam: 'Austria',                commenceTime: '2026-06-22T17:00:00Z', league: 'FIFA World Cup 2026 - Group J', venue: 'AT&T Stadium, Dallas' },
  { id: 'wc_018', match: 'France vs Iraq',                        homeTeam: 'France',                awayTeam: 'Iraq',                   commenceTime: '2026-06-22T21:00:00Z', league: 'FIFA World Cup 2026 - Group I', venue: 'Gillette Stadium, Boston' },
  { id: 'wc_019', match: 'Norway vs Senegal',                     homeTeam: 'Norway',                awayTeam: 'Senegal',                commenceTime: '2026-06-23T00:00:00Z', league: 'FIFA World Cup 2026 - Group I', venue: 'BMO Field, Toronto' },
  // June 23
  { id: 'wc_020', match: 'Portugal vs Uzbekistan',                homeTeam: 'Portugal',              awayTeam: 'Uzbekistan',             commenceTime: '2026-06-23T17:00:00Z', league: 'FIFA World Cup 2026 - Group K', venue: 'NRG Stadium, Houston' },
  { id: 'wc_021', match: 'England vs Ghana 🇬🇭',                  homeTeam: 'England',               awayTeam: 'Ghana',                  commenceTime: '2026-06-23T20:00:00Z', league: 'FIFA World Cup 2026 - Group L 🇬🇭', venue: 'Gillette Stadium, Boston' },
  { id: 'wc_022', match: 'Panama vs Croatia',                     homeTeam: 'Panama',                awayTeam: 'Croatia',                commenceTime: '2026-06-23T23:00:00Z', league: 'FIFA World Cup 2026 - Group L', venue: 'MetLife Stadium, New York' },
  { id: 'wc_023', match: 'Colombia vs DR Congo',                  homeTeam: 'Colombia',              awayTeam: 'DR Congo',               commenceTime: '2026-06-24T02:00:00Z', league: 'FIFA World Cup 2026 - Group K', venue: 'Hard Rock Stadium, Miami' },
  // June 24
  { id: 'wc_024', match: 'Algeria vs Jordan',                     homeTeam: 'Algeria',               awayTeam: 'Jordan',                 commenceTime: '2026-06-24T13:00:00Z', league: 'FIFA World Cup 2026 - Group J', venue: 'Arrowhead Stadium, Kansas City' },

  // ── GROUP STAGE MATCHDAY 2 ─────────────────────────────────────────────────
  // June 24
  { id: 'wc_025', match: 'Switzerland vs Canada',                 homeTeam: 'Switzerland',           awayTeam: 'Canada',                 commenceTime: '2026-06-24T19:00:00Z', league: 'FIFA World Cup 2026 - Group B', venue: 'BC Place, Vancouver' },
  { id: 'wc_026', match: 'Bosnia and Herzegovina vs Qatar',       homeTeam: 'Bosnia and Herzegovina', awayTeam: 'Qatar',                 commenceTime: '2026-06-24T19:00:00Z', league: 'FIFA World Cup 2026 - Group B', venue: 'AT&T Stadium, Dallas' },
  { id: 'wc_027', match: 'Scotland vs Brazil',                    homeTeam: 'Scotland',              awayTeam: 'Brazil',                 commenceTime: '2026-06-24T22:00:00Z', league: 'FIFA World Cup 2026 - Group C', venue: 'SoFi Stadium, Los Angeles' },
  { id: 'wc_028', match: 'Morocco vs Haiti',                      homeTeam: 'Morocco',               awayTeam: 'Haiti',                  commenceTime: '2026-06-24T22:00:00Z', league: 'FIFA World Cup 2026 - Group C', venue: 'Arrowhead Stadium, Kansas City' },
  { id: 'wc_029', match: 'Czechia vs Mexico',                     homeTeam: 'Czechia',               awayTeam: 'Mexico',                 commenceTime: '2026-06-25T01:00:00Z', league: 'FIFA World Cup 2026 - Group A', venue: 'Estadio Azteca, Mexico City' },
  { id: 'wc_030', match: 'South Africa vs South Korea',           homeTeam: 'South Africa',          awayTeam: 'South Korea',            commenceTime: '2026-06-25T01:00:00Z', league: 'FIFA World Cup 2026 - Group A', venue: 'Estadio BBVA, Monterrey' },
  // June 25
  { id: 'wc_031', match: 'Ecuador vs Germany',                    homeTeam: 'Ecuador',               awayTeam: 'Germany',                commenceTime: '2026-06-25T20:00:00Z', league: 'FIFA World Cup 2026 - Group E', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { id: 'wc_032', match: 'Curacao vs Ivory Coast',                homeTeam: 'Curacao',               awayTeam: 'Ivory Coast',            commenceTime: '2026-06-25T20:00:00Z', league: 'FIFA World Cup 2026 - Group E', venue: "Levi's Stadium, San Francisco" },
  { id: 'wc_033', match: 'Japan vs Sweden',                       homeTeam: 'Japan',                 awayTeam: 'Sweden',                 commenceTime: '2026-06-25T23:00:00Z', league: 'FIFA World Cup 2026 - Group F', venue: 'NRG Stadium, Houston' },
  { id: 'wc_034', match: 'Tunisia vs Netherlands',                homeTeam: 'Tunisia',               awayTeam: 'Netherlands',            commenceTime: '2026-06-25T23:00:00Z', league: 'FIFA World Cup 2026 - Group F', venue: 'Arrowhead Stadium, Kansas City' },
  { id: 'wc_035', match: 'Turkiye vs USA',                        homeTeam: 'Turkiye',               awayTeam: 'USA',                    commenceTime: '2026-06-26T02:00:00Z', league: 'FIFA World Cup 2026 - Group D', venue: "Levi's Stadium, San Francisco" },
  { id: 'wc_036', match: 'Paraguay vs Australia',                 homeTeam: 'Paraguay',              awayTeam: 'Australia',              commenceTime: '2026-06-26T02:00:00Z', league: 'FIFA World Cup 2026 - Group D', venue: 'AT&T Stadium, Dallas' },
  // June 26
  { id: 'wc_037', match: 'Norway vs France',                      homeTeam: 'Norway',                awayTeam: 'France',                 commenceTime: '2026-06-26T19:00:00Z', league: 'FIFA World Cup 2026 - Group I', venue: 'MetLife Stadium, New York' },
  { id: 'wc_038', match: 'Senegal vs Iraq',                       homeTeam: 'Senegal',               awayTeam: 'Iraq',                   commenceTime: '2026-06-26T19:00:00Z', league: 'FIFA World Cup 2026 - Group I', venue: 'BMO Field, Toronto' },
  { id: 'wc_039', match: 'Egypt vs Iran',                         homeTeam: 'Egypt',                 awayTeam: 'Iran',                   commenceTime: '2026-06-27T03:00:00Z', league: 'FIFA World Cup 2026 - Group G', venue: 'Lumen Field, Seattle' },
  { id: 'wc_040', match: 'New Zealand vs Belgium',                homeTeam: 'New Zealand',           awayTeam: 'Belgium',                commenceTime: '2026-06-27T03:00:00Z', league: 'FIFA World Cup 2026 - Group G', venue: 'BC Place, Vancouver' },
  { id: 'wc_041', match: 'Cabo Verde vs Saudi Arabia',            homeTeam: 'Cabo Verde',            awayTeam: 'Saudi Arabia',           commenceTime: '2026-06-27T00:00:00Z', league: 'FIFA World Cup 2026 - Group H', venue: 'NRG Stadium, Houston' },
  { id: 'wc_042', match: 'Uruguay vs Spain',                      homeTeam: 'Uruguay',               awayTeam: 'Spain',                  commenceTime: '2026-06-27T00:00:00Z', league: 'FIFA World Cup 2026 - Group H', venue: 'Estadio Akron, Guadalajara' },
  // June 27 — Group L (Ghana's games)
  { id: 'wc_043', match: 'Panama vs England',                     homeTeam: 'Panama',                awayTeam: 'England',                commenceTime: '2026-06-27T21:00:00Z', league: 'FIFA World Cup 2026 - Group L', venue: 'MetLife Stadium, New York' },
  { id: 'wc_044', match: 'Croatia vs Ghana 🇬🇭',                  homeTeam: 'Croatia',               awayTeam: 'Ghana',                  commenceTime: '2026-06-27T21:00:00Z', league: 'FIFA World Cup 2026 - Group L 🇬🇭', venue: 'Lincoln Financial Field, Philadelphia' },
  { id: 'wc_045', match: 'Colombia vs Portugal',                  homeTeam: 'Colombia',              awayTeam: 'Portugal',               commenceTime: '2026-06-28T01:30:00Z', league: 'FIFA World Cup 2026 - Group K', venue: 'Hard Rock Stadium, Miami' },
  { id: 'wc_046', match: 'DR Congo vs Uzbekistan',                homeTeam: 'DR Congo',              awayTeam: 'Uzbekistan',             commenceTime: '2026-06-28T01:30:00Z', league: 'FIFA World Cup 2026 - Group K', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { id: 'wc_047', match: 'Algeria vs Austria',                    homeTeam: 'Algeria',               awayTeam: 'Austria',                commenceTime: '2026-06-28T02:00:00Z', league: 'FIFA World Cup 2026 - Group J', venue: 'Arrowhead Stadium, Kansas City' },
  { id: 'wc_048', match: 'Jordan vs Argentina',                   homeTeam: 'Jordan',                awayTeam: 'Argentina',              commenceTime: '2026-06-28T02:00:00Z', league: 'FIFA World Cup 2026 - Group J', venue: 'AT&T Stadium, Dallas' },

  // ── GROUP STAGE MATCHDAY 3 ─────────────────────────────────────────────────
  // June 28–29
  { id: 'wc_049', match: 'South Korea vs Czechia',                homeTeam: 'South Korea',           awayTeam: 'Czechia',                commenceTime: '2026-06-29T19:00:00Z', league: 'FIFA World Cup 2026 - Group A', venue: 'Estadio Azteca, Mexico City' },
  { id: 'wc_050', match: 'South Africa vs Mexico',                homeTeam: 'South Africa',          awayTeam: 'Mexico',                 commenceTime: '2026-06-29T19:00:00Z', league: 'FIFA World Cup 2026 - Group A', venue: 'Estadio BBVA, Monterrey' },
  { id: 'wc_051', match: 'Qatar vs Switzerland',                  homeTeam: 'Qatar',                 awayTeam: 'Switzerland',            commenceTime: '2026-06-29T23:00:00Z', league: 'FIFA World Cup 2026 - Group B', venue: 'SoFi Stadium, Los Angeles' },
  { id: 'wc_052', match: 'Canada vs Bosnia and Herzegovina',      homeTeam: 'Canada',                awayTeam: 'Bosnia and Herzegovina', commenceTime: '2026-06-29T23:00:00Z', league: 'FIFA World Cup 2026 - Group B', venue: 'BC Place, Vancouver' },
  // June 30 — Group L Matchday 3
  { id: 'wc_053', match: 'Ghana vs Panama 🇬🇭',                   homeTeam: 'Ghana',                 awayTeam: 'Panama',                 commenceTime: '2026-06-30T19:00:00Z', league: 'FIFA World Cup 2026 - Group L 🇬🇭', venue: 'AT&T Stadium, Dallas' },
  { id: 'wc_054', match: 'Croatia vs England',                    homeTeam: 'Croatia',               awayTeam: 'England',                commenceTime: '2026-06-30T19:00:00Z', league: 'FIFA World Cup 2026 - Group L', venue: 'MetLife Stadium, New York' },
  { id: 'wc_055', match: 'Haiti vs Scotland',                     homeTeam: 'Haiti',                 awayTeam: 'Scotland',               commenceTime: '2026-06-30T23:00:00Z', league: 'FIFA World Cup 2026 - Group C', venue: 'Arrowhead Stadium, Kansas City' },
  { id: 'wc_056', match: 'Brazil vs Morocco',                     homeTeam: 'Brazil',                awayTeam: 'Morocco',                commenceTime: '2026-06-30T23:00:00Z', league: 'FIFA World Cup 2026 - Group C', venue: 'SoFi Stadium, Los Angeles' },
  { id: 'wc_057', match: 'Australia vs Turkiye',                  homeTeam: 'Australia',             awayTeam: 'Turkiye',                commenceTime: '2026-07-01T03:00:00Z', league: 'FIFA World Cup 2026 - Group D', venue: 'Lumen Field, Seattle' },
  { id: 'wc_058', match: 'Paraguay vs USA',                       homeTeam: 'Paraguay',              awayTeam: 'USA',                    commenceTime: '2026-07-01T03:00:00Z', league: 'FIFA World Cup 2026 - Group D', venue: 'AT&T Stadium, Dallas' },
  { id: 'wc_059', match: 'Ivory Coast vs Ecuador',                homeTeam: 'Ivory Coast',           awayTeam: 'Ecuador',                commenceTime: '2026-07-01T19:00:00Z', league: 'FIFA World Cup 2026 - Group E', venue: 'BMO Field, Toronto' },
  { id: 'wc_060', match: 'Germany vs Curacao',                    homeTeam: 'Germany',               awayTeam: 'Curacao',                commenceTime: '2026-07-01T19:00:00Z', league: 'FIFA World Cup 2026 - Group E', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { id: 'wc_061', match: 'Sweden vs Japan',                       homeTeam: 'Sweden',                awayTeam: 'Japan',                  commenceTime: '2026-07-01T23:00:00Z', league: 'FIFA World Cup 2026 - Group F', venue: 'NRG Stadium, Houston' },
  { id: 'wc_062', match: 'Netherlands vs Tunisia',                homeTeam: 'Netherlands',           awayTeam: 'Tunisia',                commenceTime: '2026-07-01T23:00:00Z', league: 'FIFA World Cup 2026 - Group F', venue: 'Arrowhead Stadium, Kansas City' },
  { id: 'wc_063', match: 'Iran vs New Zealand',                   homeTeam: 'Iran',                  awayTeam: 'New Zealand',            commenceTime: '2026-07-02T03:00:00Z', league: 'FIFA World Cup 2026 - Group G', venue: 'BC Place, Vancouver' },
  { id: 'wc_064', match: 'Belgium vs Egypt',                      homeTeam: 'Belgium',               awayTeam: 'Egypt',                  commenceTime: '2026-07-02T03:00:00Z', league: 'FIFA World Cup 2026 - Group G', venue: 'Lumen Field, Seattle' },
  { id: 'wc_065', match: 'Saudi Arabia vs Uruguay',               homeTeam: 'Saudi Arabia',          awayTeam: 'Uruguay',                commenceTime: '2026-07-02T19:00:00Z', league: 'FIFA World Cup 2026 - Group H', venue: 'Estadio Akron, Guadalajara' },
  { id: 'wc_066', match: 'Spain vs Cabo Verde',                   homeTeam: 'Spain',                 awayTeam: 'Cabo Verde',             commenceTime: '2026-07-02T19:00:00Z', league: 'FIFA World Cup 2026 - Group H', venue: 'Hard Rock Stadium, Miami' },
  { id: 'wc_067', match: 'Iraq vs Norway',                        homeTeam: 'Iraq',                  awayTeam: 'Norway',                 commenceTime: '2026-07-02T23:00:00Z', league: 'FIFA World Cup 2026 - Group I', venue: 'BMO Field, Toronto' },
  { id: 'wc_068', match: 'France vs Senegal',                     homeTeam: 'France',                awayTeam: 'Senegal',                commenceTime: '2026-07-02T23:00:00Z', league: 'FIFA World Cup 2026 - Group I', venue: 'Gillette Stadium, Boston' },
  { id: 'wc_069', match: 'Austria vs Algeria',                    homeTeam: 'Austria',               awayTeam: 'Algeria',                commenceTime: '2026-07-03T03:00:00Z', league: 'FIFA World Cup 2026 - Group J', venue: 'AT&T Stadium, Dallas' },
  { id: 'wc_070', match: 'Argentina vs Jordan',                   homeTeam: 'Argentina',             awayTeam: 'Jordan',                 commenceTime: '2026-07-03T03:00:00Z', league: 'FIFA World Cup 2026 - Group J', venue: 'Arrowhead Stadium, Kansas City' },
  { id: 'wc_071', match: 'Uzbekistan vs Colombia',                homeTeam: 'Uzbekistan',            awayTeam: 'Colombia',               commenceTime: '2026-07-03T19:00:00Z', league: 'FIFA World Cup 2026 - Group K', venue: 'NRG Stadium, Houston' },
  { id: 'wc_072', match: 'Portugal vs DR Congo',                  homeTeam: 'Portugal',              awayTeam: 'DR Congo',               commenceTime: '2026-07-03T19:00:00Z', league: 'FIFA World Cup 2026 - Group K', venue: 'Mercedes-Benz Stadium, Atlanta' },

  // ── ROUND OF 32 (placeholders — teams TBD after group stage) ──────────────
  { id: 'wc_r32_01', match: 'R32: 1A vs 2C',   homeTeam: 'Winner Group A', awayTeam: 'Runner-up Group C', commenceTime: '2026-07-04T19:00:00Z', league: 'FIFA World Cup 2026 - Round of 32', venue: 'MetLife Stadium, New York' },
  { id: 'wc_r32_02', match: 'R32: 1B vs 2D',   homeTeam: 'Winner Group B', awayTeam: 'Runner-up Group D', commenceTime: '2026-07-04T23:00:00Z', league: 'FIFA World Cup 2026 - Round of 32', venue: 'AT&T Stadium, Dallas' },
  { id: 'wc_r32_03', match: 'R32: 1C vs 2A',   homeTeam: 'Winner Group C', awayTeam: 'Runner-up Group A', commenceTime: '2026-07-05T19:00:00Z', league: 'FIFA World Cup 2026 - Round of 32', venue: 'Levi\'s Stadium, San Francisco' },
  { id: 'wc_r32_04', match: 'R32: 1D vs 2B',   homeTeam: 'Winner Group D', awayTeam: 'Runner-up Group B', commenceTime: '2026-07-05T23:00:00Z', league: 'FIFA World Cup 2026 - Round of 32', venue: 'SoFi Stadium, Los Angeles' },
  { id: 'wc_r32_05', match: 'R32: 1E vs 2G',   homeTeam: 'Winner Group E', awayTeam: 'Runner-up Group G', commenceTime: '2026-07-06T19:00:00Z', league: 'FIFA World Cup 2026 - Round of 32', venue: 'NRG Stadium, Houston' },
  { id: 'wc_r32_06', match: 'R32: 1F vs 2H',   homeTeam: 'Winner Group F', awayTeam: 'Runner-up Group H', commenceTime: '2026-07-06T23:00:00Z', league: 'FIFA World Cup 2026 - Round of 32', venue: 'Lumen Field, Seattle' },
  { id: 'wc_r32_07', match: 'R32: 1G vs 2E',   homeTeam: 'Winner Group G', awayTeam: 'Runner-up Group E', commenceTime: '2026-07-07T19:00:00Z', league: 'FIFA World Cup 2026 - Round of 32', venue: 'BMO Field, Toronto' },
  { id: 'wc_r32_08', match: 'R32: 1H vs 2F',   homeTeam: 'Winner Group H', awayTeam: 'Runner-up Group F', commenceTime: '2026-07-07T23:00:00Z', league: 'FIFA World Cup 2026 - Round of 32', venue: 'Arrowhead Stadium, Kansas City' },
  { id: 'wc_r32_09', match: 'R32: 1I vs 2K',   homeTeam: 'Winner Group I', awayTeam: 'Runner-up Group K', commenceTime: '2026-07-08T19:00:00Z', league: 'FIFA World Cup 2026 - Round of 32', venue: 'Gillette Stadium, Boston' },
  { id: 'wc_r32_10', match: 'R32: 1J vs 2L',   homeTeam: 'Winner Group J', awayTeam: 'Runner-up Group L', commenceTime: '2026-07-08T23:00:00Z', league: 'FIFA World Cup 2026 - Round of 32', venue: 'Hard Rock Stadium, Miami' },
  { id: 'wc_r32_11', match: 'R32: 1K vs 2I',   homeTeam: 'Winner Group K', awayTeam: 'Runner-up Group I', commenceTime: '2026-07-09T19:00:00Z', league: 'FIFA World Cup 2026 - Round of 32', venue: 'Lincoln Financial Field, Philadelphia' },
  { id: 'wc_r32_12', match: 'R32: 1L vs 2J 🇬🇭', homeTeam: 'Winner Group L', awayTeam: 'Runner-up Group J', commenceTime: '2026-07-09T23:00:00Z', league: 'FIFA World Cup 2026 - Round of 32 🇬🇭', venue: 'Mercedes-Benz Stadium, Atlanta' },
];

export default async function handler(req, res) {
  const { sports } = req.query;
  const sportKeys = sports ? sports.split(',') : [];

  // Show games that haven't kicked off yet, OR kicked off within the last 105 min
  // (allows in-progress games to remain visible in the analyzer)
  const now = new Date();
  const cutoff = new Date(now.getTime() - 105 * 60 * 1000);
  const results = [];

  // Always include World Cup fixtures unless caller explicitly excludes soccer
  const wantsWorldCup = !sports || sportKeys.includes('soccer_fifa_world_cup') ||
    sportKeys.some(k => k.startsWith('soccer_'));

  if (wantsWorldCup) {
    const relevant = WORLD_CUP_FIXTURES.filter(f => new Date(f.commenceTime) > cutoff);
    relevant.forEach(f => results.push({ ...f, sport: 'soccer_fifa_world_cup' }));
  }

  // Fetch other sports from TheSportsDB in parallel, each with a 5 s timeout
  const leaguesToFetch = sportKeys
    .filter(k => k !== 'soccer_fifa_world_cup' && LEAGUE_IDS[k])
    .map(k => ({ key: k, id: LEAGUE_IDS[k] }));

  const fetchLeague = async ({ key, id }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const r = await fetch(`${BASE}/eventsnextleague.php?id=${id}`, { signal: controller.signal });
      if (!r.ok) return [];
      const data = await r.json();
      const events = data.events || [];
      const out = [];
      for (const ev of events) {
        const eventDate = new Date(ev.strTimestamp || ev.dateEvent);
        if (eventDate < cutoff) continue;
        out.push({
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
      return out;
    } catch (err) {
      console.warn('SportsDB fetch failed for', key, err.message);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  };

  const leagueResults = await Promise.all(leaguesToFetch.map(fetchLeague));
  leagueResults.forEach(events => results.push(...events));

  results.sort((a, b) => new Date(a.commenceTime) - new Date(b.commenceTime));

  return res.status(200).json({ fixtures: results, count: results.length });
}
