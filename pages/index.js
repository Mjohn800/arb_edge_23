'use client';
import React, { useState, useEffect, useCallback, createElement } from 'react';

// ─── BOOKMAKERS ───────────────────────────────────────────────────────────────
const BOOKS = {
  // ── Global / Rest of World ─────────────────────────────────────────────────
  pinnacle:      { name: 'Pinnacle',     momo: false, licensed: false, manual: false, accessible: false, sharp: true,  wa: false, url: 'https://www.pinnacle.com/en/soccer/matchups', sportUrls: { soccer: 'https://www.pinnacle.com/en/soccer/matchups', basketball: 'https://www.pinnacle.com/en/basketball/matchups', tennis: 'https://www.pinnacle.com/en/tennis/matchups', cricket: 'https://www.pinnacle.com/en/cricket/matchups', mma: 'https://www.pinnacle.com/en/mixed-martial-arts/matchups' } },
  betfair_ex_eu: { name: 'Betfair',      momo: false, licensed: false, manual: false, accessible: false, sharp: true,  wa: false, url: 'https://www.betfair.com/exchange/plus/football', sportUrls: { soccer: 'https://www.betfair.com/exchange/plus/football', basketball: 'https://www.betfair.com/exchange/plus/basketball', tennis: 'https://www.betfair.com/exchange/plus/tennis', cricket: 'https://www.betfair.com/exchange/plus/cricket', mma: 'https://www.betfair.com/exchange/plus/mixed-martial-arts' } },
  betfair_ex_uk: { name: 'Betfair UK',   momo: false, licensed: false, manual: false, accessible: false, sharp: true,  wa: false, url: 'https://www.betfair.com/exchange/plus/football', sportUrls: { soccer: 'https://www.betfair.com/exchange/plus/football' } },
  singbet:       { name: 'Singbet',      momo: false, licensed: false, manual: false, accessible: false, sharp: true,  wa: false, url: 'https://www.singbet.com', sportUrls: {} },
  sbobet:        { name: 'SBOBet',       momo: false, licensed: false, manual: false, accessible: false, sharp: true,  wa: false, url: 'https://www.sbobet.com', sportUrls: {} },
  bet365:        { name: 'Bet365',       momo: false, licensed: false, manual: false, accessible: false, sharp: false, wa: false, url: 'https://www.bet365.com/#/AS/B1/', sportUrls: { soccer: 'https://www.bet365.com/#/AS/B1/', basketball: 'https://www.bet365.com/#/AS/B18/', tennis: 'https://www.bet365.com/#/AS/B13/', cricket: 'https://www.bet365.com/#/AS/B19/', mma: 'https://www.bet365.com/#/AS/B14/' } },
  marathonbet:   { name: 'MarathonBet',  momo: false, licensed: false, manual: false, accessible: false, sharp: false, wa: false, url: 'https://www.marathonbet.com/en/betting/Football', sportUrls: { soccer: 'https://www.marathonbet.com/en/betting/Football', basketball: 'https://www.marathonbet.com/en/betting/Basketball', tennis: 'https://www.marathonbet.com/en/betting/Tennis', cricket: 'https://www.marathonbet.com/en/betting/Cricket', mma: 'https://www.marathonbet.com/en/betting/MMA' } },
  unibet_eu:     { name: 'Unibet',       momo: false, licensed: false, manual: false, accessible: false, sharp: false, wa: false, url: 'https://www.unibet.com/betting/sports/filter/football/all/matches', sportUrls: { soccer: 'https://www.unibet.com/betting/sports/filter/football/all/matches', basketball: 'https://www.unibet.com/betting/sports/filter/basketball/all/matches', tennis: 'https://www.unibet.com/betting/sports/filter/tennis/all/matches', cricket: 'https://www.unibet.com/betting/sports/filter/cricket/all/matches', mma: 'https://www.unibet.com/betting/sports/filter/mma/all/matches' } },
  williamhill:   { name: 'William Hill', momo: false, licensed: false, manual: false, accessible: false, sharp: false, wa: false, url: 'https://www.williamhill.com/sports/football', sportUrls: { soccer: 'https://www.williamhill.com/sports/football', basketball: 'https://www.williamhill.com/sports/basketball', tennis: 'https://www.williamhill.com/sports/tennis', cricket: 'https://www.williamhill.com/sports/cricket', mma: 'https://www.williamhill.com/sports/mma' } },
  footballcom:   { name: 'Football.com', momo: false, licensed: false, manual: true,  accessible: false, sharp: false, wa: false, url: 'https://www.football.com/betting', sportUrls: { soccer: 'https://www.football.com/betting/football' } },

  // ── West Africa + Global (accessible in WA, also in global feed) ───────────
  '1xbet':       { name: '1xBet',        momo: true,  licensed: true,  manual: false, accessible: true,  sharp: true,  wa: true,  url: 'https://1xbet.com/en/line', sportUrls: { soccer: 'https://1xbet.com/en/line/football', basketball: 'https://1xbet.com/en/line/basketball', tennis: 'https://1xbet.com/en/line/tennis', cricket: 'https://1xbet.com/en/line/cricket', mma: 'https://1xbet.com/en/line/mma' } },
  onexbet:       { name: '1xBet',        momo: true,  licensed: true,  manual: false, accessible: true,  sharp: true,  wa: true,  url: 'https://1xbet.com/en/line', sportUrls: { soccer: 'https://1xbet.com/en/line/football', basketball: 'https://1xbet.com/en/line/basketball', tennis: 'https://1xbet.com/en/line/tennis', cricket: 'https://1xbet.com/en/line/cricket', mma: 'https://1xbet.com/en/line/mma' } },
  melbet:        { name: 'MelBet',       momo: true,  licensed: false, manual: false, accessible: true,  sharp: false, wa: true,  url: 'https://melbet.com/en/sport/football', sportUrls: { soccer: 'https://melbet.com/en/sport/football', basketball: 'https://melbet.com/en/sport/basketball', tennis: 'https://melbet.com/en/sport/tennis', cricket: 'https://melbet.com/en/sport/cricket', mma: 'https://melbet.com/en/sport/mma' } },
  betway:        { name: 'Betway',       momo: true,  licensed: true,  manual: false, accessible: true,  sharp: false, wa: true,  url: 'https://www.betway.com.gh/sports/all-sports', sportUrls: { soccer: 'https://www.betway.com.gh/sports/soccer', basketball: 'https://www.betway.com.gh/sports/basketball', tennis: 'https://www.betway.com.gh/sports/tennis', cricket: 'https://www.betway.com.gh/sports/cricket', mma: 'https://www.betway.com.gh/sports/mma' } },

  // ── West Africa only (scraped, not in global API feed) ────────────────────
  sportybet:     { name: 'SportyBet',    momo: true,  licensed: true,  manual: false, accessible: true,  sharp: false, wa: true,  url: 'https://www.sportybet.com/gh/sport/football', sportUrls: { soccer: 'https://www.sportybet.com/gh/sport/football', basketball: 'https://www.sportybet.com/gh/sport/basketball', tennis: 'https://www.sportybet.com/gh/sport/tennis', cricket: 'https://www.sportybet.com/gh/sport/cricket', mma: 'https://www.sportybet.com/gh/sport/mma' } },
  betano:        { name: 'Betano',       momo: true,  licensed: false, manual: false, accessible: true,  sharp: false, wa: true,  url: 'https://www.betano.com.gh/sport/football', sportUrls: { soccer: 'https://www.betano.com.gh/sport/football', basketball: 'https://www.betano.com.gh/sport/basketball', tennis: 'https://www.betano.com.gh/sport/tennis', cricket: 'https://www.betano.com.gh/sport/cricket', mma: 'https://www.betano.com.gh/sport/mma' } },
  msport:        { name: 'MSport',       momo: true,  licensed: false, manual: false, accessible: true,  sharp: false, wa: true,  url: 'https://www.msport.com/gh/football', sportUrls: { soccer: 'https://www.msport.com/gh/football', basketball: 'https://www.msport.com/gh/basketball', tennis: 'https://www.msport.com/gh/tennis', cricket: 'https://www.msport.com/gh/cricket', mma: 'https://www.msport.com/gh/mma' } },
};

const API_BOOKS = Object.entries(BOOKS).filter(([,b]) => !b.manual).map(([k]) => k);
const MANUAL_BOOKS = Object.entries(BOOKS).filter(([,b]) => b.manual);
const ACCESSIBLE_BOOKS = Object.entries(BOOKS).filter(([,b]) => b.accessible).map(([k]) => k);

// Runtime accessibility check — uses server-detected region if available,
// falls back to the static BOOKS.accessible flag (WA default) otherwise.
// Components call this instead of BOOKS[key]?.accessible directly.
const isBookAccessible = (bookKey, userRegion) => {
  if (userRegion?.accessibleBooks) return userRegion.accessibleBooks.includes(bookKey);
  return !!BOOKS[bookKey]?.accessible;
};

// Fully accessible = every leg of the arb is on a book accessible to this user
const isFullyAccessible = (outcomes, userRegion) => (outcomes || []).every(o => isBookAccessible(o.book, userRegion));

// ─── AFFILIATE PROGRAMS ─────────────────────────────────────────────────────
// Verified 2026-06-24 against each program's own official domain (not third-party
// aggregator/reseller sites). SportyBet's GH-region partner path is inferred from
// its consistent /{region}/... pattern used everywhere else on the site — the NG
// path (sportybet.com/ng/partner) was directly confirmed live; double check the
// /gh/ variant resolves the same way before relying on it, swap to whichever
// region path actually works for you.
const EARN_PROGRAMS = [
  { key: 'sportybet', name: 'SportyBet Affiliates', commission: '20–40% revenue share, or $10–50 CPA per qualifying signup (GH)', signupUrl: 'https://www.sportybet.com/gh/partner' },
  { key: 'betway',    name: 'Betway Partners',      commission: '25% flat revenue share (CPA negotiable), no negative carryover', signupUrl: 'https://www.betway.partners/' },
  { key: '1xbet',     name: '1xPartners (1xBet)',   commission: '15–40% revenue share (scales up with volume), or CPA/Hybrid', signupUrl: 'https://1xpartners.com/' },
];

// Has at least one WA book in any leg
const hasWABook = (outcomes) => (outcomes || []).some(o => BOOKS[o.book]?.wa);

// True if ALL legs are WA books (pure WA arb — no global books needed)
const isPureWAArb = (outcomes) => (outcomes || []).length > 0 && (outcomes || []).every(o => BOOKS[o.book]?.wa);

const SPORT_GROUPS = [
  { group: '⚽ Africa & World', sports: [
    { key: 'soccer_africa_cup_of_nations', label: 'AFCON', region: 'eu' },
    { key: 'soccer_fifa_world_cup', label: 'FIFA World Cup (Men)', region: 'eu,uk' },
    { key: 'soccer_fifa_world_cup_womens', label: 'FIFA World Cup (Women)', region: 'eu,uk' },
    { key: 'soccer_fifa_club_world_cup', label: 'FIFA Club World Cup', region: 'eu,uk' },
    { key: 'soccer_ghana_premiership', label: 'Ghana Premier League', region: 'eu' },
    { key: 'soccer_fifa_world_cup_winner', label: 'World Cup Winner (Outright)', region: 'eu' },
  ]},
  { group: '⚽ Europe - Top 5 Leagues', sports: [
    { key: 'soccer_epl', label: 'EPL (England)', region: 'uk,eu' },
    { key: 'soccer_efl_champ', label: 'Championship (England)', region: 'uk,eu' },
    { key: 'soccer_england_league1', label: 'League 1 (England)', region: 'uk,eu' },
    { key: 'soccer_fa_cup', label: 'FA Cup', region: 'uk,eu' },
    { key: 'soccer_england_efl_cup', label: 'EFL Cup', region: 'uk,eu' },
    { key: 'soccer_germany_bundesliga', label: 'Bundesliga (Germany)', region: 'uk,eu' },
    { key: 'soccer_germany_bundesliga2', label: 'Bundesliga 2', region: 'uk,eu' },
    { key: 'soccer_germany_bundesliga_women', label: 'Frauen-Bundesliga', region: 'eu' },
    { key: 'soccer_germany_dfb_pokal', label: 'DFB-Pokal', region: 'eu' },
    { key: 'soccer_spain_la_liga', label: 'La Liga (Spain)', region: 'uk,eu' },
    { key: 'soccer_spain_segunda_division', label: 'La Liga 2', region: 'eu' },
    { key: 'soccer_spain_copa_del_rey', label: 'Copa del Rey', region: 'eu' },
    { key: 'soccer_italy_serie_a', label: 'Serie A (Italy)', region: 'uk,eu' },
    { key: 'soccer_italy_serie_b', label: 'Serie B (Italy)', region: 'eu' },
    { key: 'soccer_italy_coppa_italia', label: 'Coppa Italia', region: 'eu' },
    { key: 'soccer_france_ligue_one', label: 'Ligue 1 (France)', region: 'uk,eu' },
    { key: 'soccer_france_ligue_two', label: 'Ligue 2 (France)', region: 'eu' },
    { key: 'soccer_france_coupe_de_france', label: 'Coupe de France', region: 'eu' },
  ]},
  { group: '⚽ Europe - Other Leagues', sports: [
    { key: 'soccer_portugal_primeira_liga', label: 'Primeira Liga (Portugal)', region: 'eu' },
    { key: 'soccer_netherlands_eredivisie', label: 'Eredivisie (Netherlands)', region: 'eu' },
    { key: 'soccer_belgium_first_div', label: 'Belgium First Div', region: 'eu' },
    { key: 'soccer_turkey_super_league', label: 'Super League (Turkey)', region: 'eu' },
    { key: 'soccer_spl', label: 'Scottish Premiership', region: 'uk,eu' },
    { key: 'soccer_switzerland_superleague', label: 'Swiss Superleague', region: 'eu' },
    { key: 'soccer_austria_bundesliga', label: 'Austrian Bundesliga', region: 'eu' },
    { key: 'soccer_greece_super_league', label: 'Super League (Greece)', region: 'eu' },
    { key: 'soccer_russia_premier_league', label: 'Premier League (Russia)', region: 'eu' },
    { key: 'soccer_norway_eliteserien', label: 'Eliteserien (Norway)', region: 'eu' },
    { key: 'soccer_sweden_allsvenskan', label: 'Allsvenskan (Sweden)', region: 'eu' },
    { key: 'soccer_denmark_superliga', label: 'Superliga (Denmark)', region: 'eu' },
    { key: 'soccer_poland_ekstraklasa', label: 'Ekstraklasa (Poland)', region: 'eu' },
  ]},
  { group: '⚽ Europe - Cups', sports: [
    { key: 'soccer_uefa_champs_league', label: 'UEFA Champions League', region: 'uk,eu' },
    { key: 'soccer_uefa_champs_league_women', label: "UEFA Women's CL", region: 'eu' },
    { key: 'soccer_uefa_europa_league', label: 'UEFA Europa League', region: 'uk,eu' },
    { key: 'soccer_uefa_europa_conference_league', label: 'UEFA Conference League', region: 'eu' },
    { key: 'soccer_uefa_nations_league', label: 'UEFA Nations League', region: 'eu' },
    { key: 'soccer_uefa_euro_qualification', label: 'Euro Qualification', region: 'eu' },
    { key: 'soccer_fifa_world_cup_qualifiers_europe', label: 'WC Qualifiers Europe', region: 'eu' },
  ]},
  { group: '⚽ Americas', sports: [
    { key: 'soccer_conmebol_copa_america', label: 'Copa América', region: 'eu' },
    { key: 'soccer_conmebol_copa_libertadores', label: 'Copa Libertadores', region: 'eu' },
    { key: 'soccer_conmebol_copa_sudamericana', label: 'Copa Sudamericana', region: 'eu' },
    { key: 'soccer_fifa_world_cup_qualifiers_south_america', label: 'WC Qualifiers S. America', region: 'eu' },
    { key: 'soccer_brazil_campeonato', label: 'Brazil Série A', region: 'eu' },
    { key: 'soccer_argentina_primera_division', label: 'Argentina Primera', region: 'eu' },
    { key: 'soccer_mexico_ligamx', label: 'Liga MX (Mexico)', region: 'eu' },
    { key: 'soccer_usa_mls', label: 'MLS (USA)', region: 'eu,us' },
    { key: 'soccer_concacaf_gold_cup', label: 'CONCACAF Gold Cup', region: 'eu' },
    { key: 'soccer_concacaf_leagues_cup', label: 'CONCACAF Leagues Cup', region: 'eu' },
    { key: 'soccer_chile_campeonato', label: 'Primera División Chile', region: 'eu' },
  ]},
  { group: '⚽ Rest of World', sports: [
    { key: 'soccer_saudi_arabia_pro_league', label: 'Saudi Pro League', region: 'eu' },
    { key: 'soccer_australia_aleague', label: 'A-League (Australia)', region: 'eu' },
    { key: 'soccer_japan_j_league', label: 'J League (Japan)', region: 'eu' },
    { key: 'soccer_korea_kleague1', label: 'K League 1 (Korea)', region: 'eu' },
    { key: 'soccer_china_superleague', label: 'Super League (China)', region: 'eu' },
  ]},
  { group: '🏀 Basketball', sports: [
    { key: 'basketball_nba', label: 'NBA', region: 'eu,us' },
    { key: 'basketball_wnba', label: 'WNBA (Women)', region: 'eu,us' },
    { key: 'basketball_ncaab', label: 'NCAA (Men)', region: 'eu,us' },
    { key: 'basketball_wncaab', label: 'NCAA (Women)', region: 'eu,us' },
    { key: 'basketball_euroleague', label: 'Euroleague', region: 'eu' },
    { key: 'basketball_nbl', label: 'NBL (Australia)', region: 'eu' },
  ]},
  { group: '🎾 Tennis ATP (Men)', sports: [
    { key: 'tennis_atp_aus_open_singles', label: 'Australian Open', region: 'eu,uk' },
    { key: 'tennis_atp_french_open', label: 'French Open', region: 'eu,uk' },
    { key: 'tennis_atp_wimbledon', label: 'Wimbledon', region: 'eu,uk' },
    { key: 'tennis_atp_us_open', label: 'US Open', region: 'eu,uk' },
    { key: 'tennis_atp_indian_wells', label: 'Indian Wells', region: 'eu' },
    { key: 'tennis_atp_miami_open', label: 'Miami Open', region: 'eu' },
    { key: 'tennis_atp_madrid_open', label: 'Madrid Open', region: 'eu' },
    { key: 'tennis_atp_italian_open', label: 'Italian Open', region: 'eu' },
    { key: 'tennis_atp_canadian_open', label: 'Canadian Open', region: 'eu' },
    { key: 'tennis_atp_cincinnati_open', label: 'Cincinnati Open', region: 'eu' },
    { key: 'tennis_atp_shanghai_masters', label: 'Shanghai Masters', region: 'eu' },
    { key: 'tennis_atp_paris_masters', label: 'Paris Masters', region: 'eu' },
    { key: 'tennis_atp_monte_carlo_masters', label: 'Monte Carlo Masters', region: 'eu' },
    { key: 'tennis_atp_dubai', label: 'Dubai Championships', region: 'eu' },
  ]},
  { group: '🎾 Tennis WTA (Women)', sports: [
    { key: 'tennis_wta_aus_open_singles', label: 'Australian Open', region: 'eu,uk' },
    { key: 'tennis_wta_french_open', label: 'French Open', region: 'eu,uk' },
    { key: 'tennis_wta_wimbledon', label: 'Wimbledon', region: 'eu,uk' },
    { key: 'tennis_wta_us_open', label: 'US Open', region: 'eu,uk' },
    { key: 'tennis_wta_indian_wells', label: 'Indian Wells', region: 'eu' },
    { key: 'tennis_wta_miami_open', label: 'Miami Open', region: 'eu' },
    { key: 'tennis_wta_madrid_open', label: 'Madrid Open', region: 'eu' },
    { key: 'tennis_wta_italian_open', label: 'Italian Open', region: 'eu' },
    { key: 'tennis_wta_canadian_open', label: 'Canadian Open', region: 'eu' },
    { key: 'tennis_wta_cincinnati_open', label: 'Cincinnati Open', region: 'eu' },
    { key: 'tennis_wta_stuttgart_open', label: 'Stuttgart Open', region: 'eu' },
    { key: 'tennis_wta_wuhan_open', label: 'Wuhan Open', region: 'eu' },
    { key: 'tennis_wta_charleston_open', label: 'Charleston Open', region: 'eu' },
    { key: 'tennis_wta_dubai', label: 'Dubai Championships', region: 'eu' },
  ]},
  { group: '🏈 American Football', sports: [
    { key: 'americanfootball_nfl', label: 'NFL', region: 'eu,us' },
    { key: 'americanfootball_nfl_preseason', label: 'NFL Preseason', region: 'eu,us' },
    { key: 'americanfootball_ncaaf', label: 'NCAAF', region: 'eu,us' },
    { key: 'americanfootball_cfl', label: 'CFL (Canada)', region: 'eu' },
    { key: 'americanfootball_ufl', label: 'UFL', region: 'eu,us' },
  ]},
  { group: '🏒 Ice Hockey', sports: [
    { key: 'icehockey_nhl', label: 'NHL', region: 'eu,us' },
    { key: 'icehockey_nhl_preseason', label: 'NHL Preseason', region: 'eu,us' },
    { key: 'icehockey_ahl', label: 'AHL', region: 'eu' },
    { key: 'icehockey_sweden_hockey_league', label: 'SHL (Sweden)', region: 'eu' },
    { key: 'icehockey_liiga', label: 'Liiga (Finland)', region: 'eu' },
  ]},
  { group: '⚾ Baseball', sports: [
    { key: 'baseball_mlb', label: 'MLB', region: 'eu,us' },
    { key: 'baseball_mlb_preseason', label: 'MLB Preseason', region: 'eu,us' },
    { key: 'baseball_npb', label: 'NPB (Japan)', region: 'eu' },
    { key: 'baseball_kbo', label: 'KBO (Korea)', region: 'eu' },
  ]},
  { group: '🏏 Cricket', sports: [
    { key: 'cricket_icc_world_cup', label: 'ICC World Cup (Men)', region: 'eu' },
    { key: 'cricket_icc_world_cup_womens', label: 'ICC World Cup (Women)', region: 'eu' },
    { key: 'cricket_t20_world_cup', label: 'T20 World Cup', region: 'eu' },
    { key: 'cricket_icc_trophy', label: 'ICC Champions Trophy', region: 'eu' },
    { key: 'cricket_ipl', label: 'IPL (India)', region: 'eu' },
    { key: 'cricket_international_t20', label: 'International T20', region: 'eu' },
    { key: 'cricket_odi', label: 'ODI Cricket', region: 'eu' },
    { key: 'cricket_test_match', label: 'Test Matches', region: 'eu' },
    { key: 'cricket_psl', label: 'PSL (Pakistan)', region: 'eu' },
    { key: 'cricket_big_bash', label: 'Big Bash (Australia)', region: 'eu' },
    { key: 'cricket_asia_cup', label: 'Asia Cup', region: 'eu' },
    { key: 'cricket_caribbean_premier_league', label: 'Caribbean Premier League', region: 'eu' },
    { key: 'cricket_the_hundred', label: 'The Hundred (England)', region: 'eu' },
  ]},
  { group: '🥊 Combat Sports', sports: [
    { key: 'mma_mixed_martial_arts', label: 'MMA / UFC', region: 'eu,uk' },
    { key: 'boxing_boxing', label: 'Boxing', region: 'eu,uk' },
  ]},
  { group: '🏉 Rugby', sports: [
    { key: 'rugbyleague_nrl', label: 'NRL (Rugby League)', region: 'eu' },
    { key: 'rugbyunion_six_nations', label: 'Six Nations (Rugby Union)', region: 'eu,uk' },
  ]},
  { group: '🏌️ Golf', sports: [
    { key: 'golf_masters_tournament_winner', label: 'Masters Tournament', region: 'eu,uk' },
    { key: 'golf_pga_championship_winner', label: 'PGA Championship', region: 'eu,uk' },
    { key: 'golf_the_open_championship_winner', label: 'The Open', region: 'eu,uk' },
    { key: 'golf_us_open_winner', label: 'US Open Golf', region: 'eu,uk' },
  ]},
  { group: '🏐 Other Sports', sports: [
    { key: 'aussierules_afl', label: 'AFL (Aussie Rules)', region: 'eu' },
    { key: 'handball_germany_bundesliga', label: 'Handball Bundesliga', region: 'eu' },
  ]},
];

const ALL_SPORTS = SPORT_GROUPS.flatMap(g => g.sports);

// ─── DRAW VALUE — historical draw tendency by team, Top-5 European leagues ────
// Source: 2025-26 final league tables (38-game season, verified via league
// standings). Used as CONTEXT alongside live sharp-book pricing in findEVBets —
// it does not by itself decide value. A team drawing a lot historically only
// matters if the market is currently pricing the draw below that tendency.
//
// ⚠️ Only soccer_epl is populated with verified 2025-26 W-D-L data right now.
// La Liga / Bundesliga / Serie A / Ligue 1 are stubbed out below — add their
// final W-D-L rows the same way (see EPL block) before relying on draw
// context badges for those leagues. Until then getDrawStat() returns null
// for them and the UI simply omits the badge, so nothing is fabricated.
const DRAW_STATS = {
  soccer_epl: {
    season: '2025-26',
    teams: {
      'arsenal':               { w: 26, d: 7,  l: 5  },
      'manchester city':       { w: 23, d: 9,  l: 6  },
      'manchester united':     { w: 20, d: 11, l: 7  },
      'aston villa':           { w: 19, d: 8,  l: 11 },
      'liverpool':             { w: 17, d: 9,  l: 12 },
      'bournemouth':           { w: 13, d: 18, l: 7  }, // PL record for draws in a season
      'sunderland':            { w: 14, d: 12, l: 12 },
      'brighton and hove albion': { w: 14, d: 11, l: 13 },
      'brentford':             { w: 14, d: 11, l: 13 },
      'chelsea':               { w: 14, d: 10, l: 14 },
      'fulham':                { w: 15, d: 7,  l: 16 },
      'newcastle united':      { w: 14, d: 7,  l: 17 },
      'everton':               { w: 13, d: 10, l: 15 },
      'leeds united':          { w: 11, d: 14, l: 13 },
      'crystal palace':        { w: 11, d: 12, l: 15 },
      'nottingham forest':     { w: 11, d: 11, l: 16 },
      'tottenham hotspur':     { w: 10, d: 11, l: 17 },
      'west ham united':       { w: 10, d: 9,  l: 19 },
      'burnley':               { w: 4,  d: 10, l: 24 },
      'wolverhampton wanderers': { w: 3, d: 11, l: 24 },
    },
  },
  soccer_spain_la_liga: {
    season: '2025-26',
    teams: {
      'barcelona':              { w: 31, d: 1,  l: 6  },
      'real madrid':             { w: 27, d: 5,  l: 6  },
      'villarreal':              { w: 22, d: 6,  l: 10 },
      'atletico madrid':         { w: 21, d: 6,  l: 11 },
      'real betis':              { w: 15, d: 15, l: 8  },
      'celta vigo':              { w: 14, d: 12, l: 12 },
      'getafe':                  { w: 15, d: 6,  l: 17 },
      'rayo vallecano':          { w: 12, d: 14, l: 12 },
      'valencia':                { w: 13, d: 10, l: 15 },
      'real sociedad':           { w: 11, d: 13, l: 14 },
      'espanyol':                { w: 12, d: 10, l: 16 },
      'athletic club':           { w: 13, d: 6,  l: 19 },
      'sevilla':                 { w: 12, d: 7,  l: 19 },
      'alaves':                  { w: 11, d: 10, l: 17 },
      'elche':                   { w: 10, d: 13, l: 15 },
      'levante':                 { w: 11, d: 9,  l: 18 },
      'osasuna':                 { w: 11, d: 9,  l: 18 },
      'mallorca':                { w: 11, d: 9,  l: 18 },
      'girona':                  { w: 9,  d: 14, l: 15 },
      'real oviedo':             { w: 6,  d: 11, l: 21 },
    },
  },
  soccer_germany_bundesliga: {
    season: '2025-26',
    teams: {
      'bayern munich':           { w: 28, d: 5,  l: 1  },
      'borussia dortmund':       { w: 22, d: 7,  l: 5  },
      'rb leipzig':              { w: 20, d: 5,  l: 9  },
      'vfb stuttgart':           { w: 18, d: 8,  l: 8  },
      'tsg hoffenheim':          { w: 18, d: 7,  l: 9  },
      'bayer leverkusen':        { w: 17, d: 8,  l: 9  },
      'sc freiburg':             { w: 13, d: 8,  l: 13 },
      'eintracht frankfurt':     { w: 11, d: 11, l: 12 },
      'fc augsburg':             { w: 12, d: 7,  l: 15 },
      'mainz 05':                { w: 10, d: 10, l: 14 },
      'union berlin':            { w: 10, d: 9,  l: 15 },
      'borussia monchengladbach': { w: 9, d: 11, l: 14 },
      'hamburger sv':            { w: 9,  d: 11, l: 14 },
      'fc koln':                 { w: 7,  d: 11, l: 16 },
      'werder bremen':           { w: 8,  d: 8,  l: 18 },
      'vfl wolfsburg':           { w: 7,  d: 8,  l: 19 },
      'fc heidenheim':           { w: 6,  d: 8,  l: 20 },
      'st pauli':                { w: 6,  d: 8,  l: 20 },
    },
  },
  soccer_italy_serie_a: {
    season: '2025-26',
    teams: {
      'inter milan':             { w: 27, d: 6,  l: 5  },
      'napoli':                  { w: 23, d: 7,  l: 8  },
      'roma':                    { w: 23, d: 4,  l: 11 },
      'como':                    { w: 20, d: 11, l: 7  },
      'ac milan':                { w: 20, d: 10, l: 8  },
      'juventus':                { w: 19, d: 12, l: 7  },
      'atalanta':                { w: 15, d: 14, l: 9  },
      'bologna':                 { w: 16, d: 8,  l: 14 },
      'lazio':                   { w: 14, d: 12, l: 12 },
      'udinese':                 { w: 14, d: 8,  l: 16 },
      'sassuolo':                { w: 14, d: 7,  l: 17 },
      'torino':                  { w: 12, d: 9,  l: 17 },
      'parma':                   { w: 11, d: 12, l: 15 },
      'cagliari':                { w: 11, d: 10, l: 17 },
      'fiorentina':              { w: 9,  d: 15, l: 14 },
      'genoa':                   { w: 10, d: 11, l: 17 },
      'lecce':                   { w: 10, d: 8,  l: 20 },
      'cremonese':               { w: 8,  d: 10, l: 20 },
      'hellas verona':           { w: 3,  d: 12, l: 23 },
      'pisa':                    { w: 2,  d: 12, l: 24 },
    },
  },
  // Ligue 1: only near-final (matchday ~32-33 of 34) data was verifiable at
  // research time, not the confirmed final table — left empty rather than
  // risk a wrong "final" draw rate. Populate once a confirmed final 2025-26
  // Ligue 1 table (34 games, all 18 teams) is available.
  soccer_france_ligue_one:     { season: '2025-26', teams: {} }, // TODO: populate
};

// Normalise a team name for DRAW_STATS lookup — lowercase, strip punctuation,
// collapse common naming variants ("Man City" vs "Manchester City" etc.).
function normaliseTeamName(name) {
  if (!name) return '';
  let n = name.trim().toLowerCase()
    .replace(/^afc\s+|^fc\s+|^1\.\s*fc\s+|^ss\s+|^ssc\s+|^as\s+/, '')
    .replace(/[öø]/g, 'o').replace(/[üù]/g, 'u').replace(/[ä]/g, 'a').replace(/[éè]/g, 'e')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
  // Exact/whole-name disambiguation first — these must NOT chain into each
  // other (e.g. "inter" -> "inter milan" must not then get re-matched by a
  // generic "milan" rule and become "inter ac milan").
  if (/^internazionale$|^inter$/.test(n)) return 'inter milan';
  if (/^milan$|^ac milan$/.test(n)) return 'ac milan';
  if (/^roma$|^as roma$/.test(n)) return 'roma';
  n = n
    .replace(/\bman(chester)?\s*utd\b/, 'manchester united')
    .replace(/\bman(chester)?\s*city\b/, 'manchester city')
    .replace(/\bspurs\b/, 'tottenham hotspur')
    .replace(/\bwolves\b/, 'wolverhampton wanderers')
    .replace(/\bbrighton\b(?!.*albion)/, 'brighton and hove albion')
    .replace(/\bnottm forest\b|\bforest\b/, 'nottingham forest')
    .replace(/\bathletic bilbao\b/, 'athletic club')
    .replace(/\bfsv mainz( 05)?\b|\bmainz\b/, 'mainz 05')
    .replace(/\b1\s*fc\s*koln\b|\bcologne\b/, 'fc koln')
    .replace(/\bunion berlin\b|\b1 fc union berlin\b/, 'union berlin')
    .replace(/\bmonchengladbach\b|\bgladbach\b|\bborussia mgladbach\b/, 'borussia monchengladbach')
    .replace(/\bheidenheim\b/, 'fc heidenheim')
    .replace(/\bst pauli\b|\bfc st pauli\b/, 'st pauli');
  return n.trim();
}

// getDrawStat — returns { drawRate, draws, played } for a team in a given
// sport/league, or null if we don't have verified data for that league/team
// yet. drawRate is 0-1.
function getDrawStat(sportKey, teamName) {
  const league = DRAW_STATS[sportKey];
  if (!league) return null;
  const key = normaliseTeamName(teamName);
  const row = league.teams[key];
  if (!row) return null;
  const played = row.w + row.d + row.l;
  if (!played) return null;
  return { draws: row.d, played, drawRate: row.d / played, season: league.season };
}

// getDrawContext — combined home+away signal for a fixture, used to badge
// +EV Draw bets with "both sides are historically draw-prone" context.
// Purely informational — does not change the EV math, which already comes
// from the sharp-book de-vig in findEVBets.
function getDrawContext(sportKey, homeTeam, awayTeam) {
  const home = getDrawStat(sportKey, homeTeam);
  const away = getDrawStat(sportKey, awayTeam);
  if (!home && !away) return null;
  const rates = [home, away].filter(Boolean).map(s => s.drawRate);
  const avgRate = rates.reduce((s, r) => s + r, 0) / rates.length;
  return { home, away, avgRate, season: (home || away).season };
}

// ─── FORM DIVERGENCE — "good team, bad recent stretch" mispricing signal ─────
// The pattern this catches: a genuinely strong team (high PPG over a longer
// baseline window) goes through a rough patch — a manager change, injuries,
// a tough run of fixtures — and the market (square books especially) keeps
// pricing them off that recent form rather than their underlying quality.
// If the baseline PPG is meaningfully higher than the recent-form PPG, that
// team's odds may still be inflated relative to their true strength — a
// potential rebound spot.
//
// This needs chronological match-by-match results per team (points earned
// per game, oldest first), which the current odds feed does NOT provide —
// /api/odds only returns bookmaker prices, not results history. TEAM_FORM
// below is therefore an empty, ready-to-fill structure rather than seeded
// data: populate it once a results-history source is wired in (e.g. a new
// odds.js endpoint backed by a scores API), one sport at a time.
//
// Expected shape once populated:
//   TEAM_FORM.soccer_epl['arsenal'] = [3, 3, 1, 0, 3, 1, ...]  // points per
//   game, OLDEST FIRST, one entry per match played this season.
const TEAM_FORM = {
  soccer_epl: {},
  soccer_spain_la_liga: {},
  soccer_germany_bundesliga: {},
  soccer_italy_serie_a: {},
  soccer_france_ligue_one: {},
};

const FORM_RECENT_WINDOW = 10;   // "recent form" sample size
const FORM_BASELINE_WINDOW = 30; // "true quality" baseline sample size
const FORM_DIVERGENCE_THRESHOLD = 0.5; // min PPG gap worth flagging

function avgPPG(games) {
  if (!games || games.length === 0) return null;
  return games.reduce((s, p) => s + p, 0) / games.length;
}

// getFormDivergence — returns null if we don't have enough games logged for
// this team yet (needs at least FORM_RECENT_WINDOW games; baseline uses
// whatever's available up to FORM_BASELINE_WINDOW, so it degrades gracefully
// early in a season rather than demanding a full 30 games before saying
// anything).
function getFormDivergence(sportKey, teamName) {
  const league = TEAM_FORM[sportKey];
  if (!league) return null;
  const key = normaliseTeamName(teamName);
  const games = league[key];
  if (!games || games.length < FORM_RECENT_WINDOW) return null;

  const recent = games.slice(-FORM_RECENT_WINDOW);
  const baseline = games.slice(-FORM_BASELINE_WINDOW);
  const recentPPG = avgPPG(recent);
  const baselinePPG = avgPPG(baseline);
  // Positive divergence = baseline (true quality) running hotter than recent
  // form — the "market may still be sleeping on a slump" case described above.
  const divergence = parseFloat((baselinePPG - recentPPG).toFixed(2));

  return {
    recentPPG: parseFloat(recentPPG.toFixed(2)),
    baselinePPG: parseFloat(baselinePPG.toFixed(2)),
    divergence,
    gamesLogged: games.length,
    isRebound: divergence >= FORM_DIVERGENCE_THRESHOLD, // baseline > recent form
    isSlide: divergence <= -FORM_DIVERGENCE_THRESHOLD,  // recent form > baseline (heating up)
  };
}

// getFormContextForOutcome — only meaningful for a bet on a specific team
// (not the Draw), so this is looked up per-outcome in findEVBets using
// whichever side (home/away) the outcome actually refers to.
function getFormContextForOutcome(sportKey, teamName) {
  return getFormDivergence(sportKey, teamName);
}

const MOCK = [
  { id: 'm1', sport: 'soccer_epl', match: 'Arsenal vs Chelsea', commenceTime: new Date(Date.now() + 3 * 3600000).toISOString(), margin: 3.7, outcomes: [{ label: 'Arsenal', book: 'betway', bookName: 'Betway', odds: 2.50 }, { label: 'Draw', book: '1xbet', bookName: '1xBet', odds: 4.10 }, { label: 'Chelsea', book: 'bet365', bookName: 'Bet365', odds: 3.40 }] },
  { id: 'm2', sport: 'soccer_uefa_champs_league', match: 'Real Madrid vs Man City', commenceTime: new Date(Date.now() + 26 * 3600000).toISOString(), margin: 2.1, outcomes: [{ label: 'Real Madrid', book: 'pinnacle', bookName: 'Pinnacle', odds: 2.20 }, { label: 'Draw', book: 'marathonbet', bookName: 'MarathonBet', odds: 3.80 }, { label: 'Man City', book: '1xbet', bookName: '1xBet', odds: 3.40 }] },
  { id: 'm3', sport: 'basketball_nba', match: 'Lakers vs Celtics', commenceTime: new Date(Date.now() + 5 * 3600000).toISOString(), margin: 1.8, outcomes: [{ label: 'Lakers', book: 'betway', bookName: 'Betway', odds: 2.10 }, { label: 'Celtics', book: '1xbet', bookName: '1xBet', odds: 1.98 }] },
  { id: 'm4', sport: 'mma_mixed_martial_arts', match: 'Pereira vs Ankalaev', commenceTime: new Date(Date.now() + 48 * 3600000).toISOString(), margin: 2.4, outcomes: [{ label: 'Pereira', book: 'bet365', bookName: 'Bet365', odds: 1.72 }, { label: 'Ankalaev', book: 'pinnacle', bookName: 'Pinnacle', odds: 2.30 }] },
  { id: 'm5', sport: 'cricket_ipl', match: 'Mumbai Indians vs CSK', commenceTime: new Date(Date.now() + 12 * 3600000).toISOString(), margin: 1.5, outcomes: [{ label: 'Mumbai Indians', book: '1xbet', bookName: '1xBet', odds: 2.05 }, { label: 'CSK', book: 'betway', bookName: 'Betway', odds: 1.90 }] },
];

function findArbs(events, mode = 'global', userRegion = null) {
  const arbs = [];
  for (const ev of events) {
    if (!ev.bookmakers || ev.bookmakers.length < 2) continue;
    const best = {};
    for (const bm of ev.bookmakers) {
      // West Africa section: only consider accessible books when picking the best price
      // per outcome, so a "WA arb" is actually placeable from WA — not just a global arb
      // that happened to land on an accessible book for every leg by coincidence.
      if (mode === 'wa' && !isBookAccessible(bm.key, userRegion)) continue;
      for (const mkt of (bm.markets || [])) {
        if (!['h2h', 'spreads', 'totals', 'outrights'].includes(mkt.key)) continue;
        for (const o of mkt.outcomes) {
          if (!best[o.name] || o.price > best[o.name].price)
            best[o.name] = { price: o.price, book: bm.key, bookName: bm.title };
        }
      }
    }
    const outs = Object.entries(best);
    if (outs.length < 2) continue;
    const imp = outs.reduce((s, [, o]) => s + 1 / o.price, 0);
    if (imp < 1) arbs.push({ id: ev.id, sport: ev.sport_key, match: ev.home_team + ' vs ' + ev.away_team, commenceTime: ev.commence_time, margin: parseFloat((((1 - imp) / imp) * 100).toFixed(2)), outcomes: outs.map(([name, o]) => ({ label: name, book: o.book, bookName: o.bookName, odds: o.price })) });
  }
  return arbs.sort((a, b) => b.margin - a.margin);
}

// ── Sharp reference books by region ─────────────────────────────────────────
// Global (RoW): Pinnacle/Betfair are the gold standard sharp references.
// West Africa:  Use Pinnacle/Betfair as reference (same as global) but filter
//               OUTPUT to WA-accessible books only. 1xBet/Singbet stay as
//               supplementary references when Pinnacle is absent from the feed.
const SHARP_BOOKS_GLOBAL    = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet'];
const SHARP_BOOKS_WESTAFRICA = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet', '1xbet', 'onexbet'];

// Legacy alias — kept so existing steam/middles code that references it still works
const SHARP_REFERENCE_BOOKS = SHARP_BOOKS_GLOBAL;

// WA book keys — used to split arbs into RoW vs West Africa sections
const WA_BOOK_KEYS = Object.entries(BOOKS).filter(([,b]) => b.wa).map(([k]) => k);

/**
 * findEVBets — dual-mode EV finder.
 * 
 * mode = 'global'    → uses Pinnacle/Betfair as reference, shows all books
 * mode = 'wa'        → uses 1xBet/Singbet as reference, only shows WA-accessible books
 * mode = 'all'       → runs both and merges (default, deduped by id)
 */
// Normalise outcome names so "Draw", "draw", "X", "The Draw" all match.
// Home/Away names vary widely by book so we normalise those too.
function normaliseOutcome(name, homeTeam, awayTeam) {
  if (!name) return '';
  const n = name.trim().toLowerCase();
  if (n === 'draw' || n === 'x' || n === 'the draw' || n === 'tie') return '__draw__';
  if (homeTeam && (n === homeTeam.toLowerCase() || n === '1' || n === 'home')) return '__home__';
  if (awayTeam && (n === awayTeam.toLowerCase() || n === '2' || n === 'away')) return '__away__';
  return n; // fallback — keeps original normalised
}

function findEVBets(events, minEV = 2, mode = 'all', userRegion = null) {
  const runMode = (sharpBooks, filterWA) => {
    const evBets = [];
    for (const ev of events) {
      if (!ev.bookmakers || ev.bookmakers.length < 2) continue;

      // Sharp book consensus: average the de-vigged true probability across EVERY
      // available sharp book for this event, not just whichever one happens to be
      // first in the array. More sharp books agreeing on a price tightens the true-
      // probability estimate — it's less exposed to any single book's own margin
      // quirks or a temporarily stale/mispriced line.
      const sharpBms = ev.bookmakers.filter(b => sharpBooks.includes(b.key));
      if (sharpBms.length === 0) continue;

      const probsByOutcome = {}; // outcome name -> [de-vigged prob from each sharp book]
      const usedSharpKeys = [];
      for (const sharpBm of sharpBms) {
        const sharpMkt = (sharpBm.markets || []).find(m => m.key === 'h2h');
        if (!sharpMkt) continue;
        const sharpOuts = sharpMkt.outcomes;
        const rawImplied = sharpOuts.reduce((s, o) => s + 1 / o.price, 0);
        if (!rawImplied) continue;
        usedSharpKeys.push(sharpBm.key);
        sharpOuts.forEach(o => {
          const key = normaliseOutcome(o.name, ev.home_team, ev.away_team);
          const p = (1 / o.price) / rawImplied;
          (probsByOutcome[key] = probsByOutcome[key] || []).push(p);
        });
      }
      if (usedSharpKeys.length === 0) continue;

      const trueProbs = {};
      Object.keys(probsByOutcome).forEach(name => {
        const arr = probsByOutcome[name];
        trueProbs[name] = arr.reduce((s, p) => s + p, 0) / arr.length;
      });

      for (const bm of ev.bookmakers) {
        if (sharpBooks.includes(bm.key)) continue;
        if (filterWA && !isBookAccessible(bm.key, userRegion)) continue;
        const mkt = (bm.markets || []).find(m => m.key === 'h2h');
        if (!mkt) continue;
        for (const o of mkt.outcomes) {
          const normKey = normaliseOutcome(o.name, ev.home_team, ev.away_team);
          const prob = trueProbs[normKey];
          if (!prob) continue;
          const ev_pct = parseFloat(((o.price * prob - 1) * 100).toFixed(2));
          if (ev_pct >= minEV) {
            const isDraw = normKey === '__draw__';
            // Which team (if any) this outcome actually refers to, so form
            // context is only attached to the side it's relevant for.
            const outcomeTeam = normKey === '__home__' ? ev.home_team
                               : normKey === '__away__' ? ev.away_team
                               : (!isDraw ? o.name : null); // fallback for books using team names directly
            evBets.push({
              id: ev.id + '_' + bm.key + '_' + o.name,
              eventId: ev.id,
              sport: ev.sport_key,
              match: ev.home_team + ' vs ' + ev.away_team,
              commenceTime: ev.commence_time,
              outcome: o.name,
              book: bm.key,
              bookName: bm.title,
              odds: o.price,
              trueProb: parseFloat((prob * 100).toFixed(1)),
              fairOdds: parseFloat((1 / prob).toFixed(2)),
              ev_pct,
              sharpRef: usedSharpKeys.join('+'),
              sharpBookCount: usedSharpKeys.length,
              // Tag WA if the book is accessible in West Africa
              _wa: !!isBookAccessible(bm.key, userRegion),
              // Draw-value context: only ever attached to Draw outcomes, and
              // only when we have verified historical draw stats for the
              // league (see DRAW_STATS). null for everything else — the UI
              // treats null as "no badge", never as "0% draw rate".
              isDraw,
              drawContext: isDraw ? getDrawContext(ev.sport_key, ev.home_team, ev.away_team) : null,
              // Form-divergence context: only attached to team-outcome bets
              // (not Draw), and only once TEAM_FORM has real match history
              // logged for that team — null otherwise, never a fabricated 0.
              formContext: (!isDraw && outcomeTeam) ? getFormContextForOutcome(ev.sport_key, outcomeTeam) : null,
            });
          }
        }
      }
    }
    return evBets;
  };

  if (mode === 'global') return runMode(SHARP_BOOKS_GLOBAL, false).sort((a, b) => b.ev_pct - a.ev_pct);
  if (mode === 'wa')     return runMode(SHARP_BOOKS_WESTAFRICA, true).sort((a, b) => b.ev_pct - a.ev_pct);

  // mode === 'all': run both, dedupe by id (global result preferred)
  const global = runMode(SHARP_BOOKS_GLOBAL, false);
  const wa     = runMode(SHARP_BOOKS_WESTAFRICA, true);
  const seen   = new Set(global.map(b => b.id));
  const merged = [...global, ...wa.filter(b => !seen.has(b.id))];
  return merged.sort((a, b) => b.ev_pct - a.ev_pct);
}

// ── MIDDLE BETTING ─────────────────────────────────────────────────────────
// A middle exists when two books have different spreads/totals lines on the same
// event such that there is a range of outcomes where BOTH bets win.
// e.g. Book A: Team -3.5  Book B: Team +4.5 → middle window = 1 point (score of 4)
function findMiddles(events, mode = 'global', userRegion = null) {
  const middles = [];
  // West Africa section: a middle is only placeable if BOTH legs are on WA-accessible books.
  const legsOk = (bookA, bookB) => mode !== 'wa' || (BOOKS[bookA]?.accessible && BOOKS[bookB]?.accessible);
  for (const ev of events) {
    if (!ev.bookmakers || ev.bookmakers.length < 2) continue;

    // ── Spreads middle ──
    const spreadsByBook = ev.bookmakers
      .map(bm => ({ book: bm.key, bookName: bm.title, outcomes: (bm.markets || []).find(m => m.key === 'spreads')?.outcomes || [] }))
      .filter(b => b.outcomes.length > 0);

    for (let i = 0; i < spreadsByBook.length; i++) {
      for (let j = i + 1; j < spreadsByBook.length; j++) {
        const a = spreadsByBook[i], b = spreadsByBook[j];
        if (!legsOk(a.book, b.book)) continue;
        for (const aOut of a.outcomes) {
          const bOut = b.outcomes.find(o => o.name === aOut.name);
          if (!bOut || aOut.point == null || bOut.point == null) continue;
          // Middle: book A is sharper (closer to 0), book B is looser — there's a gap
          if (aOut.point < 0 && bOut.point > 0) {
            const window = bOut.point - Math.abs(aOut.point);
            if (window > 0) {
              const implied = 1 / aOut.price + 1 / bOut.price;
              middles.push({ id: ev.id + '_sprd_' + aOut.name, sport: ev.sport_key, match: ev.home_team + ' vs ' + ev.away_team, commenceTime: ev.commence_time, type: 'Spread', team: aOut.name, legA: { book: a.book, bookName: a.bookName, line: aOut.point, odds: aOut.price, side: aOut.name + ' ' + aOut.point }, legB: { book: b.book, bookName: b.bookName, line: bOut.point, odds: bOut.price, side: aOut.name + ' ' + bOut.point }, window: parseFloat(window.toFixed(1)), implied: parseFloat(implied.toFixed(4)), isArb: implied < 1 });
            }
          }
        }
      }
    }

    // ── Totals middle ──
    const totalsByBook = ev.bookmakers
      .map(bm => ({ book: bm.key, bookName: bm.title, outcomes: (bm.markets || []).find(m => m.key === 'totals')?.outcomes || [] }))
      .filter(b => b.outcomes.length > 0);

    for (let i = 0; i < totalsByBook.length; i++) {
      for (let j = i + 1; j < totalsByBook.length; j++) {
        const a = totalsByBook[i], b = totalsByBook[j];
        if (!legsOk(a.book, b.book)) continue;
        const aOver = a.outcomes.find(o => o.name === 'Over');
        const bUnder = b.outcomes.find(o => o.name === 'Under');
        if (!aOver || !bUnder || aOver.point == null || bUnder.point == null) continue;
        if (aOver.point < bUnder.point) {
          const window = parseFloat((bUnder.point - aOver.point).toFixed(1));
          const implied = 1 / aOver.price + 1 / bUnder.price;
          middles.push({ id: ev.id + '_tot_' + i + '_' + j, sport: ev.sport_key, match: ev.home_team + ' vs ' + ev.away_team, commenceTime: ev.commence_time, type: 'Total', team: 'Goals total', legA: { book: a.book, bookName: a.bookName, line: aOver.point, odds: aOver.price, side: 'Over ' + aOver.point }, legB: { book: b.book, bookName: b.bookName, line: bUnder.point, odds: bUnder.price, side: 'Under ' + bUnder.point }, window, implied: parseFloat(implied.toFixed(4)), isArb: implied < 1 });
        }
      }
    }
  }
  return middles.sort((a, b) => { if (a.isArb !== b.isArb) return a.isArb ? -1 : 1; return b.window - a.window; });
}

// ── STEAM CHASING ───────────────────────────────────────────────────────────
// Detects when a sharp book (Pinnacle/Betfair) moves a line significantly between
// scans while slower soft books haven't adjusted yet — the gap = potential value.
function findSteam(prevEvents, currEvents, threshold = 0.04) {
  if (!prevEvents || prevEvents.length === 0) return [];
  const steam = [];
  for (const curr of currEvents) {
    const prev = prevEvents.find(e => e.id === curr.id);
    if (!prev) continue;
    const currPinn = curr.bookmakers?.find(b => SHARP_REFERENCE_BOOKS.includes(b.key));
    const prevPinn = prev.bookmakers?.find(b => SHARP_REFERENCE_BOOKS.includes(b.key));
    if (!currPinn || !prevPinn) continue;
    const currMkt = (currPinn.markets || []).find(m => m.key === 'h2h');
    const prevMkt = (prevPinn.markets || []).find(m => m.key === 'h2h');
    if (!currMkt || !prevMkt) continue;
    for (const currOut of (currMkt.outcomes || [])) {
      const prevOut = (prevMkt.outcomes || []).find(o => o.name === currOut.name);
      if (!prevOut) continue;
      const move = (currOut.price - prevOut.price) / prevOut.price;
      if (Math.abs(move) < threshold) continue;
      // Find soft books that haven't caught up yet and still offer better odds
      const lagging = [];
      for (const bm of (curr.bookmakers || [])) {
        if (SHARP_REFERENCE_BOOKS.includes(bm.key)) continue;
        const prevBm = (prev.bookmakers || []).find(b => b.key === bm.key);
        if (!prevBm) continue;
        const currSoft = (bm.markets || []).find(m => m.key === 'h2h');
        const prevSoft = (prevBm.markets || []).find(m => m.key === 'h2h');
        if (!currSoft || !prevSoft) continue;
        const currSoftOut = (currSoft.outcomes || []).find(o => o.name === currOut.name);
        const prevSoftOut = (prevSoft.outcomes || []).find(o => o.name === currOut.name);
        if (!currSoftOut || !prevSoftOut) continue;
        const softMove = Math.abs((currSoftOut.price - prevSoftOut.price) / prevSoftOut.price);
        // Soft book hasn't moved much AND its odds are still better than Pinnacle's new price
        if (softMove < threshold / 2 && currSoftOut.price > currOut.price) {
          const ev_pct = parseFloat(((currSoftOut.price * (1 / currOut.price / (1 / currMkt.outcomes.reduce((s,o)=>s+1/o.price,0))) - 1) * 100).toFixed(1));
          lagging.push({ book: bm.key, bookName: bm.title, odds: currSoftOut.price, prevOdds: prevSoftOut.price, ev_pct });
        }
      }
      if (lagging.length > 0) {
        steam.push({ id: curr.id + '_stm_' + currOut.name, sport: curr.sport_key, match: curr.home_team + ' vs ' + curr.away_team, commenceTime: curr.commence_time, outcome: currOut.name, prevPinnOdds: prevOut.price, currPinnOdds: currOut.price, move: parseFloat((move * 100).toFixed(1)), direction: move > 0 ? 'drifting (lengthening)' : 'shortening (sharp money in)', laggingBooks: lagging.sort((a, b) => b.odds - a.odds) });
      }
    }
  }
  return steam.sort((a, b) => Math.abs(b.move) - Math.abs(a.move));
}

// ── LINE SHOPPING ───────────────────────────────────────────────────────────
// For every event, show the best available price per outcome across all books,
// and how much better it is vs the worst price — the "leaving money on the table" gap.
function findBestOdds(events, mode = 'global', userRegion = null) {
  const results = [];
  for (const ev of events) {
    if (!ev.bookmakers || ev.bookmakers.length < 2) continue;
    const byOutcome = {};
    for (const bm of ev.bookmakers) {
      // West Africa section: only compare books actually accessible from WA —
      // otherwise the "gap" is theoretical (e.g. vs Pinnacle, which WA bettors can't use).
      if (mode === 'wa' && !isBookAccessible(bm.key, userRegion)) continue;
      const mkt = (bm.markets || []).find(m => m.key === 'h2h');
      if (!mkt) continue;
      for (const o of mkt.outcomes) {
        if (!byOutcome[o.name]) byOutcome[o.name] = [];
        byOutcome[o.name].push({ book: bm.key, bookName: bm.title, odds: o.price });
      }
    }
    const outcomes = Object.entries(byOutcome).map(([name, books]) => {
      const sorted = books.sort((a, b) => b.odds - a.odds);
      const best = sorted[0], worst = sorted[sorted.length - 1];
      const gap = parseFloat(((best.odds / worst.odds - 1) * 100).toFixed(1));
      return { name, best, worst, all: sorted, gap };
    }).filter(o => o.gap > 0);
    if (outcomes.length > 0) {
      const maxGap = Math.max(...outcomes.map(o => o.gap));
      results.push({ id: ev.id, sport: ev.sport_key, match: ev.home_team + ' vs ' + ev.away_team, commenceTime: ev.commence_time, outcomes, maxGap });
    }
  }
  return results.sort((a, b) => b.maxGap - a.maxGap);
}

function kellyCriterion(odds, trueProb, fraction = 0.25) {
  const p = trueProb / 100;
  const b = odds - 1;
  const kelly = (b * p - (1 - p)) / b;
  return Math.max(0, parseFloat((kelly * fraction * 100).toFixed(2)));
}

const MOCK_EV = [
  { id: 'ev1', sport: 'soccer_epl', match: 'Arsenal vs Chelsea', commenceTime: new Date(Date.now() + 3 * 3600000).toISOString(), outcome: 'Arsenal', book: 'betway', bookName: 'Betway', odds: 2.55, trueProb: 41.2, fairOdds: 2.43, ev_pct: 5.1 },
  { id: 'ev2', sport: 'basketball_nba', match: 'Lakers vs Celtics', commenceTime: new Date(Date.now() + 5 * 3600000).toISOString(), outcome: 'Celtics', book: '1xbet', bookName: '1xBet', odds: 1.95, trueProb: 52.8, fairOdds: 1.89, ev_pct: 3.0 },
  { id: 'ev3', sport: 'soccer_uefa_champs_league', match: 'Real Madrid vs Man City', commenceTime: new Date(Date.now() + 26 * 3600000).toISOString(), outcome: 'Draw', book: 'bet365', bookName: 'Bet365', odds: 3.90, trueProb: 26.1, fairOdds: 3.83, ev_pct: 1.8 },
  { id: 'ev4', sport: 'mma_mixed_martial_arts', match: 'Pereira vs Ankalaev', commenceTime: new Date(Date.now() + 48 * 3600000).toISOString(), outcome: 'Ankalaev', book: 'marathonbet', bookName: 'MarathonBet', odds: 2.45, trueProb: 42.0, fairOdds: 2.38, ev_pct: 2.9 },
];

function calcStakes(outcomes, total) {
  const imp = outcomes.map(o => 1 / o.odds);
  const sum = imp.reduce((a, b) => a + b, 0);
  const stakes = imp.map(i => total * (i / sum));
  const returns = outcomes.map((o, i) => stakes[i] * o.odds);
  return { stakes, returns, minReturn: Math.min(...returns), profit: Math.min(...returns) - total };
}

function timeUntil(iso) {
  const d = new Date(iso) - Date.now();
  if (d < 0) return 'In progress';
  const h = Math.floor(d / 3600000), m = Math.floor((d % 3600000) / 60000);
  if (h > 24) return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

function getSportInfo(key) {
  const s = ALL_SPORTS.find(s => s.key === key);
  const g = SPORT_GROUPS.find(g => g.sports.some(s => s.key === key));
  return { label: s ? s.label : key, emoji: g ? g.group.split(' ')[0] : '🎯' };
}

const C = { bg: '#f8fafc', white: '#fff', dark: '#0a0f1e', green: '#059669', greenLight: '#dcfce7', greenDark: '#14532d', amber: '#d97706', amberLight: '#fef3c7', blue: '#1d4ed8', blueLight: '#eff6ff', gray: '#64748b', grayLight: '#f1f5f9', border: '#e2e8f0', text: '#0f172a', muted: '#64748b', teal: '#6ee7b7', purple: '#7c3aed', purpleLight: '#ede9fe' };

const st = {
  app: { fontFamily: 'system-ui,sans-serif', background: C.bg, minHeight: '100vh', paddingBottom: 60 },
  header: { background: C.dark, padding: '16px 16px 14px', marginBottom: 16 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  logoBox: { width: 36, height: 36, borderRadius: 8, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 },
  logoTitle: { fontSize: 20, fontWeight: 700, color: '#fff' },
  logoSub: { fontSize: 12, color: C.teal },
  headerRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: (bg, col) => ({ background: bg, color: col, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }),
  tabs: { display: 'flex', overflowX: 'auto', padding: '0 12px', marginBottom: 14, gap: 4 },
  tab: (a) => ({ padding: '8px 13px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', background: a ? C.dark : C.grayLight, color: a ? C.teal : C.muted }),
  setupBox: { marginTop: 12, background: '#1f2937', borderRadius: 10, padding: '12px 14px' },
  setupText: { fontSize: 12, color: '#9ca3af', marginBottom: 10, lineHeight: 1.5 },
  section: { padding: '0 12px' },
  card: (sel, demo) => ({ background: C.white, borderRadius: 12, padding: '13px 14px', marginBottom: 10, cursor: 'pointer', border: sel ? '2px solid #00d4aa' : demo ? '1px dashed ' + C.amber : '1px solid ' + C.border }),
  cardRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  matchTitle: { fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 2 },
  sportLabel: { fontSize: 12, color: C.muted, marginBottom: 3 },
  profitBadge: (m) => ({ background: m >= 3 ? C.greenLight : m >= 1.5 ? C.amberLight : C.grayLight, color: m >= 3 ? C.greenDark : m >= 1.5 ? '#78350f' : C.gray, fontSize: 13, fontWeight: 700, padding: '4px 11px', borderRadius: 20, flexShrink: 0 }),
  oddsGrid: (n) => ({ display: 'grid', gridTemplateColumns: 'repeat(' + Math.min(n, 3) + ',1fr)', gap: 6, marginTop: 8 }),
  oddsCell: { background: C.grayLight, borderRadius: 8, padding: '8px 10px' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 },
  metric: { background: C.grayLight, borderRadius: 10, padding: '11px 12px' },
  metricLabel: { fontSize: 11, color: C.muted, marginBottom: 4 },
  metricVal: (c) => ({ fontSize: 20, fontWeight: 700, color: c || C.text }),
  input: { padding: '8px 11px', border: '1px solid ' + C.border, borderRadius: 8, fontSize: 14, width: '100%', background: C.white, color: C.text },
  btn: (v) => ({ padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, ...(v === 'primary' ? { background: C.dark, color: C.teal } : v === 'danger' ? { background: '#fef2f2', color: '#dc2626' } : v === 'success' ? { background: C.greenLight, color: C.greenDark } : v === 'purple' ? { background: C.purpleLight, color: C.purple } : { background: C.grayLight, color: C.text, border: '1px solid ' + C.border }) }),
  guideH: { fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8, marginTop: 18 },
  guideP: { fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 6 },
};

const EMPTY_MANUAL = { match: '', sport: 'soccer_epl', commenceTime: new Date(Date.now() + 3600000).toISOString() };

export default function App() {
  const [tab, setTab] = useState('scanner');
const [apiKey, setApiKey] = useState('server');
  const [apiInput, setApiInput] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [arbs, setArbs] = useState(MOCK);
  const [arbsWAReal, setArbsWAReal] = useState([]); // properly computed WA-only arbs (not a post-filter of global picks)
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, sport: '' });
  const [lastFetch, setLastFetch] = useState(null);
  const [error, setError] = useState('');
  const [isDemo, setIsDemo] = useState(true);
  const [isDemoEV, setIsDemoEV] = useState(true);
  const [waHealth, setWaHealth] = useState(null);
  const [sel, setSel] = useState(null);
  const [stake, setStake] = useState(500);
  const [currency, setCurrency] = useState('GHS');
  const [groupFilter, setGroupFilter] = useState('all');
  const TOP_SPORTS = ['soccer_epl','soccer_uefa_champs_league','soccer_spain_la_liga','soccer_germany_bundesliga','soccer_italy_serie_a','soccer_france_ligue_one','soccer_africa_cup_of_nations','soccer_ghana_premiership','soccer_fifa_world_cup','basketball_nba','tennis_atp_wimbledon','tennis_wta_wimbledon','mma_mixed_martial_arts','boxing_boxing','cricket_ipl','cricket_t20_world_cup','americanfootball_nfl','soccer_uefa_europa_league','soccer_conmebol_copa_libertadores','soccer_usa_mls'];
const [selectedSports, setSelectedSports] = useState(() => {
  try { const saved = localStorage.getItem('arb_sports'); return saved ? JSON.parse(saved) : TOP_SPORTS; } catch { return TOP_SPORTS; }
});
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [minMargin, setMinMargin] = useState(0);
  const [wayFilter, setWayFilter] = useState('all');
  const [accessOnly, setAccessOnly] = useState(false);
  const [bets, setBets] = useState([]);
  const betsRef = React.useRef(bets);
  // Cash-out analyzer state
  const [coStake, setCoStake] = useState('');
  const [coOdds, setCoOdds] = useState('');
  const [coCurrentOdds, setCoCurrentOdds] = useState('');
  const [coOffer, setCoOffer] = useState('');
  const [coLoadedBetId, setCoLoadedBetId] = useState(null);
  useEffect(() => { betsRef.current = bets; }, [bets]);
  const [bankroll, setBankroll] = useState(() => { try { return parseFloat(localStorage.getItem('arb_bankroll') || '500'); } catch { return 500; } });
  const [referrals, setReferrals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('arb_referrals') || '{}'); } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem('arb_referrals', JSON.stringify(referrals)); } catch {} }, [referrals]);
  const [trackerView, setTrackerView] = useState('bets'); // 'bets' | 'dashboard'
  const [clvInputs, setClvInputs] = useState({}); // betId -> closing odds string
  useEffect(() => { try { localStorage.setItem('arb_sports', JSON.stringify(selectedSports)); } catch {} }, [selectedSports]);

useEffect(() => {
  try {
    const saved = localStorage.getItem('arb_bets');
    if (saved) setBets(JSON.parse(saved));
  } catch {}
}, []);
  const [manualOutcomes, setManualOutcomes] = useState([
    { label: 'Home', book: 'betway', odds: '' },
    { label: 'Draw', book: 'sportybet', odds: '' },
    { label: 'Away', book: 'betano', odds: '' },
  ]);
  const [manualMeta, setManualMeta] = useState(EMPTY_MANUAL);
  const [manualStake, setManualStake] = useState(500);
  const [manualResult, setManualResult] = useState(null);
  const [evBets, setEvBets] = useState(MOCK_EV);
  const [evWA, setEvWA] = useState([]); // West Africa EV bets — Pinnacle reference, WA-accessible books only
  const [evSection, setEvSection] = useState('global'); // 'global' | 'wa'
  const [minEV, setMinEV] = useState(2);
  const [evStake, setEvStake] = useState(500);
  const [evFilter, setEvFilter] = useState('all');
  const [drawOnly, setDrawOnly] = useState(false); // 🎯 Draw Value filter — +EV tab
  const [reboundOnly, setReboundOnly] = useState(false); // 🔄 Form rebound filter — +EV tab
  const [analyzerGames, setAnalyzerGames] = useState([]);
  const [analyzerLoading, setAnalyzerLoading] = useState(false);
  const [analyzerSportFilter, setAnalyzerSportFilter] = useState('all');
  const [gameAnalyses, setGameAnalyses] = useState({});
  const [analyzingGameId, setAnalyzingGameId] = useState(null);
  const [analyzerLoaded, setAnalyzerLoaded] = useState(false);
  const [quota, setQuota] = useState({ remaining: null, used: null, keyIndex: 1 });
  const [userRegion, setUserRegion] = useState({ country: null, isWA: true, accessibleBooks: null }); // default WA until detected
  const [nextScanAt, setNextScanAt] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [cardAnalysis, setCardAnalysis] = useState({});
  const [analyzingId, setAnalyzingId] = useState(null);
  const [middles, setMiddles] = useState([]);
  const [middlesWA, setMiddlesWA] = useState([]); // West Africa middles — both legs accessible
  const [waDebug, setWaDebug] = useState(null); // TEMP: on-screen WA diagnostics (no dev tools needed)
  const [middleSection, setMiddleSection] = useState('global'); // 'global' | 'wa'
  const [steam, setSteam] = useState([]);
  const [bestOdds, setBestOdds] = useState([]);
  const [bestOddsWA, setBestOddsWA] = useState([]); // West Africa line shopping — accessible books only
  const [lineshopSection, setLineshopSection] = useState('global'); // 'global' | 'wa'
  const [edgeTab, setEdgeTab] = useState('lineshop'); // 'lineshop' | 'middle' | 'steam'
  const prevEventsRef = React.useRef([]);

  const fetchOdds = useCallback(async (key) => {
  if (!key) return;
    setLoading(true); setError('');
    const sportsToScan = ALL_SPORTS.filter(s => selectedSports.includes(s.key));
    const all = [];
    let okCount = 0, lastFailStatus = null, lastFailBody = '';
    // Aggregates WA scraper health across the ENTIRE scan, not just the last sport checked —
    // previously setWaHealth() was called fresh on every iteration, so a 403 on sport #3
    // would get silently overwritten by sport #20's "ok" status, making the "WA 3/3" badge
    // lie about scrapers that actually failed partway through.
    const waHealthAgg = {};
    for (let i = 0; i < sportsToScan.length; i++) {
      const sp = sportsToScan[i];
      setScanProgress({ current: i + 1, total: sportsToScan.length, sport: sp.label });
      await new Promise(r => setTimeout(r, 1000));
      try {
        // Outright/futures sport keys (e.g. '..._winner') ONLY accept markets=outrights.
        // Regular match-based sports ONLY accept h2h/spreads/totals. Mixing the two in
        // one request triggers the upstream API's INVALID_MARKET_COMBO error and fails
        // the ENTIRE request — which is why every sport was coming back empty.
        const isOutright = sp.key.endsWith('_winner');
        const sportMarkets = isOutright ? 'outrights' : 'h2h,spreads,totals';
        const res = await fetch('/api/odds?sport=' + sp.key + '&region=' + sp.region + '&market=' + sportMarkets);
        if (res.status === 401) { setError('Invalid API key.'); break; }
        if (res.status === 429) { setError('API quota reached. Try again later.'); break; }
        if (!res.ok) {
          lastFailStatus = res.status;
          try { lastFailBody = await res.text(); } catch { lastFailBody = ''; }
          console.warn('Odds fetch failed for', sp.key, res.status, lastFailBody);
          continue;
        }
        okCount++;
        const json = await res.json();
const data = json.data || json;
if (json.remainingRequests) setQuota({ remaining: json.remainingRequests, used: json.usedRequests, keyIndex: json.keyIndex || 1 });
if (json.userAccessibleBooks) {
  setUserRegion({ country: json.userCountry, isWA: json.isWAUser, accessibleBooks: json.userAccessibleBooks });
}
if (json.waBookHealth) {
  Object.entries(json.waBookHealth).forEach(([book, h]) => {
    if (!waHealthAgg[book]) waHealthAgg[book] = { ok: true, fetchedAt: h?.fetchedAt, failedSports: [] };
    if (!h || !h.ok) {
      waHealthAgg[book].ok = false;
      waHealthAgg[book].failedSports.push(sp.key + (h?.reason ? ' (' + h.reason + ')' : ''));
    }
    waHealthAgg[book].fetchedAt = h?.fetchedAt || waHealthAgg[book].fetchedAt;
  });
}
data.forEach(e => { e.sport_key = sp.key; });
all.push(...data);
if (i === 0) console.log('Books seen:', data.flatMap(e => (e.bookmakers||[]).map(b=>b.key)).filter((v,i,a)=>a.indexOf(v)===i).join(', '));
      } catch (err) { console.warn('Sport fetch threw for', sp.key, err); }
    }
    // Finalize aggregated WA health into the {ok, reason, fetchedAt} shape the badge expects.
    Object.keys(waHealthAgg).forEach(book => {
      const b = waHealthAgg[book];
      b.reason = b.ok
        ? 'ok across all ' + sportsToScan.length + ' sports scanned'
        : b.failedSports.length + '/' + sportsToScan.length + ' sports failed: ' + b.failedSports.slice(0, 3).join(', ') + (b.failedSports.length > 3 ? ' …' : '');
    });
    if (Object.keys(waHealthAgg).length > 0) setWaHealth(waHealthAgg);
    if (sportsToScan.length > 0 && okCount === 0) {
      setError('Could not load odds for any of the ' + sportsToScan.length + ' sports scanned (last status: ' + (lastFailStatus ?? 'network error') + '). This is not "no arbs found" — the scan itself failed. Showing demo data below.');
    }
    const found = findArbs(all, 'global', userRegion);
    const foundArbsWA = findArbs(all, 'wa', userRegion);
    const foundEV = findEVBets(all, minEV, 'global', userRegion);
    const foundEVWA = findEVBets(all, minEV, 'wa', userRegion);
    if (found.length > 0) { setArbs(found); setIsDemo(false); setLastFetch(new Date()); }
    else { setArbs(MOCK); setIsDemo(true); }
    setArbsWAReal(foundArbsWA);
    if (foundEV.length > 0) { setEvBets(foundEV); setIsDemoEV(false); }
    else if (okCount === 0) { setEvBets(MOCK_EV); setIsDemoEV(true); } // scan failed entirely
    else { setEvBets([]); setIsDemoEV(false); } // scan worked, genuinely no +EV right now
    setEvWA(foundEVWA);
    const middlesWAResult = findMiddles(all, 'wa', userRegion);
    const bestOddsWAResult = findBestOdds(all, 'wa', userRegion);
    setMiddles(findMiddles(all, 'global', userRegion));
    setMiddlesWA(middlesWAResult);
    setSteam(findSteam(prevEventsRef.current, all));
    setBestOdds(findBestOdds(all, 'global', userRegion));
    setBestOddsWA(bestOddsWAResult);

    // ── TEMP DEBUG: diagnose why the WA section is empty ──────────────────────
    // Remove once the root cause is confirmed.
    (() => {
      const keyCounts = {};
      all.forEach(ev => (ev.bookmakers || []).forEach(bm => {
        keyCounts[bm.key] = (keyCounts[bm.key] || 0) + 1;
      }));
      const accessibleSeen = Object.keys(keyCounts).filter(k => isBookAccessible(k, userRegion));
      const unknownKeys = Object.keys(keyCounts).filter(k => !BOOKS[k]);
      const eventsWith2PlusAccessible = all.filter(ev =>
        (ev.bookmakers || []).filter(bm => isBookAccessible(bm.key, userRegion)).length >= 2
      ).length;
      const debugInfo = {
        totalEvents: all.length,
        keyCounts,
        accessibleSeen,
        unknownKeys,
        eventsWith2PlusAccessible,
        bestOddsWACount: bestOddsWAResult.length,
        middlesWACount: middlesWAResult.length,
      };
      console.log('[WA debug]', debugInfo);
      setWaDebug(debugInfo);
    })();

    // ── AUTO-CLV CAPTURE ────────────────────────────────────────────────────────
    // For pending EV bets: while the match hasn't kicked off, keep refreshing
    // lastSeenOdds with whatever this same book is currently quoting for that
    // outcome — that's our best running candidate for "the closing line." Once
    // commence_time has passed (or the event drops out of the scan entirely,
    // which also means it's started/no longer prematch), lock that last-seen
    // value in as clvOdds permanently. This replaces having to remember to type
    // in the closing odds yourself near kickoff.
    const pendingEV = betsRef.current.filter(b => b.type === 'ev' && b.status === 'pending' && b.clvOdds == null);
    if (pendingEV.length > 0) {
      const updates = {}; // bet.id -> { lastSeenOdds?, clvOdds?, clvSource? }
      for (const bet of pendingEV) {
        const leg = bet.outcomes && bet.outcomes[0];
        if (!leg) continue;
        const matchEvent = all.find(e => e.id === bet.eventId);
        const started = bet.commenceTime ? new Date(bet.commenceTime).getTime() <= Date.now() : false;

        let currentOdds = null;
        if (matchEvent) {
          const bm = (matchEvent.bookmakers || []).find(b => b.key === leg.book);
          const mkt = bm && (bm.markets || []).find(m => m.key === 'h2h');
          const out = mkt && mkt.outcomes.find(o => o.name === leg.label);
          if (out) currentOdds = out.price;
        }

        if (!started) {
          // Still pre-kickoff — keep tracking the freshest price as the running candidate.
          if (currentOdds != null) updates[bet.id] = { lastSeenOdds: currentOdds };
        } else {
          // Kickoff has passed — lock in whatever we've got: prefer a live odds read
          // from this scan (book may briefly still show it), else fall back to the
          // last pre-kickoff value we captured.
          const finalOdds = currentOdds != null ? currentOdds : bet.lastSeenOdds;
          if (finalOdds != null) updates[bet.id] = { clvOdds: finalOdds, clvSource: 'auto' };
        }
      }
      if (Object.keys(updates).length > 0) {
        setBets(prev => prev.map(b => updates[b.id] ? { ...b, ...updates[b.id] } : b));
      }
    }

    prevEventsRef.current = all;
    setLoading(false);
    setNextScanAt(Date.now() + 12 * 60 * 1000);
  }, [selectedSports, minEV]);

  const saveKey = () => {
    try { localStorage.setItem('oa_key', apiInput); } catch {}
    setApiKey(apiInput); setShowSetup(false); fetchOdds(apiInput);
  };

  useEffect(() => {
  const now = new Date();
  if (!lastFetch || (now - new Date(lastFetch)) > 12 * 60 * 1000) {
    fetchOdds(apiKey || 'server');
  }
  const id = setInterval(() => { if (apiKey) fetchOdds(apiKey); }, 12 * 60 * 1000);
  return () => clearInterval(id);
}, [apiKey, fetchOdds]);
  
  useEffect(() => { try { localStorage.setItem('arb_bets', JSON.stringify(bets)); } catch {} }, [bets]);
  useEffect(() => { try { localStorage.setItem('arb_bankroll', bankroll.toString()); } catch {} }, [bankroll]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (nextScanAt) {
        const secs = Math.max(0, Math.round((nextScanAt - Date.now()) / 1000));
        setCountdown(secs);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [nextScanAt]);

  const logBet = (outcomes, matchName, sport, profitAmt, betType) => {
    const c = calcStakes(outcomes, stake);
    setBets(p => [{ id: Date.now(), match: matchName || sel.match, sport: sport || sel.sport, margin: sel ? sel.margin : 0, stake, currency, profit: profitAmt !== undefined ? profitAmt : parseFloat(c.profit.toFixed(2)), date: new Date().toISOString(), status: 'pending', type: betType || 'arb', outcomes: outcomes.map((o, i) => ({ ...o, stake: parseFloat(c.stakes[i].toFixed(2)), ret: parseFloat(c.returns[i].toFixed(2)) })) }, ...p]);
    setTab('tracker');
  };

  const logEVBet = (bet, kellyStake, expectedProfit) => {
    setBets(p => [{ id: Date.now(), match: bet.match, sport: bet.sport, margin: bet.ev_pct, stake: kellyStake, currency, profit: expectedProfit, date: new Date().toISOString(), status: 'pending', type: 'ev', eventId: bet.eventId, commenceTime: bet.commenceTime, clvOdds: null, clvSource: null, lastSeenOdds: null, placedOdds: bet.odds, outcomes: [{ label: bet.outcome, bookName: bet.bookName, book: bet.book, odds: bet.odds, stake: kellyStake, ret: parseFloat((kellyStake * bet.odds).toFixed(2)) }] }, ...p]);
    setTab('tracker');
  };

  // Pre-fills the Cash-Out Analyzer from a pending tracked bet, and tries to
  // auto-pull the SAME book+outcome's current price from the latest scan as a
  // starting estimate of "what the market thinks now" — same lookup pattern as
  // CLV auto-capture. Always editable afterward since live cash-out offers and
  // the book's own live in-play price aren't something we can read directly.
  const loadBetIntoCashout = (bet) => {
    const leg = bet.outcomes && bet.outcomes[0];
    if (!leg) return;
    setCoLoadedBetId(bet.id);
    setCoStake(String(bet.stake));
    setCoOdds(String(leg.odds));
    setCoOffer('');
    let liveOdds = null;
    if (bet.eventId) {
      const ev = (prevEventsRef.current || []).find(e2 => e2.id === bet.eventId);
      const bm = ev && (ev.bookmakers || []).find(b => b.key === leg.book);
      const mkt = bm && (bm.markets || []).find(m => m.key === 'h2h');
      const out = mkt && mkt.outcomes.find(o => o.name === leg.label);
      if (out) liveOdds = out.price;
    }
    setCoCurrentOdds(liveOdds != null ? String(liveOdds) : '');
    setTab('cashout');
  };

const analyzeArb = async (arb) => {  
  if (analyzingId === arb.id) return;
  setAnalyzingId(arb.id);
  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match: arb.match, sport: getSportInfo(arb.sport).label,
        outcomes: arb.outcomes, margin: arb.margin,
        marketType: arb.marketType || 'Match Winner'
      })
    });
    const data = await res.json();
    setCardAnalysis(p => ({ ...p, [arb.id]: data }));
  } catch (err) {
    setCardAnalysis(p => ({ ...p, [arb.id]: { error: 'Analysis failed' } }));
  }
  setAnalyzingId(null);
};

  const calcManual = () => {
    const valid = manualOutcomes.filter(o => o.odds && parseFloat(o.odds) > 1);
    if (valid.length < 2) return;
    const c = calcStakes(valid.map(o => ({ ...o, odds: parseFloat(o.odds) })), manualStake);
    setManualResult({ outcomes: valid.map(o => ({ ...o, odds: parseFloat(o.odds) })), ...c, margin: parseFloat((((1 - valid.reduce((s, o) => s + 1 / parseFloat(o.odds), 0)) / valid.reduce((s, o) => s + 1 / parseFloat(o.odds), 0)) * 100).toFixed(2)) });
  };

  const updateManualOutcome = (i, field, val) => setManualOutcomes(p => p.map((o, idx) => idx === i ? { ...o, [field]: val } : o));
  const addManualOutcome = () => setManualOutcomes(p => [...p, { label: 'Outcome ' + (p.length + 1), book: 'betano', odds: '' }]);
  const removeManualOutcome = (i) => setManualOutcomes(p => p.filter((_, idx) => idx !== i));

  const [arbSection, setArbSection] = useState('all'); // 'all' | 'global' | 'wa'

  // 'wa' now pulls from arbsWAReal — arbs computed with every leg restricted to
  // accessible books from the start, not a post-hoc filter of global-best picks
  // (which almost never coincidentally land on WA books for every single leg).
  const arbsBase = arbSection === 'wa' ? arbsWAReal : arbs;

  const filteredArbs = arbsBase.filter(a => {
    if (groupFilter !== 'all') { const g = SPORT_GROUPS.find(g => g.group === groupFilter); if (g && !g.sports.some(s => s.key === a.sport)) return false; }
    if (wayFilter === '2' && a.outcomes.length !== 2) return false;
    if (wayFilter === '3' && a.outcomes.length !== 3) return false;
    if (accessOnly && !isFullyAccessible(a.outcomes, userRegion)) return false;
    if (arbSection === 'global' && isFullyAccessible(a.outcomes, userRegion)) return false;
    return a.margin >= minMargin;
  });

  // Independent totals for the metrics grid — each computed from its own properly-sourced
  // array (not a partition of one mixed array), same pattern as Line Shopping/Middles/+EV.
  const sameFilters = a => {
    if (groupFilter !== 'all') { const g = SPORT_GROUPS.find(g => g.group === groupFilter); if (g && !g.sports.some(s => s.key === a.sport)) return false; }
    if (wayFilter === '2' && a.outcomes.length !== 2) return false;
    if (wayFilter === '3' && a.outcomes.length !== 3) return false;
    return a.margin >= minMargin;
  };
  const arbsGlobal = arbs.filter(sameFilters);
  const arbsWA     = arbsWAReal.filter(sameFilters);

  const calc = sel ? calcStakes(sel.outcomes, stake) : null;

  // ── KEY FIX: use named import instead of React.createElement
  const e = createElement;

  return e('div', { style: st.app },
    e('div', { style: st.header },
      e('div', { style: st.logoRow },
        e('div', { style: st.logoBox }, '📈'),
        e('div', null, e('div', { style: st.logoTitle }, 'ArbEdge'), e('div', { style: st.logoSub }, '🌍 Global · 🇬🇭 West Africa'))
      ),
      e('div', { style: st.headerRow },
        e('span', { style: st.badge('#052e16', '#6ee7b7') }, loading ? '⟳ ' + scanProgress.sport + '...' : '● ' + filteredArbs.length + ' arbs'),
        lastFetch && e('span', { style: st.badge('#1f2937', '#9ca3af') }, lastFetch.toLocaleTimeString()),
        isDemo && e('span', { style: st.badge('#451a03', '#fcd34d') }, '⚠ Demo'),
        waHealth && (() => {
          const books = Object.entries(waHealth);
          const upCount = books.filter(([, h]) => h && h.ok).length;
          const allUp = upCount === books.length;
          const allDown = upCount === 0;
          const bg = allUp ? '#052e16' : allDown ? '#450a0a' : '#451a03';
          const fg = allUp ? '#6ee7b7' : allDown ? '#fca5a5' : '#fcd34d';
          const icon = allUp ? '✓' : allDown ? '✕' : '⚠';
          return e('span', {
            style: st.badge(bg, fg),
            title: books.map(([name, h]) => name + ': ' + (h && h.ok ? 'live' : (h && h.reason) || 'unknown')).join(' · '),
          }, icon + ' WA ' + upCount + '/' + books.length);
        })(),
        e('button', { onClick: () => setShowSetup(v => !v), style: { ...st.btn('outline'), fontSize: 11, padding: '4px 10px' } }, apiKey ? '⚙ Connected' : 'Connect Live ↗')
      ),
      showSetup && e('div', { style: st.setupBox },
        e('div', { style: st.setupText }, 'Free API key at the-odds-api.com — covers FIFA World Cup, AFCON, all tennis Slams, NBA, UFC, Cricket + 100 leagues.'),
        e('div', { style: { display: 'flex', gap: 8 } },
          e('input', { value: apiInput, onChange: ev => setApiInput(ev.target.value), placeholder: 'Paste Odds API key...', style: { ...st.input, flex: 1, background: '#1f2937', borderColor: '#374151', color: '#f9fafb' } }),
          e('button', { onClick: saveKey, style: st.btn('primary') }, 'Save')
        )
      )
    ),
    e('div', { style: st.tabs },
      [['scanner','🔍 Scanner'], ['calculator','🧮 Calculator'], ['manual','✏️ Manual Arb'], ['ev','📈 +EV Bets'], ['edge','⚡ Edge Tools'], ['analyzer','🧠 Bet Analyzer'], ['tracker','📒 Bets (' + bets.length + ')'], ['cashout','💸 Cash Out'], ['earn','💰 Earn'], ['guide','📚 Guide']].map(([k, l]) =>
        e('button', { key: k, style: st.tab(tab === k), onClick: () => setTab(k) }, l)
      )
    ),
    // ── CASH OUT ANALYZER ──
    tab === 'cashout' && e('div', { style: st.section }, (() => {
      const stakeN = parseFloat(coStake) || 0;
      const oddsN = parseFloat(coOdds) || 0;
      const curOddsN = parseFloat(coCurrentOdds) || 0;
      const offerN = parseFloat(coOffer) || 0;
      const potentialPayout = stakeN * oddsN;
      const pWin = curOddsN > 0 ? 1 / curOddsN : 0;
      const fairValue = potentialPayout * pWin;
      const haveInputs = stakeN > 0 && oddsN > 0 && curOddsN > 0;
      const margin = haveInputs && fairValue > 0 ? ((fairValue - offerN) / fairValue) * 100 : null;
      const pendingBets = bets.filter(b => b.status === 'pending' && b.outcomes && b.outcomes[0]);

      return [
        e('div', { key: 'intro', style: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1e3a8a', lineHeight: 1.6 } },
          '💸 A cash-out offer locks in a result early instead of waiting for the bet to settle. This compares the offer against the bet\u2019s actual expected value right now — bookmakers typically build in extra margin on top of the normal vig, so cash-out offers are very often below fair value. Holding is the higher-EV move on average, but it carries variance that cashing out removes entirely — that trade-off is a real, personal risk-tolerance call, not just a math answer.'
        ),

        pendingBets.length > 0 && e('div', { key: 'loader', style: { marginBottom: 14 } },
          e('div', { style: { fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 } }, 'LOAD FROM YOUR PENDING BETS'),
          e('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            pendingBets.map(b => e('button', {
              key: b.id,
              onClick: () => loadBetIntoCashout(b),
              style: { ...st.btn(coLoadedBetId === b.id ? 'primary' : 'outline'), textAlign: 'left', fontSize: 12, padding: '8px 12px', justifyContent: 'flex-start' }
            }, b.match + ' · ' + b.outcomes[0].label + ' @ ' + b.outcomes[0].odds + ' · stake ' + currency + b.stake))
          )
        ),

        e('div', { key: 'inputs', style: { ...st.card(false), cursor: 'default', display: 'flex', flexDirection: 'column', gap: 10 } },
          e('div', null,
            e('label', { style: { fontSize: 11, color: C.muted } }, 'Stake (' + currency + ')'),
            e('input', { type: 'number', value: coStake, onChange: ev => { setCoStake(ev.target.value); setCoLoadedBetId(null); }, style: st.input, placeholder: 'e.g. 50' })
          ),
          e('div', null,
            e('label', { style: { fontSize: 11, color: C.muted } }, 'Odds you took'),
            e('input', { type: 'number', step: 0.01, value: coOdds, onChange: ev => { setCoOdds(ev.target.value); setCoLoadedBetId(null); }, style: st.input, placeholder: 'e.g. 3.50' })
          ),
          e('div', null,
            e('label', { style: { fontSize: 11, color: C.muted } }, 'Current odds for the SAME outcome, right now (any book — this estimates the market\u2019s current win probability)'),
            e('input', { type: 'number', step: 0.01, value: coCurrentOdds, onChange: ev => setCoCurrentOdds(ev.target.value), style: st.input, placeholder: 'e.g. 2.20' })
          ),
          e('div', null,
            e('label', { style: { fontSize: 11, color: C.muted } }, 'Cash-out offer shown in your betting app (' + currency + ')'),
            e('input', { type: 'number', value: coOffer, onChange: ev => setCoOffer(ev.target.value), style: st.input, placeholder: 'e.g. 95' })
          )
        ),

        haveInputs && e('div', { key: 'results', style: { marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 } },
          e('div', { style: st.metricsGrid },
            [
              ['Payout if win', currency + potentialPayout.toFixed(2), null],
              ['Implied win prob.', (pWin * 100).toFixed(1) + '%', null],
              ['Fair value of holding', currency + fairValue.toFixed(2), C.blue],
            ].map(([label, val, color]) =>
              e('div', { key: label, style: st.metric },
                e('div', { style: st.metricLabel }, label),
                e('div', { style: st.metricVal(color) }, val)
              )
            )
          ),
          offerN > 0 && margin !== null && e('div', { style: { background: margin > 0 ? '#fff7ed' : C.greenLight, border: '1px solid ' + (margin > 0 ? '#fed7aa' : C.green), borderRadius: 10, padding: '12px 14px' } },
            e('div', { style: { fontSize: 14, fontWeight: 700, color: margin > 0 ? '#9a3412' : C.greenDark, marginBottom: 4 } },
              margin > 0
                ? '📉 Offer is ' + Math.abs(margin).toFixed(1) + '% below fair value — the book is keeping a cut to cash you out'
                : '📈 Offer is ' + Math.abs(margin).toFixed(1) + '% above fair value — better than holding, in EV terms'
            ),
            e('div', { style: { fontSize: 12, color: margin > 0 ? '#9a3412' : C.greenDark, lineHeight: 1.5 } },
              margin > 0
                ? 'Pure expected value says hold — but holding means risking the full stake for a payout that may not come. ' + currency + offerN.toFixed(2) + ' guaranteed now vs ' + currency + fairValue.toFixed(2) + ' expected (but not guaranteed) if you wait.'
                : 'Cashing out now beats the bet\u2019s own expected value AND removes the risk entirely — this is the rare case where cash-out is the clearly better move both ways.'
            )
          )
        )
      ];
    })()),

    // ── EARN: affiliate referral program manager ──
    tab === 'earn' && e('div', { style: st.section },
      e('div', { style: { background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#6b21a8', lineHeight: 1.6 } },
        '💰 Each book below runs its own official affiliate program — you earn a cut of what referred players generate, paid by the book itself, not through this app. Sign up directly with each program, then paste your personal link/code here just to keep them organized and easy to share.'
      ),
      e('div', { style: { background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#9a3412', lineHeight: 1.6 } },
        '⚠️ Revenue-share commissions are a cut of what referred players lose, not just sign-ups — that\u2019s how every one of these programs works, not a quirk of one book. Every program also requires you to promote responsibly (no targeting minors, no exaggerated claims, no incentivizing problem gambling) — that\u2019s a condition of staying enrolled, not just good practice.'
      ),
      EARN_PROGRAMS.map(p => {
        const ref = referrals[p.key] || { link: '', code: '' };
        const shareText = encodeURIComponent('Check out ' + p.name + (ref.code ? ' — use my code ' + ref.code : '') + (ref.link ? ': ' + ref.link : ''));
        return e('div', { key: p.key, style: { ...st.card(false), cursor: 'default', marginBottom: 12 } },
          e('div', { style: st.cardRow },
            e('div', null,
              e('div', { style: { fontSize: 15, fontWeight: 700 } }, p.name),
              e('div', { style: { fontSize: 12, color: C.muted, marginTop: 2 } }, p.commission)
            ),
            e('a', { href: p.signupUrl, target: '_blank', rel: 'noopener noreferrer', style: { ...st.btn('outline'), fontSize: 12, padding: '6px 12px', textDecoration: 'none' } }, 'Join program ↗')
          ),
          e('div', { style: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 } },
            e('input', {
              placeholder: 'Your referral link (after signing up)', value: ref.link,
              onChange: ev => setReferrals(prev => ({ ...prev, [p.key]: { ...ref, link: ev.target.value } })),
              style: { ...st.input, fontSize: 12 }
            }),
            e('input', {
              placeholder: 'Your referral/partner code (optional)', value: ref.code,
              onChange: ev => setReferrals(prev => ({ ...prev, [p.key]: { ...ref, code: ev.target.value } })),
              style: { ...st.input, fontSize: 12 }
            })
          ),
          (ref.link || ref.code) && e('div', { style: { marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' } },
            ref.link && e('button', {
              onClick: () => navigator.clipboard && navigator.clipboard.writeText(ref.link),
              style: { ...st.btn('outline'), fontSize: 11, padding: '5px 10px' }
            }, '📋 Copy link'),
            e('a', {
              href: 'https://wa.me/?text=' + shareText, target: '_blank', rel: 'noopener noreferrer',
              style: { ...st.btn('success'), fontSize: 11, padding: '5px 10px', textDecoration: 'none' }
            }, '📲 Share via WhatsApp')
          )
        );
      })
    ),
    tab === 'scanner' && e('div', { style: st.section },
      e('div', { style: st.metricsGrid },
        [
          ['All Arbs', filteredArbs.length, null],
          ['🌍 Global', arbsGlobal.length, C.blue],
          ['🇬🇭 West Africa', arbsWA.length, C.green],
          ['Next Scan', loading ? '...' : (nextScanAt && !loading ? (countdown > 0 ? Math.floor(countdown / 60) + ':' + String(countdown % 60).padStart(2, '0') : '0:00') : '—'), loading ? C.muted : countdown < 30 && countdown > 0 && !loading ? C.amber : C.text]
        ].map(([l, v, c]) =>
          e('div', { key: l, style: st.metric }, e('div', { style: st.metricLabel }, l), e('div', { style: st.metricVal(c) }, v))
        )
      ),
      // Region toggle
      e('div', { style: { display: 'flex', gap: 6, marginBottom: 12 } },
        [['all','🔍 All'], ['global','🌍 Global only'], ['wa','🇬🇭 West Africa only']].map(([k,l]) =>
          e('button', { key: k, onClick: () => setArbSection(k), style: { ...st.btn(arbSection === k ? 'primary' : 'outline'), fontSize: 12, padding: '6px 12px' } }, l)
        )
      ),
      e('div', { style: { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' } },
        e('select', { value: groupFilter, onChange: ev => setGroupFilter(ev.target.value), style: { ...st.input, width: 'auto', fontSize: 12, padding: '6px 10px' } },
          e('option', { value: 'all' }, 'All sports'),
          SPORT_GROUPS.map(g => e('option', { key: g.group, value: g.group }, g.group))
        ),
        e('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          e('span', { style: { fontSize: 12, color: C.muted } }, 'Min:'),
          e('input', { type: 'range', min: 0, max: 5, step: 0.5, value: minMargin, onChange: ev => setMinMargin(parseFloat(ev.target.value)), style: { width: 70 } }),
          e('span', { style: { fontSize: 12, fontWeight: 600, minWidth: 28 } }, minMargin + '%')
        ),
        e('div', { style: { display: 'flex', gap: 6 } },
  ['all', '2', '3'].map(w =>
    e('button', { key: w, onClick: () => setWayFilter(w), style: { ...st.btn(wayFilter === w ? 'primary' : 'outline'), fontSize: 12, padding: '6px 10px' } },
      w === 'all' ? 'All' : w + '-way'
    )
  )
),
        e('button', { onClick: () => setAccessOnly(v => !v), style: { ...st.btn(accessOnly ? 'success' : 'outline'), fontSize: 12, padding: '6px 10px' } }, accessOnly ? '✓ Accessible only' : '🌍 All books'),
        e('button', { onClick: () => setShowSportPicker(v => !v), style: { ...st.btn('outline'), fontSize: 12, padding: '6px 10px' } }, '⚙ Sports (' + selectedSports.length + ')'),
        e('button', { onClick: () => fetchOdds(apiKey), disabled: loading || !apiKey, style: { ...st.btn('outline'), fontSize: 12, padding: '6px 10px' } }, loading ? '...' : '↻')
      ),
      showSportPicker && e('div', { style: { background: C.white, border: '1px solid ' + C.border, borderRadius: 12, padding: 14, marginBottom: 14, maxHeight: 300, overflowY: 'auto' } },
        e('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 10 } },
          e('span', { style: { fontSize: 13, fontWeight: 600 } }, 'Select sports to scan'),
          e('div', { style: { display: 'flex', gap: 6 } },
            e('button', { onClick: () => setSelectedSports(TOP_SPORTS), style: { ...st.btn('outline'), fontSize: 11, padding: '4px 8px' } }, 'Default'),
            e('button', { onClick: () => setSelectedSports(ALL_SPORTS.map(s => s.key)), style: { ...st.btn('success'), fontSize: 11, padding: '4px 8px' } }, 'All'),
            e('button', { onClick: () => setSelectedSports([]), style: { ...st.btn('danger'), fontSize: 11, padding: '4px 8px' } }, 'None')
          )
        ),
        SPORT_GROUPS.map(g => e('div', { key: g.group, style: { marginBottom: 12 } },
          e('div', { onClick: () => { const keys = g.sports.map(s => s.key); const allOn = keys.every(k => selectedSports.includes(k)); setSelectedSports(p => allOn ? p.filter(k => !keys.includes(k)) : [...new Set([...p, ...keys])]); }, style: { fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 } },
            e('input', { type: 'checkbox', readOnly: true, checked: g.sports.every(s => selectedSports.includes(s.key)) }), ' ', g.group
          ),
          e('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 8 } },
            g.sports.map(s => e('label', { key: s.key, style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', background: selectedSports.includes(s.key) ? C.greenLight : C.grayLight, padding: '3px 8px', borderRadius: 20, color: selectedSports.includes(s.key) ? C.greenDark : C.muted } },
              e('input', { type: 'checkbox', checked: selectedSports.includes(s.key), onChange: () => setSelectedSports(p => p.includes(s.key) ? p.filter(k => k !== s.key) : [...p, s.key]) }), ' ', s.label
            ))
          )
        ))
      ),
      error && e('div', { style: { background: '#fef3c7', color: '#92400e', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 } }, error),
        quota.remaining !== null && e('div', { style: { background: parseInt(quota.remaining) < 50 ? '#fef3c7' : '#f0fdf4', color: parseInt(quota.remaining) < 50 ? '#92400e' : '#14532d', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10, display: 'flex', justifyContent: 'space-between' } }, e('span', null, 'Key ' + (quota.keyIndex || 1) + ' | Used: ' + quota.used), e('span', { style: { fontWeight: 700 } }, quota.remaining + ' remaining')),
      isDemo && !error && e('div', { style: { background: C.blueLight, color: '#1e3a8a', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 12, lineHeight: 1.5 } },
        apiKey
          ? '📌 No live arbitrage opportunities right now — showing example cards (marked DEMO) so you can see how it works. Scan runs again automatically every 12 min.'
          : '📌 Demo mode — tap Connect Live to scan real odds across ' + ALL_SPORTS.length + ' sports. For Betano, MSport & SportyBet odds, use the ✏️ Manual Arb tab.'
      ),
 filteredArbs.map(arb => {
        const info = getSportInfo(arb.sport);
        return e('div', { key: arb.id, style: st.card(sel && sel.id === arb.id, isDemo), onClick: () => setSel(sel && sel.id === arb.id ? null : arb) },
          e('div', { style: st.cardRow },
            e('div', null, e('div', { style: st.sportLabel }, info.emoji + ' ' + info.label + ' · ⏱ ' + timeUntil(arb.commenceTime)), e('div', { style: st.matchTitle }, arb.match)),
            e('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 } },
              isDemo && e('span', { style: st.badge('#451a03', '#fcd34d') }, 'DEMO'),
              !isFullyAccessible(arb.outcomes, userRegion) && e('span', { style: st.badge('#7f1d1d', '#fecaca') }, '🚫 Not all books accessible'),
              e('span', { style: st.profitBadge(arb.margin) }, '+' + arb.margin.toFixed(1) + '%')
            )
          ),
          e('div', { style: st.oddsGrid(arb.outcomes.length) },
            arb.outcomes.map((o, i) => e('div', { key: i, style: st.oddsCell },
              e('div', { style: { fontSize: 11, color: C.muted, marginBottom: 2 } }, o.label),
              e('div', { style: { fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 1 } }, o.bookName),
              !isBookAccessible(o.book, userRegion) && e('div', { style: { fontSize: 9, fontWeight: 700, color: '#b91c1c', marginBottom: 1 } }, '🚫 Not accessible'),
              e('div', { style: { fontSize: 14, fontWeight: 700, color: C.green } }, o.odds.toFixed(2)),
              e('a', { href: (BOOKS[o.book] && BOOKS[o.book].sportUrls && BOOKS[o.book].sportUrls[arb.sport.split('_')[0]]) || (BOOKS[o.book] && BOOKS[o.book].url) || '#', target: '_blank', style: { display: 'block', marginTop: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: C.green, borderRadius: 6, padding: '3px 6px', textDecoration: 'none', textAlign: 'center' } }, 'Bet Now →')
            ))
          ),
          sel && sel.id === arb.id && e('div', { style: { marginTop: 10, display: 'flex', gap: 8 } },
            e('button', { style: st.btn('primary'), onClick: ev => { ev.stopPropagation(); setTab('calculator'); } }, 'Calculate →'),
            e('button', { style: { ...st.btn('outline'), fontSize: 12 }, onClick: ev => { ev.stopPropagation(); analyzeArb(arb); } }, analyzingId === arb.id ? 'Analyzing...' : 'AI Analysis')
          ),
          cardAnalysis[arb.id] && e('div', { style: { marginTop: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', fontSize: 12, lineHeight: 1.6 } },
            cardAnalysis[arb.id].error
              ? e('div', { style: { color: '#dc2626' } }, '⚠️ ' + cardAnalysis[arb.id].error)
              : e('div', null,
                  e('div', { style: { fontWeight: 700, fontSize: 13, color: C.greenDark, marginBottom: 8 } }, '🤖 AI Analysis'),
                  e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 } },
                    e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Predicted'), e('div', { style: { fontWeight: 700, color: C.text } }, cardAnalysis[arb.id].predictedOutcome)),
                    e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Confidence'), e('div', { style: { fontWeight: 700, color: C.blue } }, cardAnalysis[arb.id].confidence + '%')),
                    e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Risk'), e('div', { style: { fontWeight: 700, color: C.amber } }, cardAnalysis[arb.id].riskLevel)),
                    e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Best Value'), e('div', { style: { fontWeight: 700, color: C.green } }, cardAnalysis[arb.id].valueLeg))
                  ),
                  cardAnalysis[arb.id].form && e('div', { style: { background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 8 } },
                    e('div', { style: { fontWeight: 700, fontSize: 11, color: C.muted, marginBottom: 6 } }, '📊 RECENT FORM'),
                    e('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 } },
                      e('span', { style: { fontSize: 11, color: C.muted } }, 'Home:'),
                      e('span', { style: { fontWeight: 700, letterSpacing: 2 } }, cardAnalysis[arb.id].form.home)
                    ),
                    e('div', { style: { display: 'flex', justifyContent: 'space-between' } },
                      e('span', { style: { fontSize: 11, color: C.muted } }, 'Away:'),
                      e('span', { style: { fontWeight: 700, letterSpacing: 2 } }, cardAnalysis[arb.id].form.away)
                    )
                  ),
                  cardAnalysis[arb.id].goalsAvg && e('div', { style: { background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 8 } },
                    e('div', { style: { fontWeight: 700, fontSize: 11, color: C.muted, marginBottom: 6 } }, '⚽ GOALS STATS (per 90)'),
                    e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 } },
                      e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Home scored'), e('div', { style: { fontWeight: 700, color: C.green } }, cardAnalysis[arb.id].goalsAvg.homeScoredPer90)),
                      e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Home conceded'), e('div', { style: { fontWeight: 700, color: '#dc2626' } }, cardAnalysis[arb.id].goalsAvg.homeConceededPer90)),
                      e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Away scored'), e('div', { style: { fontWeight: 700, color: C.green } }, cardAnalysis[arb.id].goalsAvg.awayScoredPer90)),
                      e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Away conceded'), e('div', { style: { fontWeight: 700, color: '#dc2626' } }, cardAnalysis[arb.id].goalsAvg.awayConceededPer90))
                    )
                  ),
                  cardAnalysis[arb.id].h2h && e('div', { style: { background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 12, color: C.text } },
                    e('div', { style: { fontWeight: 700, fontSize: 11, color: C.muted, marginBottom: 4 } }, '🔁 HEAD TO HEAD'),
                    e('div', null, cardAnalysis[arb.id].h2h)
                  ),
                  cardAnalysis[arb.id].additionalBets && e('div', { style: { marginBottom: 8 } },
                    e('div', { style: { fontWeight: 700, fontSize: 11, color: C.muted, marginBottom: 6 } }, '💡 ADDITIONAL MARKETS'),
                    cardAnalysis[arb.id].additionalBets.map((bet, i) =>
                      e('div', { key: i, style: { background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 6 } },
                        e('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 3 } },
                          e('span', { style: { fontWeight: 700, color: C.text } }, bet.market),
                          e('span', { style: { background: C.greenLight, color: C.greenDark, fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 12 } }, bet.recommendation + ' · ' + bet.confidence + '%')
                        ),
                        e('div', { style: { fontSize: 11, color: C.muted } }, bet.reasoning)
                      )
                    )
                  ),
                  e('div', { style: { background: C.amberLight, borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#78350f' } },
                    e('div', { style: { fontWeight: 700, marginBottom: 2 } }, '💬 ' + cardAnalysis[arb.id].tip),
                    e('div', null, cardAnalysis[arb.id].reasoning)
                  )
                )
          )
        );
      })
    ),
    tab === 'calculator' && e('div', { style: st.section },
      !sel ? e('div', { style: { textAlign: 'center', padding: '40px 0' } },
        e('div', { style: { fontSize: 36, marginBottom: 10 } }, '📊'),
        e('div', { style: { fontSize: 14, fontWeight: 600, marginBottom: 6 } }, 'No opportunity selected'),
        e('div', { style: { fontSize: 13, color: C.muted, marginBottom: 16 } }, 'Go to Scanner and tap an arb first.'),
        e('button', { style: st.btn('primary'), onClick: () => setTab('scanner') }, '← Scanner')
      ) : e('div', null,
        e('div', { style: { ...st.card(false), cursor: 'default', marginBottom: 14 } },
          e('div', { style: st.cardRow },
            e('div', null, e('div', { style: st.sportLabel }, getSportInfo(sel.sport).emoji + ' ' + getSportInfo(sel.sport).label), e('div', { style: st.matchTitle }, sel.match)),
            e('span', { style: st.profitBadge(sel.margin) }, '+' + sel.margin.toFixed(1) + '%')
          )
        ),
        e('div', { style: { display: 'flex', gap: 8, marginBottom: 14 } },
          e('input', { type: 'number', value: stake, min: 10, step: 10, onChange: ev => setStake(Math.max(10, parseFloat(ev.target.value) || 100)), style: { ...st.input, flex: 1 } }),
          e('select', { value: currency, onChange: ev => setCurrency(ev.target.value), style: { ...st.input, width: 80 } },
            ['GHS', 'USD', 'NGN', 'EUR'].map(c => e('option', { key: c }, c))
          )
        ),
        e('div', { style: st.oddsGrid(sel.outcomes.length) },
          sel.outcomes.map((o, i) => e('div', { key: i, style: { ...st.oddsCell, border: '1px solid ' + C.border } },
            e('div', { style: { fontSize: 11, color: C.muted, marginBottom: 2 } }, o.label),
            e('div', { style: { fontSize: 11, color: C.muted, marginBottom: 3 } }, o.bookName + ' @ ' + o.odds.toFixed(2)),
            e('div', { style: { fontSize: 18, fontWeight: 700, color: C.text } }, currency + ' ' + calc.stakes[i].toFixed(2)),
            e('div', { style: { fontSize: 11, color: C.green } }, 'Returns ' + currency + ' ' + calc.returns[i].toFixed(2)),
            BOOKS[o.book] && BOOKS[o.book].momo && e('div', { style: { fontSize: 10, color: C.amber, marginTop: 3 } }, '📱 MoMo'),
            BOOKS[o.book] && BOOKS[o.book].licensed && e('div', { style: { fontSize: 10, color: C.green } }, '✓ GGC Licensed')
          ))
        ),
        e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid ' + C.border } },
          [['Staked', currency + ' ' + stake.toFixed(2), C.text], ['Return', currency + ' ' + calc.minReturn.toFixed(2), C.text], ['Profit', currency + ' ' + calc.profit.toFixed(2), C.green]].map(([l, v, c]) =>
            e('div', { key: l, style: { textAlign: 'center' } }, e('div', { style: { fontSize: 11, color: C.muted, marginBottom: 4 } }, l), e('div', { style: { fontSize: 16, fontWeight: 700, color: c } }, v))
          )
        ),
        e('div', { style: { background: C.amberLight, borderRadius: 8, padding: '10px 12px', marginTop: 12, fontSize: 12, color: '#78350f', lineHeight: 1.5 } }, '⚡ Place highest-odds leg first. You have seconds before odds change.'),
        e('button', { style: { ...st.btn('primary'), marginTop: 12 }, onClick: () => logBet(sel.outcomes) }, '📒 Log this bet')
      )
    ),
    tab === 'manual' && e('div', { style: st.section },
      e('div', { style: { background: C.purpleLight, border: '1px solid #c4b5fd', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: C.purple, lineHeight: 1.5 } },
        '✏️ Use this tab to manually enter odds from Betano, MSport, SportyBet or any book not in the scanner. Enter the best odds you see on each book and the app will calculate if there is an arb and exactly how much to stake.'
      ),
      e('div', { style: { display: 'flex', gap: 8, marginBottom: 12 } },
        e('input', { value: manualMeta.match, onChange: ev => setManualMeta(p => ({ ...p, match: ev.target.value })), placeholder: 'Match name (e.g. Man Utd vs Liverpool)', style: { ...st.input, flex: 1 } })
      ),
      e('div', { style: { display: 'flex', gap: 8, marginBottom: 14 } },
        e('input', { type: 'number', value: manualStake, min: 10, step: 10, onChange: ev => setManualStake(Math.max(10, parseFloat(ev.target.value) || 100)), style: { ...st.input, flex: 1 } }),
        e('select', { value: currency, onChange: ev => setCurrency(ev.target.value), style: { ...st.input, width: 80 } },
          ['GHS', 'USD', 'NGN', 'EUR'].map(c => e('option', { key: c }, c))
        )
      ),
      manualOutcomes.map((o, i) =>
        e('div', { key: i, style: { display: 'grid', gridTemplateColumns: '1fr 1fr 80px 36px', gap: 8, marginBottom: 8, alignItems: 'center' } },
          e('input', { value: o.label, onChange: ev => updateManualOutcome(i, 'label', ev.target.value), placeholder: 'Outcome', style: st.input }),
          e('select', { value: o.book, onChange: ev => updateManualOutcome(i, 'book', ev.target.value), style: st.input },
            Object.entries(BOOKS).map(([k, b]) => e('option', { key: k, value: k }, b.name))
          ),
          e('input', { type: 'number', value: o.odds, onChange: ev => updateManualOutcome(i, 'odds', ev.target.value), placeholder: 'Odds', step: '0.01', min: '1.01', style: st.input }),
          e('button', { onClick: () => removeManualOutcome(i), style: { ...st.btn('danger'), padding: '8px', fontSize: 14 } }, '✕')
        )
      ),
      e('div', { style: { display: 'flex', gap: 8, marginBottom: 14 } },
        e('button', { onClick: addManualOutcome, style: { ...st.btn('outline'), fontSize: 12 } }, '+ Add outcome'),
        e('button', { onClick: calcManual, style: { ...st.btn('primary'), flex: 1 } }, 'Calculate arb')
      ),
      manualResult && e('div', { style: { background: C.white, border: '2px solid ' + (manualResult.margin > 0 ? '#00d4aa' : C.border), borderRadius: 12, padding: 14 } },
        manualResult.margin > 0
          ? e('div', { style: { background: C.greenLight, color: C.greenDark, fontWeight: 700, fontSize: 14, padding: '8px 12px', borderRadius: 8, marginBottom: 12, textAlign: 'center' } }, '✅ ARB FOUND! +' + manualResult.margin.toFixed(2) + '% guaranteed profit')
          : e('div', { style: { background: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: 14, padding: '8px 12px', borderRadius: 8, marginBottom: 12, textAlign: 'center' } }, '❌ No arb — bookmaker margin is ' + Math.abs(manualResult.margin).toFixed(2) + '% against you'),
        e('div', { style: st.oddsGrid(manualResult.outcomes.length) },
          manualResult.outcomes.map((o, i) => e('div', { key: i, style: { ...st.oddsCell, border: '1px solid ' + C.border } },
            e('div', { style: { fontSize: 11, color: C.muted, marginBottom: 2 } }, o.label),
            e('div', { style: { fontSize: 12, fontWeight: 600, marginBottom: 2 } }, BOOKS[o.book]?.name || o.book),
            e('div', { style: { fontSize: 11, color: C.muted, marginBottom: 4 } }, 'Odds: ' + o.odds.toFixed(2)),
            e('div', { style: { fontSize: 17, fontWeight: 700, color: C.text } }, currency + ' ' + manualResult.stakes[i].toFixed(2)),
            e('div', { style: { fontSize: 11, color: C.green } }, 'Returns ' + currency + ' ' + manualResult.returns[i].toFixed(2)),
            BOOKS[o.book]?.momo && e('div', { style: { fontSize: 10, color: C.amber, marginTop: 3 } }, '📱 MoMo'),
            BOOKS[o.book]?.licensed && e('div', { style: { fontSize: 10, color: C.green } }, '✓ GGC Licensed')
          ))
        ),
        e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid ' + C.border } },
          [['Staked', currency + ' ' + manualStake.toFixed(2), C.text], ['Return', currency + ' ' + manualResult.minReturn.toFixed(2), C.text], ['Profit', currency + ' ' + manualResult.profit.toFixed(2), manualResult.profit > 0 ? C.green : '#dc2626']].map(([l, v, c]) =>
            e('div', { key: l, style: { textAlign: 'center' } }, e('div', { style: { fontSize: 11, color: C.muted, marginBottom: 4 } }, l), e('div', { style: { fontSize: 16, fontWeight: 700, color: c } }, v))
          )
        ),
        manualResult.margin > 0 && e('button', { style: { ...st.btn('primary'), marginTop: 12, width: '100%' }, onClick: () => { setSel({ id: 'manual_' + Date.now(), match: manualMeta.match || 'Manual Arb', sport: manualMeta.sport, margin: manualResult.margin, outcomes: manualResult.outcomes }); logBet(manualResult.outcomes, manualMeta.match || 'Manual Arb', manualMeta.sport, parseFloat(manualResult.profit.toFixed(2))); } }, '📒 Log this bet')
      )
    ),
    tab === 'ev' && e('div', { style: st.section },
      e('div', { style: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1e3a8a', lineHeight: 1.6 } },
        '📈 +EV bets are NOT guaranteed profit. They are bets where the bookmaker\'s odds exceed the true probability — profitable long-term over hundreds of bets. 🌍 Global uses Pinnacle/Betfair as reference. 🇬🇭 West Africa uses Pinnacle/Betfair as reference too — but only shows bets on WA-accessible books. 🎯 Draw Value shows only +EV Draw bets, badged with trailing draw rate (EPL, La Liga, Bundesliga, Serie A verified; Ligue 1 pending). 🔄 Rebounds flags teams whose longer-run form is stronger than their last 10 games — needs match-history data not yet wired in, so it will show nothing until that\'s populated.'
      ),
      // Region section toggle
      e('div', { style: { display: 'flex', gap: 6, marginBottom: 14 } },
        [['global','🌍 Global'], ['wa','🇬🇭 West Africa']].map(([k,l]) =>
          e('button', { key: k, onClick: () => setEvSection(k), style: { ...st.btn(evSection === k ? 'primary' : 'outline'), fontSize: 12, padding: '7px 14px' } }, l)
        )
      ),
      // Reference book info banner
      e('div', { style: { background: evSection === 'wa' ? '#dcfce7' : '#eff6ff', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: evSection === 'wa' ? C.greenDark : '#1e3a8a' } },
        evSection === 'wa'
          ? '🇬🇭 Using Pinnacle / Betfair as sharp reference — showing only WA-accessible books (Betway, SportyBet, Betano, MSport, 1xBet, MelBet)'
          : '🌍 Using Pinnacle / Betfair as sharp reference — showing all books globally'
      ),
      e('div', { style: st.metricsGrid },
        [
          ['+EV found', (evSection === 'wa' ? evWA : evBets).filter(b => evFilter === 'all' || b.sport === evFilter).length, null],
          ['Best EV', (evSection === 'wa' ? evWA : evBets)[0] ? '+' + (evSection === 'wa' ? evWA : evBets)[0].ev_pct.toFixed(1) + '%' : '—', C.blue],
          ['Avg EV', (evSection === 'wa' ? evWA : evBets).length > 0 ? '+' + ((evSection === 'wa' ? evWA : evBets).reduce((s,b) => s + b.ev_pct, 0) / (evSection === 'wa' ? evWA : evBets).length).toFixed(1) + '%' : '—', C.blue],
          ['Mode', isDemoEV ? 'Demo' : 'Live', isDemoEV ? C.amber : C.green],
        ].map(([l, v, c]) => e('div', { key: l, style: st.metric }, e('div', { style: st.metricLabel }, l), e('div', { style: st.metricVal(c) }, v)))
      ),
      e('div', { style: { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' } },
        e('select', { value: evFilter, onChange: ev => setEvFilter(ev.target.value), style: { ...st.input, width: 'auto', fontSize: 12, padding: '6px 10px' } },
          e('option', { value: 'all' }, 'All sports'),
          SPORT_GROUPS.map(g => e('option', { key: g.group, value: g.group }, g.group))
        ),
        e('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          e('span', { style: { fontSize: 12, color: C.muted } }, 'Min EV:'),
          e('input', { type: 'range', min: 0, max: 10, step: 0.5, value: minEV, onChange: ev => setMinEV(parseFloat(ev.target.value)), style: { width: 70 } }),
          e('span', { style: { fontSize: 12, fontWeight: 600, minWidth: 36 } }, '+' + minEV + '%')
        ),
        e('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          e('span', { style: { fontSize: 12, color: C.muted } }, 'Bankroll:'),
          e('input', { type: 'number', value: evStake, min: 50, step: 50, onChange: ev => setEvStake(Math.max(50, parseFloat(ev.target.value) || 500)), style: { ...st.input, width: 100 } })
        ),
        e('button', {
          onClick: () => setDrawOnly(d => !d),
          style: { ...st.btn(drawOnly ? 'primary' : 'outline'), fontSize: 12, padding: '7px 12px' }
        }, '🎯 Draw Value'),
        e('button', {
          onClick: () => setReboundOnly(r => !r),
          style: { ...st.btn(reboundOnly ? 'primary' : 'outline'), fontSize: 12, padding: '7px 12px' }
        }, '🔄 Rebounds'),
      ),
      (() => {
        const activeBets = (evSection === 'wa' ? evWA : evBets)
          .filter(b => (evFilter === 'all' || b.sport === evFilter))
          .filter(b => !drawOnly || b.isDraw)
          .filter(b => !reboundOnly || (b.formContext && b.formContext.isRebound));
        if (activeBets.length === 0) return e('div', { style: { textAlign: 'center', padding: '40px 16px', color: C.muted } },
          e('div', { style: { fontSize: 28, marginBottom: 10 } }, isDemoEV ? '📡' : drawOnly ? '🎯' : reboundOnly ? '🔄' : '✅'),
          e('div', { style: { fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 } },
            isDemoEV ? 'Scan failed — showing demo data' : drawOnly ? 'No +EV draws right now' : reboundOnly ? 'No rebound-signal bets right now' : 'No +EV opportunities right now'
          ),
          e('div', { style: { fontSize: 12, lineHeight: 1.6 } },
            isDemoEV
              ? 'The odds API could not be reached. Check your API key or connection.'
              : evSection === 'wa'
                ? 'Scan completed successfully. No WA-accessible bets cleared the +EV threshold. Most likely cause: off-season (European leagues restart August). Try lowering Min EV or switching to Global.'
                : 'Scan completed successfully — odds data loaded but no edges found at this threshold. Most likely cause: off-season. European leagues restart August 15–22. Try cricket or MMA in the scanner for active markets.'
          )
        );
        return e('div', null, activeBets.map(bet => {
          const kelly = kellyCriterion(bet.odds, bet.trueProb);
          const kellyStake = parseFloat((kelly / 100 * evStake).toFixed(2));
          const expectedProfit = parseFloat(((bet.odds * bet.trueProb / 100 - 1) * kellyStake).toFixed(2));
          const info = getSportInfo(bet.sport);
          return e('div', { key: bet.id, style: { ...st.card(false, isDemoEV), cursor: 'default' } },
            e('div', { style: st.cardRow },
              e('div', null,
                e('div', { style: st.sportLabel }, info.emoji + ' ' + info.label + ' · ⏱ ' + timeUntil(bet.commenceTime)),
                e('div', { style: st.matchTitle }, bet.match),
                e('div', { style: { fontSize: 13, color: C.text, marginTop: 3 } },
                  e('span', { style: { fontWeight: 700 } }, bet.outcome),
                  e('span', { style: { color: C.muted } }, ' · ' + bet.bookName),
                  bet._wa && e('span', { style: { marginLeft: 6, fontSize: 11, background: C.greenLight, color: C.greenDark, padding: '1px 6px', borderRadius: 10 } }, '🇬🇭 WA'),
                  bet.sharpBookCount > 1 && e('span', { style: { marginLeft: 6, fontSize: 11, background: '#ede9fe', color: '#6d28d9', padding: '1px 6px', borderRadius: 10 } }, '🎯 ' + bet.sharpBookCount + '-book consensus'),
                  bet.isDraw && bet.drawContext && e('span', {
                    style: { marginLeft: 6, fontSize: 11, background: '#fef3c7', color: '#78350f', padding: '1px 6px', borderRadius: 10 },
                    title: (bet.drawContext.home ? bet.drawContext.home.draws + '/' + bet.drawContext.home.played + ' home team draws' : '') +
                           (bet.drawContext.away ? ' · ' + bet.drawContext.away.draws + '/' + bet.drawContext.away.played + ' away team draws' : '')
                  }, '🤝 ' + (bet.drawContext.avgRate * 100).toFixed(0) + '% draw rate (' + bet.drawContext.season + ')'),
                  bet.formContext && bet.formContext.isRebound && e('span', {
                    style: { marginLeft: 6, fontSize: 11, background: '#dbeafe', color: '#1e3a8a', padding: '1px 6px', borderRadius: 10 },
                    title: 'Baseline ' + bet.formContext.baselinePPG + ' PPG vs recent ' + bet.formContext.recentPPG + ' PPG over last ' + FORM_RECENT_WINDOW + ' games — market may still be pricing off the slump'
                  }, '🔄 rebound signal (+' + bet.formContext.divergence + ' PPG)')
                )
              ),
              e('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 } },
                isDemoEV && e('span', { style: st.badge('#451a03', '#fcd34d') }, 'DEMO'),
                e('span', { style: { background: '#eff6ff', color: '#1e40af', fontSize: 13, fontWeight: 700, padding: '4px 11px', borderRadius: 20 } }, '+' + bet.ev_pct.toFixed(1) + '% EV')
              )
            ),
            e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 4 } },
              [
                ['Your odds', bet.odds.toFixed(2), C.green],
                ['Fair odds', bet.fairOdds.toFixed(2), C.muted],
                ['True prob', bet.trueProb.toFixed(1) + '%', C.blue],
                ['Edge', '+' + bet.ev_pct.toFixed(1) + '%', '#1d4ed8'],
              ].map(([l, v, c]) =>
                e('div', { key: l, style: st.oddsCell },
                  e('div', { style: { fontSize: 10, color: C.muted, marginBottom: 3 } }, l),
                  e('div', { style: { fontSize: 14, fontWeight: 700, color: c } }, v)
                )
              )
            ),
            e('div', { style: { background: '#eff6ff', borderRadius: 8, padding: '10px 12px', marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 } },
              [
                ['¼ Kelly %', kelly.toFixed(1) + '%', C.text],
                ['Suggested stake', currency + ' ' + kellyStake.toFixed(2), C.text],
                ['Expected profit', currency + ' ' + expectedProfit.toFixed(2), C.blue],
              ].map(([l, v, c]) =>
                e('div', { key: l, style: { textAlign: 'center' } },
                  e('div', { style: { fontSize: 10, color: C.muted, marginBottom: 3 } }, l),
                  e('div', { style: { fontSize: 14, fontWeight: 700, color: c } }, v)
                )
              )
            ),
          e('div', { style: { fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.4 } },
            '⚠️ +EV is a long-run strategy. Any single bet can lose. The edge only shows over 100s of bets.'
          ),
          e('button', { onClick: () => logEVBet(bet, kellyStake, expectedProfit), style: { ...st.btn('success'), marginTop: 8, width: '100%', fontSize: 12 } }, '📒 Log This Bet')
        );
      }));
    })()
    ),
    tab === 'edge' && e('div', { style: st.section },
      // ── TEMP: on-screen WA debug panel (no dev tools needed) ───────────────
      waDebug && e('div', { style: { background: '#1f2937', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 11, color: '#e5e7eb', lineHeight: 1.6, fontFamily: 'monospace' } },
        e('div', { style: { fontWeight: 700, color: '#6ee7b7', marginBottom: 6 } }, '🔎 WA DEBUG (run a scan to refresh)'),
        e('div', null, 'Total events: ' + waDebug.totalEvents),
        e('div', null, 'Events with 2+ accessible books: ' + waDebug.eventsWith2PlusAccessible),
        e('div', null, 'bestOddsWA results: ' + waDebug.bestOddsWACount + ' | middlesWA results: ' + waDebug.middlesWACount),
        e('div', { style: { marginTop: 6, color: '#fcd34d' } }, 'Accessible keys seen: ' + (waDebug.accessibleSeen.join(', ') || '(none)')),
        e('div', { style: { marginTop: 4, color: '#fca5a5' } }, 'Unknown keys (not in BOOKS): ' + (waDebug.unknownKeys.join(', ') || '(none)')),
        e('div', { style: { marginTop: 6, color: '#9ca3af' } }, 'All key counts: ' + JSON.stringify(waDebug.keyCounts))
      ),
      // Sub-tab nav
      e('div', { style: { display: 'flex', gap: 6, marginBottom: 14 } },
        [['lineshop', '🛒 Line Shopping'], ['middle', '↔ Middles'], ['steam', '💨 Steam']].map(([k, l]) =>
          e('button', { key: k, onClick: () => setEdgeTab(k), style: { ...st.btn(edgeTab === k ? 'primary' : 'outline'), fontSize: 12, padding: '6px 12px' } }, l)
        )
      ),

      // ── LINE SHOPPING ──
      edgeTab === 'lineshop' && e('div', null,
        e('div', { style: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1e3a8a', lineHeight: 1.6 } },
          '🛒 Line shopping shows the best available price for every outcome across all scanned bookmakers. Always bet at the highest odds available — even a 5% improvement in odds over hundreds of bets is the difference between losing and profiting.'
        ),
        // Region section toggle
        e('div', { style: { display: 'flex', gap: 6, marginBottom: 10 } },
          [['global','🌍 Global'], ['wa','🇬🇭 West Africa']].map(([k,l]) =>
            e('button', { key: k, onClick: () => setLineshopSection(k), style: { ...st.btn(lineshopSection === k ? 'primary' : 'outline'), fontSize: 12, padding: '7px 14px' } }, l)
          )
        ),
        e('div', { style: { background: lineshopSection === 'wa' ? '#dcfce7' : '#eff6ff', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: lineshopSection === 'wa' ? C.greenDark : '#1e3a8a' } },
          lineshopSection === 'wa'
            ? '🇬🇭 Comparing only books accessible in West Africa (Betway, SportyBet, Betano, MSport, MelBet, 1xBet) — gaps shown are bets you can actually place.'
            : '🌍 Comparing all scanned books worldwide, including books not accessible from West Africa.'
        ),
        (() => {
          const activeOdds = lineshopSection === 'wa' ? bestOddsWA : bestOdds;
          if (activeOdds.length === 0) return e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } },
            e('div', { style: { fontSize: 32, marginBottom: 8 } }, '🛒'),
            e('div', { style: { fontSize: 14 } },
              lineshopSection === 'wa'
                ? 'No West Africa price gaps found yet. Run a scan, or odds may be aligned across WA books right now.'
                : 'Run a scan first to see best available odds.'
            )
          );
          return activeOdds.map(ev => {
          const info = getSportInfo(ev.sport);
          return e('div', { key: ev.id, style: { ...st.card(false), cursor: 'default', marginBottom: 12 } },
            e('div', { style: { marginBottom: 8 } },
              e('div', { style: st.sportLabel }, info.emoji + ' ' + info.label + ' · ⏱ ' + timeUntil(ev.commenceTime)),
              e('div', { style: st.matchTitle }, ev.match),
              e('div', { style: { fontSize: 11, color: C.muted, marginTop: 2 } }, 'Max gap: up to ' + ev.maxGap.toFixed(1) + '% better odds available')
            ),
            ev.outcomes.map(o => {
              const bestAccessible = o.all.find(bk => isBookAccessible(bk.book, userRegion));
              return e('div', { key: o.name, style: { marginBottom: 10 } },
                e('div', { style: { fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 } }, o.name),
                bestAccessible && bestAccessible.book !== o.all[0].book &&
                  e('div', { style: { fontSize: 11, color: C.greenDark, background: C.greenLight, borderRadius: 6, padding: '4px 8px', marginBottom: 4 } }, '✓ Best you can actually place: ' + bestAccessible.bookName + ' @ ' + bestAccessible.odds.toFixed(2)),
                e('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                  o.all.map((bk, idx) => {
                    const accessible = isBookAccessible(bk.book, userRegion);
                    return e('div', { key: bk.book, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: 8, background: idx === 0 ? C.greenLight : C.grayLight, opacity: accessible ? 1 : 0.55 } },
                      e('span', { style: { fontSize: 12, color: idx === 0 ? C.greenDark : C.muted } }, bk.bookName + (accessible ? '' : ' 🚫')),
                      e('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                        e('span', { style: { fontSize: 14, fontWeight: 700, color: idx === 0 ? C.green : C.text } }, bk.odds.toFixed(2)),
                        idx === 0 && o.gap > 0 && e('span', { style: { fontSize: 11, fontWeight: 700, color: C.greenDark, background: C.greenLight, padding: '1px 6px', borderRadius: 10 } }, '★ Best'),
                        idx === o.all.length - 1 && o.gap > 0 && e('span', { style: { fontSize: 10, color: '#dc2626' } }, '-' + o.gap.toFixed(1) + '%')
                      )
                    );
                  })
                )
              );
            })
          );
        });
        })()
      ),

      // ── MIDDLE BETTING ──
      edgeTab === 'middle' && e('div', null,
        e('div', { style: { background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#6b21a8', lineHeight: 1.6 } },
          '↔ A middle is when two books offer different spread/total lines on the same game — creating a window of scores where BOTH your bets win. You always collect at least one bet; the aim is occasionally hitting the middle and winning both. Best on NBA, NFL, NFL totals.'
        ),
        // Region section toggle
        e('div', { style: { display: 'flex', gap: 6, marginBottom: 10 } },
          [['global','🌍 Global'], ['wa','🇬🇭 West Africa']].map(([k,l]) =>
            e('button', { key: k, onClick: () => setMiddleSection(k), style: { ...st.btn(middleSection === k ? 'primary' : 'outline'), fontSize: 12, padding: '7px 14px' } }, l)
          )
        ),
        e('div', { style: { background: middleSection === 'wa' ? '#dcfce7' : '#fdf4ff', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: middleSection === 'wa' ? C.greenDark : '#6b21a8' } },
          middleSection === 'wa'
            ? '🇬🇭 Both legs must be on books accessible in West Africa (Betway, SportyBet, Betano, MSport, MelBet, 1xBet) — every middle shown here is placeable.'
            : '🌍 Showing middles across all scanned books worldwide, including books not accessible from West Africa.'
        ),
        (() => {
          const activeMiddles = middleSection === 'wa' ? middlesWA : middles;
          if (activeMiddles.length === 0) return e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } },
            e('div', { style: { fontSize: 32, marginBottom: 8 } }, '↔'),
            e('div', { style: { fontSize: 14 } },
              middleSection === 'wa'
                ? 'No West Africa middles found yet. Run a scan — these need a price gap between two WA-accessible books.'
                : 'No middles found yet. Run a scan — middles appear most often in NBA and NFL spreads/totals.'
            )
          );
          return activeMiddles.map(m => {
          const info = getSportInfo(m.sport);
          const overround = ((m.implied - 1) * 100).toFixed(1);
          return e('div', { key: m.id, style: { background: C.white, border: '1px solid ' + (m.isArb ? C.green : '#e9d5ff'), borderRadius: 12, padding: '13px 14px', marginBottom: 10 } },
            e('div', { style: st.cardRow },
              e('div', null,
                e('div', { style: st.sportLabel }, info.emoji + ' ' + info.label + ' · ⏱ ' + timeUntil(m.commenceTime)),
                e('div', { style: st.matchTitle }, m.match),
                e('div', { style: { fontSize: 12, color: C.muted, marginTop: 2 } }, m.type + ' · ' + m.team)
              ),
              e('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 } },
                e('span', { style: { background: m.isArb ? C.greenLight : '#fdf4ff', color: m.isArb ? C.greenDark : '#7c3aed', fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 16 } }, m.isArb ? '⚡ Arb+Middle' : '↔ ' + m.window + ' pt window'),
                e('span', { style: { fontSize: 11, color: C.muted } }, m.isArb ? 'Guaranteed profit + middle chance' : (parseFloat(overround) > 0 ? 'Cost: ' + overround + '% overround' : 'Near break-even'))
              )
            ),
            e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 } },
              [m.legA, m.legB].map((leg, i) => {
                const accessible = isBookAccessible(leg.book, userRegion);
                return e('div', { key: i, style: { background: C.grayLight, borderRadius: 8, padding: '8px 10px', opacity: accessible ? 1 : 0.55 } },
                  e('div', { style: { fontSize: 11, color: C.muted, marginBottom: 3 } }, 'Leg ' + (i + 1)),
                  e('div', { style: { fontSize: 13, fontWeight: 700 } }, leg.bookName + (accessible ? '' : ' 🚫')),
                  !accessible && e('div', { style: { fontSize: 10, fontWeight: 700, color: '#b91c1c' } }, 'Not accessible'),
                  e('div', { style: { fontSize: 12, color: C.muted } }, leg.side),
                  e('div', { style: { fontSize: 15, fontWeight: 700, color: C.green, marginTop: 2 } }, leg.odds.toFixed(2))
                );
              })
            ),
            e('div', { style: { background: '#fdf4ff', borderRadius: 8, padding: '8px 10px', marginTop: 8, fontSize: 12, color: '#6b21a8' } },
              '💡 If the final margin falls between ' + Math.abs(m.legA.line) + ' and ' + Math.abs(m.legB.line) + ', both legs win. Otherwise one leg wins, one loses.'
            )
          );
        });
        })()
      ),

      // ── STEAM CHASING ──
      edgeTab === 'steam' && e('div', null,
        e('div', { style: { background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400e', lineHeight: 1.6 } },
          '💨 Steam moves are when sharp books (Pinnacle/Betfair) sharply shorten a line — indicating professional money has come in. Soft books that haven\'t updated yet represent the value. Steam is detected by comparing each scan to the previous one.'
        ),
        steam.length === 0 && e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } },
          e('div', { style: { fontSize: 32, marginBottom: 8 } }, '💨'),
          e('div', { style: { fontSize: 14 } }, steam.length === 0 && prevEventsRef.current.length === 0 ? 'Steam needs two scans to compare. Run a second scan after 12 minutes.' : 'No significant line moves detected in the last scan.')
        ),
        steam.map(s => {
          const info = getSportInfo(s.sport);
          const isShortening = s.move < 0;
          return e('div', { key: s.id, style: { background: C.white, border: '1px solid #fed7aa', borderRadius: 12, padding: '13px 14px', marginBottom: 10 } },
            e('div', { style: st.cardRow },
              e('div', null,
                e('div', { style: st.sportLabel }, info.emoji + ' ' + info.label + ' · ⏱ ' + timeUntil(s.commenceTime)),
                e('div', { style: st.matchTitle }, s.match),
                e('div', { style: { fontSize: 13, fontWeight: 600, color: C.text, marginTop: 2 } }, s.outcome)
              ),
              e('div', { style: { textAlign: 'right', flexShrink: 0 } },
                e('div', { style: { fontSize: 14, fontWeight: 700, color: isShortening ? '#dc2626' : C.green } }, (s.move > 0 ? '+' : '') + s.move + '%'),
                e('div', { style: { fontSize: 11, color: C.muted } }, isShortening ? '🔴 Sharp money in' : '🟢 Drifting out')
              )
            ),
            e('div', { style: { display: 'flex', gap: 8, marginTop: 8, marginBottom: 8, alignItems: 'center' } },
              e('div', { style: { background: C.grayLight, borderRadius: 8, padding: '6px 10px', fontSize: 12 } },
                e('div', { style: { color: C.muted, fontSize: 11 } }, 'Pinnacle was'),
                e('div', { style: { fontWeight: 700 } }, s.prevPinnOdds.toFixed(2))
              ),
              e('span', { style: { fontSize: 18, color: C.muted } }, '→'),
              e('div', { style: { background: isShortening ? '#fef2f2' : C.greenLight, borderRadius: 8, padding: '6px 10px', fontSize: 12 } },
                e('div', { style: { color: C.muted, fontSize: 11 } }, 'Pinnacle now'),
                e('div', { style: { fontWeight: 700, color: isShortening ? '#dc2626' : C.green } }, s.currPinnOdds.toFixed(2))
              )
            ),
            e('div', { style: { fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 } }, '📖 Lagging soft books (act fast):'),
            s.laggingBooks.map(bk => {
              const accessible = isBookAccessible(bk.book, userRegion);
              return e('div', { key: bk.book, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff7ed', borderRadius: 8, padding: '6px 10px', marginBottom: 4, opacity: accessible ? 1 : 0.55 } },
                e('span', { style: { fontSize: 13, fontWeight: 600 } }, bk.bookName + (accessible ? '' : ' 🚫')),
                e('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } },
                  e('span', { style: { fontSize: 14, fontWeight: 700, color: C.green } }, bk.odds.toFixed(2)),
                  e('span', { style: { fontSize: 11, color: C.muted } }, 'was ' + bk.prevOdds.toFixed(2))
                )
              );
            }),
            e('div', { style: { background: '#fff7ed', borderRadius: 8, padding: '6px 10px', marginTop: 6, fontSize: 11, color: '#92400e' } },
              '⚡ Place this bet before ' + s.laggingBooks.map(b => b.bookName).join('/') + ' update their lines.'
            )
          );
        })
      )
    ),
    tab === 'analyzer' && e('div', { style: st.section },
      e('div', { style: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1e3a8a', lineHeight: 1.6 } },
        '🧠 Select any upcoming game from your scanned sports and get a deep AI analysis — form, H2H, goals stats, player availability, news, and a betting prediction.'
      ),
      e('div', { style: { display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' } },
        e('select', { value: analyzerSportFilter, onChange: ev => setAnalyzerSportFilter(ev.target.value), style: { ...st.input, width: 'auto', fontSize: 12, padding: '6px 10px' } },
          e('option', { value: 'all' }, 'All sports'),
          SPORT_GROUPS.map(g => e('option', { key: g.group, value: g.group }, g.group))
        ),
        e('button', {
          onClick: async () => {
            setAnalyzerLoading(true);
            try {
              const sportsParam = ALL_SPORTS.filter(s => {
                if (analyzerSportFilter === 'all') return true;
                const g = SPORT_GROUPS.find(g => g.group === analyzerSportFilter);
                return g && g.sports.some(sp => sp.key === s.key);
              }).map(s => s.key).join(',');
              const res = await fetch('/api/fixtures?sports=' + sportsParam);
              if (res.ok) {
                const json = await res.json();
                setAnalyzerGames(json.fixtures || []);
              } else {
                setAnalyzerGames([]);
              }
            } catch (err) {
              setAnalyzerGames([]);
            }
            setAnalyzerLoaded(true);
            setAnalyzerLoading(false);
          },
          disabled: analyzerLoading,
          style: { ...st.btn('primary'), fontSize: 12 }
        }, analyzerLoading ? '⟳ Loading...' : '🔍 Load Games')
      ),
      !analyzerLoaded && !analyzerLoading && e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } },
        e('div', { style: { fontSize: 36, marginBottom: 8 } }, '🧠'),
        e('div', { style: { fontSize: 14, fontWeight: 600, marginBottom: 4 } }, 'Bet Analyzer'),
        e('div', { style: { fontSize: 13 } }, 'Tap Load Games to fetch upcoming matches from your selected sports.')
      ),
      analyzerLoading && e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } },
        e('div', { style: { fontSize: 36, marginBottom: 8 } }, '⟳'),
        e('div', { style: { fontSize: 14 } }, 'Loading games...')
      ),
      analyzerLoaded && analyzerGames.length === 0 && e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } },
        e('div', { style: { fontSize: 14 } }, 'No upcoming games found. Try selecting more sports or check your API key.')
      ),
      analyzerGames
        .filter(g => {
          if (analyzerSportFilter === 'all') return true;
          const grp = SPORT_GROUPS.find(g2 => g2.group === analyzerSportFilter);
          return grp && grp.sports.some(s => s.key === g.sport);
        })
        .map(game => {
          const info = getSportInfo(game.sport);
          const analysis = gameAnalyses[game.id];
          return e('div', { key: game.id, style: { background: C.white, borderRadius: 12, padding: '13px 14px', marginBottom: 10, border: '1px solid ' + C.border } },
            e('div', { style: st.cardRow },
              e('div', null,
                e('div', { style: st.sportLabel }, info.emoji + ' ' + (game.league || info.label) + ' · ⏱ ' + timeUntil(game.commenceTime)),
                e('div', { style: st.matchTitle }, game.match),
                game.venue && e('div', { style: { fontSize: 11, color: C.muted, marginTop: 2 } }, '📍 ' + game.venue)
              ),
              e('button', {
                onClick: async () => {
                  if (analyzingGameId === game.id) return;
                  setAnalyzingGameId(game.id);
                  try {
                    const outcomes = [
                      { label: game.homeTeam, odds: 0, bookName: 'Check bookmakers' },
                      { label: 'Draw', odds: 0, bookName: 'Check bookmakers' },
                      { label: game.awayTeam, odds: 0, bookName: 'Check bookmakers' },
                    ];
                    const res = await fetch('/api/analyze', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        match: game.match,
                        sport: game.league || getSportInfo(game.sport).label,
                        outcomes,
                        margin: 0,
                        marketType: 'Match Winner',
                        venue: game.venue || '',
                        includeNews: true,
                      })
                    });
                    const data = await res.json();
                    setGameAnalyses(p => ({ ...p, [game.id]: data }));
                  } catch (err) {
                    setGameAnalyses(p => ({ ...p, [game.id]: { error: 'Analysis failed: ' + err.message } }));
                  }
                  setAnalyzingGameId(null);
                },
                disabled: analyzingGameId === game.id,
                style: { ...st.btn('primary'), fontSize: 12, padding: '7px 12px' }
              }, analyzingGameId === game.id ? '⟳ Analyzing...' : '🧠 Analyze')
            ),
            analysis && e('div', { style: { marginTop: 10 } },
              analysis.error
                ? e('div', { style: { color: '#dc2626', fontSize: 12 } }, '⚠️ ' + analysis.error)
                : e('div', { style: { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', fontSize: 12 } },
                    e('div', { style: { fontWeight: 700, fontSize: 13, color: C.greenDark, marginBottom: 10 } }, '🤖 AI Analysis — ' + game.match),
                    e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 } },
                      e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Predicted'), e('div', { style: { fontWeight: 700, color: C.text } }, analysis.predictedOutcome || '—')),
                      e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Confidence'), e('div', { style: { fontWeight: 700, color: C.blue } }, (analysis.confidence || '—') + '%')),
                      e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Risk'), e('div', { style: { fontWeight: 700, color: C.amber } }, analysis.riskLevel || '—')),
                      e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Best Value'), e('div', { style: { fontWeight: 700, color: C.green } }, analysis.valueLeg || '—'))
                    ),
                    analysis.form && e('div', { style: { background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 8 } },
                      e('div', { style: { fontWeight: 700, fontSize: 11, color: C.muted, marginBottom: 6 } }, '📊 RECENT FORM'),
                      e('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 } },
                        e('span', { style: { fontSize: 11, color: C.muted } }, game.homeTeam + ':'),
                        e('span', { style: { fontWeight: 700, letterSpacing: 2 } }, analysis.form.home)
                      ),
                      e('div', { style: { display: 'flex', justifyContent: 'space-between' } },
                        e('span', { style: { fontSize: 11, color: C.muted } }, game.awayTeam + ':'),
                        e('span', { style: { fontWeight: 700, letterSpacing: 2 } }, analysis.form.away)
                      )
                    ),
                    analysis.goalsAvg && e('div', { style: { background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 8 } },
                      e('div', { style: { fontWeight: 700, fontSize: 11, color: C.muted, marginBottom: 6 } }, '⚽ GOALS STATS (per 90)'),
                      e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 } },
                        e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Home scored'), e('div', { style: { fontWeight: 700, color: C.green } }, analysis.goalsAvg.homeScoredPer90)),
                        e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Home conceded'), e('div', { style: { fontWeight: 700, color: '#dc2626' } }, analysis.goalsAvg.homeConceededPer90)),
                        e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Away scored'), e('div', { style: { fontWeight: 700, color: C.green } }, analysis.goalsAvg.awayScoredPer90)),
                        e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Away conceded'), e('div', { style: { fontWeight: 700, color: '#dc2626' } }, analysis.goalsAvg.awayConceededPer90))
                      )
                    ),
                    analysis.h2h && e('div', { style: { background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 12, color: C.text } },
                      e('div', { style: { fontWeight: 700, fontSize: 11, color: C.muted, marginBottom: 4 } }, '🔁 HEAD TO HEAD'),
                      e('div', null, analysis.h2h)
                    ),
                    analysis.additionalBets && e('div', { style: { marginBottom: 8 } },
                      e('div', { style: { fontWeight: 700, fontSize: 11, color: C.muted, marginBottom: 6 } }, '💡 ADDITIONAL MARKETS'),
                      analysis.additionalBets.map((bet, i) =>
                        e('div', { key: i, style: { background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 6 } },
                          e('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 3 } },
                            e('span', { style: { fontWeight: 700, color: C.text } }, bet.market),
                            e('span', { style: { background: C.greenLight, color: C.greenDark, fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 12 } }, bet.recommendation + ' · ' + bet.confidence + '%')
                          ),
                          e('div', { style: { fontSize: 11, color: C.muted } }, bet.reasoning)
                        )
                      )
                    ),
                    analysis.playerNews && e('div', { style: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 12 } },
                      e('div', { style: { fontWeight: 700, fontSize: 11, color: '#dc2626', marginBottom: 4 } }, '🚑 PLAYER NEWS & INJURIES'),
                      e('div', { style: { color: C.text, lineHeight: 1.5 } }, analysis.playerNews)
                    ),
                    analysis.keyInsight && e('div', { style: { background: C.blueLight, border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 12 } },
                      e('div', { style: { fontWeight: 700, fontSize: 11, color: C.blue, marginBottom: 4 } }, '🔑 KEY INSIGHT'),
                      e('div', { style: { color: C.text, lineHeight: 1.5 } }, analysis.keyInsight)
                    ),
                    analysis.tip && e('div', { style: { background: C.amberLight, borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#78350f' } },
                      e('div', { style: { fontWeight: 700, marginBottom: 2 } }, '💬 ' + analysis.tip),
                      analysis.reasoning && e('div', null, analysis.reasoning)
                    )
                  )
            )
          );
        })
    ),
    tab === 'tracker' && e('div', { style: st.section }, (() => {
      const wonBets = bets.filter(b => b.status === 'won');
      const lostBets = bets.filter(b => b.status === 'lost');
      const settledBets = bets.filter(b => b.status !== 'pending');
      const realProfit = wonBets.reduce((s, b) => s + b.profit, 0) - lostBets.reduce((s, b) => s + b.stake, 0);
      const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
      const roi = totalStaked > 0 ? ((realProfit / totalStaked) * 100).toFixed(1) : '0.0';
      const winRate = settledBets.length > 0 ? ((wonBets.length / settledBets.length) * 100).toFixed(0) : '—';

      // Streak
      const settled = [...bets].filter(b => b.status !== 'pending').reverse();
      let streak = 0, streakType = '';
      for (const b of settled) { if (streak === 0) { streakType = b.status; streak = 1; } else if (b.status === streakType) streak++; else break; }
      const streakLabel = streak > 0 ? (streakType === 'won' ? '🔥 ' + streak + 'W streak' : '❄️ ' + streak + 'L streak') : '—';

      // By sport
      const bySport = {};
      bets.forEach(b => { if (!bySport[b.sport]) bySport[b.sport] = { staked: 0, profit: 0, count: 0, won: 0 }; bySport[b.sport].count++; if (b.status === 'won') { bySport[b.sport].profit += b.profit; bySport[b.sport].won++; } if (b.status === 'lost') bySport[b.sport].profit -= b.stake; bySport[b.sport].staked += b.stake; });
      const topSport = Object.entries(bySport).sort((a, b) => b[1].profit - a[1].profit)[0];

      // By book
      const byBook = {};
      bets.forEach(b => (b.outcomes || []).forEach(o => { const bk = o.bookName || o.book || 'Unknown'; if (!byBook[bk]) byBook[bk] = { staked: 0, profit: 0, count: 0 }; byBook[bk].count++; byBook[bk].staked += b.stake; if (b.status === 'won') byBook[bk].profit += b.profit; if (b.status === 'lost') byBook[bk].profit -= b.stake; }));

      // Average odds taken
      const oddsList = bets.flatMap(b => (b.outcomes || []).map(o => o.odds)).filter(o => o > 0);
      const avgOdds = oddsList.length > 0 ? (oddsList.reduce((s, o) => s + o, 0) / oddsList.length).toFixed(2) : '—';

      // Monthly trends (grouped by calendar month of bet.date)
      const byMonth = {};
      bets.forEach(b => {
        const m = new Date(b.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        if (!byMonth[m]) byMonth[m] = { staked: 0, profit: 0, count: 0 };
        byMonth[m].count++; byMonth[m].staked += b.stake;
        if (b.status === 'won') byMonth[m].profit += b.profit;
        if (b.status === 'lost') byMonth[m].profit -= b.stake;
      });
      const monthOrder = Object.keys(byMonth).sort((a, b) => new Date(a) - new Date(b));

      // By type
      const byType = { arb: { count: 0, profit: 0, staked: 0 }, ev: { count: 0, profit: 0, staked: 0 }, manual: { count: 0, profit: 0, staked: 0 } };
      bets.forEach(b => { const t = b.type || 'arb'; if (!byType[t]) byType[t] = { count: 0, profit: 0, staked: 0 }; byType[t].count++; byType[t].staked += b.stake; if (b.status === 'won') byType[t].profit += b.profit; if (b.status === 'lost') byType[t].profit -= b.stake; });

      // CLV helper — prefers the auto-captured closing line (persisted on the bet
      // itself); falls back to a manually-typed value for bets where auto-capture
      // hasn't run yet (e.g. added after the match already started).
      const clvBet = (bet) => {
        const closing = bet.clvOdds != null ? bet.clvOdds : parseFloat(clvInputs[bet.id]);
        if (!closing || !bet.placedOdds) return null;
        return ((bet.placedOdds / closing - 1) * 100).toFixed(1);
      };

      // Bankroll curve (cumulative)
      const curve = [bankroll];
      [...bets].reverse().forEach(b => { const last = curve[curve.length - 1]; if (b.status === 'won') curve.push(last + b.profit); else if (b.status === 'lost') curve.push(last - b.stake); else curve.push(last); });

      // CSV export
      const exportCSV = () => {
        const rows = [['Date','Match','Sport','Type','Stake','Currency','Status','Profit/Loss','ROI%','CLV']];
        bets.forEach(b => { const clv = clvBet(b); rows.push([new Date(b.date).toLocaleDateString(), b.match, getSportInfo(b.sport).label, b.type || 'arb', b.stake, b.currency, b.status, b.status === 'won' ? b.profit : b.status === 'lost' ? -b.stake : '', b.stake > 0 ? ((( b.status === 'won' ? b.profit : b.status === 'lost' ? -b.stake : 0) / b.stake)*100).toFixed(1) : '', clv !== null ? clv + '%' : '']); });
        const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'arbredge_bets.csv'; a.click();
        URL.revokeObjectURL(url);
      };

      return e('div', null,
        // Header with view toggle + export
        e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 } },
          e('div', { style: { display: 'flex', gap: 6 } },
            e('button', { onClick: () => setTrackerView('bets'), style: { ...st.btn(trackerView === 'bets' ? 'primary' : 'outline'), fontSize: 12, padding: '6px 12px' } }, '📋 Bets'),
            e('button', { onClick: () => setTrackerView('dashboard'), style: { ...st.btn(trackerView === 'dashboard' ? 'primary' : 'outline'), fontSize: 12, padding: '6px 12px' } }, '📊 Dashboard')
          ),
          e('div', { style: { display: 'flex', gap: 6 } },
            bets.length > 0 && e('button', { onClick: exportCSV, style: { ...st.btn('outline'), fontSize: 11, padding: '5px 10px' } }, '⬇ CSV'),
            e('button', { onClick: () => setBets([]), style: { ...st.btn('danger'), fontSize: 11, padding: '5px 10px' } }, 'Clear')
          )
        ),

        // Summary metrics — always visible
        e('div', { style: st.metricsGrid },
          [
            ['Bets', bets.length, null],
            ['P&L', (bets[0] ? bets[0].currency : currency) + ' ' + realProfit.toFixed(2), realProfit >= 0 ? C.green : '#dc2626'],
            ['ROI', roi + '%', parseFloat(roi) >= 0 ? C.green : '#dc2626'],
            ['Win rate', winRate + (winRate !== '—' ? '%' : ''), null],
            ['Avg odds', avgOdds, null],
          ].map(([l, v, c]) => e('div', { key: l, style: st.metric }, e('div', { style: st.metricLabel }, l), e('div', { style: st.metricVal(c) }, v)))
        ),

        // ── DASHBOARD VIEW ──
        trackerView === 'dashboard' && bets.length === 0 && e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } },
          e('div', { style: { fontSize: 36, marginBottom: 8 } }, '📊'),
          e('div', { style: { fontSize: 14 } }, 'Log some bets first to see your analytics.')
        ),

        trackerView === 'dashboard' && bets.length > 0 && e('div', null,

          // Bankroll setting
          e('div', { style: { background: C.grayLight, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 } },
            e('span', { style: { fontSize: 13, color: C.muted, flexShrink: 0 } }, 'Starting bankroll:'),
            e('input', { type: 'number', value: bankroll, min: 1, step: 50, onChange: ev => setBankroll(Math.max(1, parseFloat(ev.target.value) || 500)), style: { ...st.input, width: 110 } }),
            e('span', { style: { fontSize: 13, fontWeight: 700, color: realProfit >= 0 ? C.green : '#dc2626' } }, '→ ' + currency + ' ' + (bankroll + realProfit).toFixed(2))
          ),

          // Streak + top sport highlights
          e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 } },
            e('div', { style: { background: C.grayLight, borderRadius: 10, padding: '10px 12px' } },
              e('div', { style: { fontSize: 11, color: C.muted, marginBottom: 4 } }, 'Current streak'),
              e('div', { style: { fontSize: 15, fontWeight: 700 } }, streakLabel)
            ),
            e('div', { style: { background: C.grayLight, borderRadius: 10, padding: '10px 12px' } },
              e('div', { style: { fontSize: 11, color: C.muted, marginBottom: 4 } }, 'Best sport'),
              e('div', { style: { fontSize: 13, fontWeight: 700, color: topSport ? (topSport[1].profit >= 0 ? C.green : '#dc2626') : C.muted } },
                topSport ? getSportInfo(topSport[0]).emoji + ' ' + getSportInfo(topSport[0]).label + ' (' + currency + ' ' + topSport[1].profit.toFixed(2) + ')' : '—')
            )
          ),

          // Bankroll curve (mini SVG)
          e('div', { style: { background: C.white, border: '1px solid ' + C.border, borderRadius: 10, padding: '12px 14px', marginBottom: 12 } },
            e('div', { style: { fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8 } }, '📈 Bankroll curve'),
            (() => {
              if (curve.length < 2) return e('div', { style: { color: C.muted, fontSize: 12 } }, 'Not enough settled bets yet.');
              const W = 300, H = 80;
              const min = Math.min(...curve), max = Math.max(...curve);
              const range = max - min || 1;
              const pts = curve.map((v, i) => [(i / (curve.length - 1)) * W, H - ((v - min) / range) * (H - 8)]);
              const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
              const color = curve[curve.length - 1] >= curve[0] ? C.green : '#dc2626';
              return e('svg', { viewBox: '0 0 ' + W + ' ' + H, style: { width: '100%', height: H } },
                e('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: color, strokeWidth: 2 }),
                e('circle', { cx: pts[pts.length-1][0], cy: pts[pts.length-1][1], r: 4, fill: color })
              );
            })()
          ),

          // By bet type
          e('div', { style: { background: C.white, border: '1px solid ' + C.border, borderRadius: 10, padding: '12px 14px', marginBottom: 12 } },
            e('div', { style: { fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 } }, '🎯 By bet type'),
            Object.entries(byType).filter(([, v]) => v.count > 0).map(([type, v]) =>
              e('div', { key: type, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
                e('div', null,
                  e('div', { style: { fontSize: 13, fontWeight: 600 } }, type === 'ev' ? '📈 +EV' : type === 'arb' ? '⚡ Arb' : '✏️ Manual'),
                  e('div', { style: { fontSize: 11, color: C.muted } }, v.count + ' bets · ' + currency + ' ' + v.staked.toFixed(2) + ' staked')
                ),
                e('div', { style: { fontSize: 14, fontWeight: 700, color: v.profit >= 0 ? C.green : '#dc2626', textAlign: 'right' } },
                  (v.profit >= 0 ? '+' : '') + currency + ' ' + v.profit.toFixed(2),
                  e('div', { style: { fontSize: 11, color: C.muted } }, v.staked > 0 ? ((v.profit/v.staked)*100).toFixed(1) + '% ROI' : '')
                )
              )
            )
          ),

          // By sport
          e('div', { style: { background: C.white, border: '1px solid ' + C.border, borderRadius: 10, padding: '12px 14px', marginBottom: 12 } },
            e('div', { style: { fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 } }, '🌍 By sport'),
            Object.entries(bySport).sort((a, b) => b[1].profit - a[1].profit).map(([sport, v]) => {
              const info = getSportInfo(sport);
              const pct = Math.abs(v.profit) / Math.max(Math.abs(Math.min(...Object.values(bySport).map(x=>x.profit))), Math.max(...Object.values(bySport).map(x=>x.profit)), 1);
              return e('div', { key: sport, style: { marginBottom: 10 } },
                e('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 } },
                  e('span', null, info.emoji + ' ' + info.label + ' (' + v.count + ')'),
                  e('span', { style: { fontWeight: 700, color: v.profit >= 0 ? C.green : '#dc2626' } }, (v.profit >= 0 ? '+' : '') + currency + ' ' + v.profit.toFixed(2))
                ),
                e('div', { style: { height: 6, background: C.grayLight, borderRadius: 3, overflow: 'hidden' } },
                  e('div', { style: { height: '100%', width: (pct * 100).toFixed(0) + '%', background: v.profit >= 0 ? C.green : '#dc2626', borderRadius: 3 } })
                )
              );
            })
          ),

          // By bookmaker — diversification at a glance
          Object.keys(byBook).length > 0 && e('div', { style: { background: C.white, border: '1px solid ' + C.border, borderRadius: 10, padding: '12px 14px', marginBottom: 12 } },
            e('div', { style: { fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 } }, '🏦 By bookmaker'),
            Object.entries(byBook).sort((a, b) => b[1].count - a[1].count).map(([book, v]) => {
              const sharePct = bets.length > 0 ? ((v.count / bets.length) * 100).toFixed(0) : 0;
              return e('div', { key: book, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
                e('div', null,
                  e('div', { style: { fontSize: 13, fontWeight: 600 } }, book),
                  e('div', { style: { fontSize: 11, color: C.muted } }, v.count + ' bets (' + sharePct + '% of total) · ' + currency + ' ' + v.staked.toFixed(2) + ' staked')
                ),
                e('div', { style: { fontSize: 13, fontWeight: 700, color: v.profit >= 0 ? C.green : '#dc2626' } }, (v.profit >= 0 ? '+' : '') + currency + ' ' + v.profit.toFixed(2))
              );
            }),
            Object.keys(byBook).length === 1 && e('div', { style: { fontSize: 11, color: '#9a3412', background: '#fff7ed', borderRadius: 6, padding: '6px 8px', marginTop: 4 } },
              '⚠️ Every bet is on a single book — if it limits or restricts your account, you have no fallback. Spreading action across 2+ books protects you from that.'
            )
          ),

          // Monthly trends
          monthOrder.length > 0 && e('div', { style: { background: C.white, border: '1px solid ' + C.border, borderRadius: 10, padding: '12px 14px', marginBottom: 12 } },
            e('div', { style: { fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 } }, '📅 Monthly trends'),
            monthOrder.map(m => {
              const v = byMonth[m];
              return e('div', { key: m, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
                e('div', null,
                  e('div', { style: { fontSize: 13, fontWeight: 600 } }, m),
                  e('div', { style: { fontSize: 11, color: C.muted } }, v.count + ' bets · ' + currency + ' ' + v.staked.toFixed(2) + ' staked')
                ),
                e('div', { style: { fontSize: 13, fontWeight: 700, color: v.profit >= 0 ? C.green : '#dc2626' } },
                  (v.profit >= 0 ? '+' : '') + currency + ' ' + v.profit.toFixed(2),
                  e('div', { style: { fontSize: 11, color: C.muted, textAlign: 'right' } }, v.staked > 0 ? ((v.profit / v.staked) * 100).toFixed(1) + '% ROI' : '')
                )
              );
            })
          )
        ),

        // ── BETS LIST VIEW ──
        trackerView === 'bets' && bets.length === 0 &&
          e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } },
            e('div', { style: { fontSize: 36, marginBottom: 8 } }, '📒'),
            e('div', { style: { fontSize: 14 } }, 'No bets logged yet. Hit "Log Bet" on any arb or +EV card.')
          ),

        trackerView === 'bets' && bets.map(bet => {
          const clv = clvBet(bet);
          return e('div', { key: bet.id, style: { ...st.card(false), cursor: 'default', marginBottom: 10 } },
            e('div', { style: st.cardRow },
              e('div', { style: { flex: 1, minWidth: 0 } },
                e('div', { style: { display: 'flex', gap: 5, marginBottom: 3, flexWrap: 'wrap' } },
                  e('span', { style: st.sportLabel }, getSportInfo(bet.sport).emoji + ' ' + getSportInfo(bet.sport).label),
                  e('span', { style: { fontSize: 11, color: C.muted } }, '· ' + new Date(bet.date).toLocaleDateString()),
                  e('span', { style: { fontSize: 11, fontWeight: 600, color: bet.type === 'ev' ? C.blue : bet.type === 'manual' ? C.purple : C.green, background: bet.type === 'ev' ? '#eff6ff' : bet.type === 'manual' ? C.purpleLight : C.greenLight, padding: '1px 6px', borderRadius: 10 } }, bet.type === 'ev' ? '+EV' : bet.type === 'manual' ? 'Manual' : 'Arb')
                ),
                e('div', { style: st.matchTitle }, bet.match)
              ),
              e('div', { style: { display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 } },
                e('select', { value: bet.status, onChange: ev => setBets(p => p.map(b => b.id === bet.id ? { ...b, status: ev.target.value } : b)), style: { fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid ' + C.border, background: C.white } },
                  e('option', { value: 'pending' }, '⏳ Pending'), e('option', { value: 'won' }, '✅ Won'), e('option', { value: 'lost' }, '❌ Lost')
                ),
                e('button', { onClick: () => setBets(p => p.filter(b => b.id !== bet.id)), style: { ...st.btn('danger'), padding: '3px 8px', fontSize: 11 } }, '✕')
              )
            ),

            // Outcomes / legs
            e('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 } },
              (bet.outcomes || []).map((o, i) => e('div', { key: i, style: { background: C.grayLight, borderRadius: 8, padding: '5px 9px', fontSize: 12 } },
                e('div', { style: { color: C.muted, fontSize: 11 } }, o.label || o.outcome || 'Bet'),
                e('div', { style: { fontWeight: 700 } }, (o.bookName || o.book || '') + ' · ' + (bet.currency || currency) + ' ' + (o.stake || bet.stake).toFixed(2)),
                o.odds && e('div', { style: { color: C.green, fontWeight: 700, fontSize: 13 } }, '@' + o.odds.toFixed(2))
              ))
            ),

            // P&L line
            e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid ' + C.border } },
              e('div', { style: { fontSize: 12, color: C.muted } },
                'Staked: ' + (bet.currency || currency) + ' ' + (bet.stake || 0).toFixed(2) +
                (bet.status !== 'pending' ? ' · ' + (bet.status === 'won' ? '✅ Won ' + (bet.currency || currency) + ' ' + bet.profit.toFixed(2) : '❌ Lost ' + (bet.currency || currency) + ' ' + (bet.stake || 0).toFixed(2)) : ' · ⏳ Pending')
              ),
              clv !== null && e('span', { style: { fontSize: 11, fontWeight: 700, color: parseFloat(clv) >= 0 ? C.green : '#dc2626', background: parseFloat(clv) >= 0 ? C.greenLight : '#fef2f2', padding: '2px 8px', borderRadius: 10 } }, 'CLV ' + (parseFloat(clv) >= 0 ? '+' : '') + clv + '%')
            ),

            // Closing odds (for EV bets — compare placed odds vs closing odds).
            // Auto-captured during scans once the match kicks off; manual entry is
            // only the fallback for bets added too late for auto-capture to catch,
            // and now actually persists (previously lost on refresh).
            bet.type === 'ev' && bet.status !== 'pending' && e('div', { style: { marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
              e('span', { style: { fontSize: 11, color: C.muted, flexShrink: 0 } }, 'Closing odds:'),
              bet.clvOdds != null
                ? e('span', { style: { fontSize: 13, fontWeight: 700, color: C.text } }, bet.clvOdds.toFixed(2))
                : e('input', {
                    type: 'number', step: 0.01, placeholder: 'e.g. 14.50',
                    value: clvInputs[bet.id] || '',
                    onChange: ev => {
                      const val = ev.target.value;
                      setClvInputs(p => ({ ...p, [bet.id]: val }));
                      const num = parseFloat(val);
                      const valid = val !== '' && !isNaN(num);
                      setBets(prev => prev.map(b => b.id === bet.id ? { ...b, clvOdds: valid ? num : null, clvSource: valid ? 'manual' : null } : b));
                    },
                    style: { ...st.input, width: 100, fontSize: 12, padding: '4px 8px' }
                  }),
              bet.clvSource === 'auto' && e('span', { style: { fontSize: 10, fontWeight: 700, color: '#6d28d9', background: '#ede9fe', padding: '1px 6px', borderRadius: 8 } }, '📡 auto-captured'),
              clv !== null && e('span', { style: { fontSize: 12, color: C.muted } }, 'You beat closing line by ' + clv + '%')
            )
          );
        })
      );
    })()),
    tab === 'guide' && e('div', { style: st.section },
      e('div', { style: st.guideH }, '🇬🇭 All Bookmakers in Ghana'),
      e('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 } },
        Object.entries(BOOKS).map(([k, b]) =>
          e('div', { key: k, style: { background: b.manual ? C.purpleLight : C.grayLight, borderRadius: 10, padding: '11px 14px' } },
            e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 } },
              e('a', { href: b.url, target: '_blank', rel: 'noreferrer', style: { fontSize: 14, fontWeight: 700, color: C.text, textDecoration: 'none' } }, b.name),
              e('div', { style: { display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' } },
                b.manual && e('span', { style: { background: C.purpleLight, color: C.purple, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, border: '1px solid #c4b5fd' } }, '✏️ Manual entry'),
                !b.manual && e('span', { style: { background: '#e0f2fe', color: '#0369a1', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 } }, '🔄 Auto-scanned'),
                b.licensed && e('span', { style: { background: C.greenLight, color: C.greenDark, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 } }, '✓ GGC Licensed'),
                b.momo && e('span', { style: { background: C.amberLight, color: '#78350f', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 } }, '📱 MoMo')
              )
            ),
            e('div', { style: { fontSize: 12, color: C.muted } }, b.note)
          )
        )
      ),
      e('div', { style: { background: C.purpleLight, border: '1px solid #c4b5fd', borderRadius: 10, padding: '11px 14px', marginBottom: 16, fontSize: 12, color: C.purple, lineHeight: 1.6 } },
        '✅ SportyBet, Betano and MSport are now auto-scanned via the West Africa scraper. Their odds feed directly into the 🇬🇭 West Africa section of the Scanner and +EV tabs. Manual entry is still available if the scraper misses a market.'
      ),
      e('div', { style: st.guideH }, '🌍 Sports coverage'),
      e('div', { style: st.guideP }, 'ArbEdge scans ' + ALL_SPORTS.length + ' competitions worldwide — FIFA World Cup (Men & Women), AFCON, all Grand Slams (ATP & WTA), NBA, WNBA, NFL, UFC/MMA, ICC Cricket World Cup, Champions League, Copa América, IPL, and 80+ football leagues.'),
      e('div', { style: st.guideH }, '⚠️ Key risks'),
      e('div', { style: st.guideP }, 'Account limits: bookmakers detect arbers. Use round stakes and place occasional recreational bets. Odds movement: place the better-odds leg first — you have 30 seconds to 3 minutes. For Betano and MSport you need to check odds manually and move fast.'),
      e('div', { style: st.guideH }, '📋 Quick checklist'),
      ['Margin at least 1.5% (covers drift)', 'Same event start time on both books', 'Funds pre-loaded — no deposits mid-arb', 'Higher-odds leg placed first', 'Screenshot betslips after placement', 'Log bet in Tracker tab', 'Withdraw profits regularly'].map((item, i) =>
       e('div', { key: i, style: { display: 'flex', gap: 8, marginBottom: 6 } },
          e('span', { style: { color: C.green, flexShrink: 0 } }, '✓'),
          e('span', { style: { fontSize: 13, color: C.muted, lineHeight: 1.4 } }, item)
        )
      ),
      e('div', { style: { background: C.amberLight, borderRadius: 10, padding: '11px 14px', marginTop: 16, fontSize: 12, color: '#78350f', lineHeight: 1.6 } }, '⚖️ Sports betting is legal in Ghana under the Gaming Commission of Ghana. Bet responsibly.')
    )
  );
}
