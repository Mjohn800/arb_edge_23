'use client';
import React, { useState, useEffect, useCallback, createElement } from 'react';
import { supabase } from '../lib/supabaseClient';

// ─── BOOKMAKERS ───────────────────────────────────────────────────────────────
// Two feeds of the same operator must never count as two bookmakers when checking for a cross-book arb.
const bookGroup = k => (k === 'onexbet' ? '1xbet' : k);
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
  '1xbet':       { name: '1xBet (GH)',        momo: true,  licensed: true,  manual: false, accessible: true,  sharp: true,  wa: true,  url: 'https://1xbet.com/en/line', sportUrls: { soccer: 'https://1xbet.com/en/line/football', basketball: 'https://1xbet.com/en/line/basketball', tennis: 'https://1xbet.com/en/line/tennis', cricket: 'https://1xbet.com/en/line/cricket', mma: 'https://1xbet.com/en/line/mma' } },
  onexbet:       { name: '1xBet (EU/UK feed)',        momo: true,  licensed: true,  manual: false, accessible: true,  sharp: true,  wa: true,  url: 'https://1xbet.com/en/line', sportUrls: { soccer: 'https://1xbet.com/en/line/football', basketball: 'https://1xbet.com/en/line/basketball', tennis: 'https://1xbet.com/en/line/tennis', cricket: 'https://1xbet.com/en/line/cricket', mma: 'https://1xbet.com/en/line/mma' } },
  betway:        { name: 'Betway',       momo: true,  licensed: true,  manual: false, accessible: true,  sharp: false, wa: true,  url: 'https://www.betway.com.gh/sports/all-sports', sportUrls: { soccer: 'https://www.betway.com.gh/sports/soccer', basketball: 'https://www.betway.com.gh/sports/basketball', tennis: 'https://www.betway.com.gh/sports/tennis', cricket: 'https://www.betway.com.gh/sports/cricket', mma: 'https://www.betway.com.gh/sports/mma' } },

  // ── West Africa only (scraped, not in global API feed) ────────────────────
  sportybet:     { name: 'SportyBet',    momo: true,  licensed: true,  manual: false, accessible: true,  sharp: false, wa: true,  url: 'https://www.sportybet.com/gh/sport/football', sportUrls: { soccer: 'https://www.sportybet.com/gh/sport/football', basketball: 'https://www.sportybet.com/gh/sport/basketball', tennis: 'https://www.sportybet.com/gh/sport/tennis', cricket: 'https://www.sportybet.com/gh/sport/cricket', mma: 'https://www.sportybet.com/gh/sport/mma' } },
  betano:        { name: 'Betano',       momo: true,  licensed: false, manual: false, accessible: true,  sharp: false, wa: true,  url: 'https://www.betano.com.gh/sport/football', sportUrls: { soccer: 'https://www.betano.com.gh/sport/football', basketball: 'https://www.betano.com.gh/sport/basketball', tennis: 'https://www.betano.com.gh/sport/tennis', cricket: 'https://www.betano.com.gh/sport/cricket', mma: 'https://www.betano.com.gh/sport/mma' } },
  msport:        { name: 'MSport',       momo: true,  licensed: false, manual: false, accessible: true,  sharp: false, wa: true,  url: 'https://www.msport.com/gh/football', sportUrls: { soccer: 'https://www.msport.com/gh/football', basketball: 'https://www.msport.com/gh/basketball', tennis: 'https://www.msport.com/gh/tennis', cricket: 'https://www.msport.com/gh/cricket', mma: 'https://www.msport.com/gh/mma' } },
  '22bet':       { name: '22Bet',        momo: true,  licensed: false, manual: false, accessible: true,  sharp: false, wa: true,  url: 'https://22bet.com.gh', sportUrls: { soccer: 'https://22bet.com.gh/prematch?sport=Football', basketball: 'https://22bet.com.gh/prematch?sport=Basketball', tennis: 'https://22bet.com.gh/prematch?sport=Tennis', cricket: 'https://22bet.com.gh/prematch?sport=Cricket', mma: 'https://22bet.com.gh/prematch?sport=MMA' } },
  // Mozzart absent from GCG licensed-operators list as of Sept 2026 (gamingcommission.gov.gh/licensed-operators) — recheck periodically
 mozzartbet: { name: 'Mozzart', momo: true, licensed: false, manual: false, accessible: true, sharp: false, wa: true, url: 'https://www.mozzartbet.com.gh', sportUrls: {} },
};

const SUPPORT_EMAIL = 'arbedge02@gmail.com';
const mailto = (subject, body) => 'mailto:' + SUPPORT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

// Regions a user can pick in the app (or leave on auto-detect).
const REGION_OPTIONS = [
  { key: 'auto',  label: 'Auto-detect' },
  { key: 'wa',    label: 'West Africa' },
  { key: 'eu',    label: 'Europe' },
  { key: 'uk',    label: 'United Kingdom' },
  { key: 'us',    label: 'United States (not available)' },
  { key: 'other', label: 'Rest of world' },
];

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
function getFormDivergence(sportKey, teamName, teamForm) {
  const source = teamForm || TEAM_FORM; // fall back to empty constant if not yet loaded
  const league = source[sportKey];
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
function getFormContextForOutcome(sportKey, teamName, teamForm) {
  return getFormDivergence(sportKey, teamName, teamForm);
}

const MOCK = [
  { id: 'm1', sport: 'soccer_epl', match: 'Arsenal vs Chelsea', commenceTime: new Date(Date.now() + 3 * 3600000).toISOString(), margin: 3.7, outcomes: [{ label: 'Arsenal', book: 'betway', bookName: 'Betway', odds: 2.50 }, { label: 'Draw', book: '1xbet', bookName: '1xBet', odds: 4.10 }, { label: 'Chelsea', book: 'bet365', bookName: 'Bet365', odds: 3.40 }] },
  { id: 'm2', sport: 'soccer_uefa_champs_league', match: 'Real Madrid vs Man City', commenceTime: new Date(Date.now() + 26 * 3600000).toISOString(), margin: 2.1, outcomes: [{ label: 'Real Madrid', book: 'pinnacle', bookName: 'Pinnacle', odds: 2.20 }, { label: 'Draw', book: 'marathonbet', bookName: 'MarathonBet', odds: 3.80 }, { label: 'Man City', book: '1xbet', bookName: '1xBet', odds: 3.40 }] },
  { id: 'm3', sport: 'basketball_nba', match: 'Lakers vs Celtics', commenceTime: new Date(Date.now() + 5 * 3600000).toISOString(), margin: 1.8, outcomes: [{ label: 'Lakers', book: 'betway', bookName: 'Betway', odds: 2.10 }, { label: 'Celtics', book: '1xbet', bookName: '1xBet', odds: 1.98 }] },
  { id: 'm4', sport: 'mma_mixed_martial_arts', match: 'Pereira vs Ankalaev', commenceTime: new Date(Date.now() + 48 * 3600000).toISOString(), margin: 2.4, outcomes: [{ label: 'Pereira', book: 'bet365', bookName: 'Bet365', odds: 1.72 }, { label: 'Ankalaev', book: 'pinnacle', bookName: 'Pinnacle', odds: 2.30 }] },
  { id: 'm5', sport: 'cricket_ipl', match: 'Mumbai Indians vs CSK', commenceTime: new Date(Date.now() + 12 * 3600000).toISOString(), margin: 1.5, outcomes: [{ label: 'Mumbai Indians', book: '1xbet', bookName: '1xBet', odds: 2.05 }, { label: 'CSK', book: 'betway', bookName: 'Betway', odds: 1.90 }] },
];

// ── DATA-INTEGRITY FILTER ──────────────────────────────────────────────────
// Runs once per scan on EVERY event, league and sport, before any finder (arbs,
// EV, middles, best odds) sees the data. It does not need to know which league
// or market is "right": it removes quotes that are internally impossible, so a
// price problem in any feed is contained instead of surfacing as an arb.
//   1. A bookmaker's own complete market can't total under 100% (it would mean
//      the book itself offers a free arb) or over a sane margin. Betting
//      exchanges are exempt from the lower bound — their back prices can sum
//      just under 100%.
//   2. A bookmaker's totals and handicap lines must be in order: Over prices
//      rise with the line, Under prices fall, the home handicap price falls as
//      the line rises. A quote that breaks the order is dropped together with
//      its neighbour (we don't guess which of the two is the wrong one).
// Removed quotes are counted and reported, never silently lost. Mutates the
// freshly built scan data in place.
// Feeds held back from every finder until they are verified against the bookmaker's own site.
// (Empty: Melbet was removed — its scraper has ended. Add { bookkey: 'reason' } to quarantine a feed.)
const QUARANTINED_FEEDS = {
  '1xbet': 'OddsPapi feed prices run 8-28% above SportyBet and other books on EPL totals; not verified',
};
const EXCHANGE_RE = /betfair|matchbook|smarkets/i;
const OVERROUND_MAX = { 2: 1.25, 3: 1.30 };
const LADDER_TOL = 0.01;

function sanitizeEvents(events) {
  const report = { total: 0, byReason: {}, byBook: {}, examples: [], quarantined: {} };
  const note = (ev, bm, market, reason) => {
    report.total++;
    report.byReason[reason] = (report.byReason[reason] || 0) + 1;
    report.byBook[bm.key] = (report.byBook[bm.key] || 0) + 1;
    if (report.examples.length < 8) report.examples.push({ match: ev.home_team + ' vs ' + ev.away_team, book: bm.key, market, reason });
  };
  const dropLadder = (items, violates, bad, onDrop) => {
    let alive = items.slice();
    for (;;) {
      const counts = new Map();
      for (let i = 1; i < alive.length; i++) if (violates(alive[i - 1], alive[i])) {
        counts.set(alive[i - 1], (counts.get(alive[i - 1]) || 0) + 1);
        counts.set(alive[i], (counts.get(alive[i]) || 0) + 1);
      }
      if (!counts.size) break;
      const max = Math.max(...counts.values());
      const drop = new Set([...counts].filter(([, c]) => c === max).map(([k]) => k));
      drop.forEach(it => { it.refs.forEach(r => bad.add(r)); onDrop(it); });
      alive = alive.filter(it => !drop.has(it));
    }
  };

  for (const ev of events) {
    const isSoccer = typeof ev.sport_key === 'string' && ev.sport_key.startsWith('soccer');
    for (const bm of ev.bookmakers || []) {
      if (QUARANTINED_FEEDS[bm.key]) { report.quarantined[bm.key] = QUARANTINED_FEEDS[bm.key]; bm.markets = []; continue; }
      const exchange = EXCHANGE_RE.test(bm.key);
      const bad = new Set();
      const overroundReason = (imp, n) => (!exchange && imp < 1) ? 'own market totals under 100%' : imp > OVERROUND_MAX[n] ? 'own market margin implausibly high' : null;

      // 1a. match result markets
      for (const mkt of bm.markets || []) {
        if (mkt.key !== 'h2h') continue;
        const outs = (mkt.outcomes || []).filter(o => o.price > 1);
        if (outs.length < 2 || outs.length > 3 || (isSoccer && outs.length !== 3)) continue; // incomplete sets are handled by the finders
        const reason = overroundReason(outs.reduce((s, o) => s + 1 / o.price, 0), outs.length);
        if (reason) { (mkt.outcomes || []).forEach(o => bad.add(o)); note(ev, bm, 'match result', reason); }
      }

      // 1b/2. totals: pair check, then line order
      const tot = {};
      for (const mkt of bm.markets || []) if (mkt.key === 'totals' || mkt.key === 'alternate_totals') for (const o of mkt.outcomes || []) {
        const n = String(o.name || '').trim().toLowerCase();
        if ((n !== 'over' && n !== 'under') || typeof o.point !== 'number' || !(o.price > 1)) continue;
        (tot[o.point] = tot[o.point] || {})[n] = o;
      }
      const totItems = [];
      for (const L of Object.keys(tot).map(Number).sort((a, b) => a - b)) {
        const t = tot[L];
        if (t.over && t.under) {
          const reason = overroundReason(1 / t.over.price + 1 / t.under.price, 2);
          if (reason) { bad.add(t.over); bad.add(t.under); note(ev, bm, 'total ' + L, reason); continue; }
        }
        totItems.push({ L, refs: [t.over, t.under].filter(Boolean), over: t.over && t.over.price, under: t.under && t.under.price });
      }
      dropLadder(totItems, (a, b) => (a.over && b.over && b.over < a.over * (1 - LADDER_TOL)) || (a.under && b.under && b.under > a.under * (1 + LADDER_TOL)), bad, it => note(ev, bm, 'total ' + it.L, 'line out of order'));

      // 1b/2. handicaps, by home-perspective line
      const sp = {};
      for (const mkt of bm.markets || []) if (mkt.key === 'spreads') for (const o of mkt.outcomes || []) {
        const s = resolveSide(o.name, ev, bm);
        if ((s !== '__home__' && s !== '__away__') || typeof o.point !== 'number' || !(o.price > 1)) continue;
        const L = s === '__home__' ? o.point : -o.point;
        (sp[L] = sp[L] || {})[s === '__home__' ? 'home' : 'away'] = o;
      }
      const spItems = [];
      for (const L of Object.keys(sp).map(Number).sort((a, b) => a - b)) {
        const t = sp[L];
        if (t.home && t.away) {
          const reason = overroundReason(1 / t.home.price + 1 / t.away.price, 2);
          if (reason) { bad.add(t.home); bad.add(t.away); note(ev, bm, 'handicap ' + L, reason); continue; }
        }
        spItems.push({ L, refs: [t.home, t.away].filter(Boolean), home: t.home && t.home.price, away: t.away && t.away.price });
      }
      dropLadder(spItems, (a, b) => (a.home && b.home && b.home > a.home * (1 + LADDER_TOL)) || (a.away && b.away && b.away < a.away * (1 - LADDER_TOL)), bad, it => note(ev, bm, 'handicap ' + it.L, 'line out of order'));

      if (bad.size) {
        for (const mkt of bm.markets || []) mkt.outcomes = (mkt.outcomes || []).filter(o => !bad.has(o));
        bm.markets = (bm.markets || []).filter(m => (m.outcomes || []).length > 0);
      }
    }
  }
  if (report.total) console.warn('[integrity] excluded', report.total, 'quotes', JSON.stringify(report.byReason), JSON.stringify(report.byBook));
  return report;
}

function titleCase(str) {
  return String(str || '').toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
}

// Totals pair only if they are the same kind of market. OddsPapi totals reach this point already
// restricted to the verified full-time market (whitelist in lib/oddspapi.js), and Odds API /
// SportyBet totals carry no market name and are the full-time total. Any other named market keeps
// its own slot, so it can never pair with full-time totals.
function totalsVariant(mkt) {
  const n = String(mkt.marketName || '').trim().toLowerCase();
  return (!n || n === 'over under full time') ? 'fulltime' : n;
}

// Resolve which side of the fixture an outcome refers to. Tries the exact
// normaliser first, then falls back to normaliseTeamName() so spelling
// variants from different feeds ("Man City" / "Manchester City") still land
// on the same side. Returns '__home__' | '__away__' | '__draw__' | null.
// null = can't tell which side this is, so the caller skips it rather than
// letting an unrecognised spelling become its own fake "outcome".
function resolveSide(name, ev, bm) {
  const n = normaliseOutcome(name, ev.home_team, ev.away_team);
  if (n === '__home__' || n === '__away__' || n === '__draw__') return n;
  const t = normaliseTeamName(name);
  if (t && t === normaliseTeamName(ev.home_team)) return '__home__';
  if (t && t === normaliseTeamName(ev.away_team)) return '__away__';
  // A book's outcome names come from the same feed as its own event labels (bm.srcEvent, set by the server merge, which
  // matched that label to this event). When the shared-name lookup fails ("Brighton" vs "Brighton and Hove Albion"),
  // resolve against the book's OWN home/away names instead of dropping the quote.
  const se = bm && bm.srcEvent;
  if (se && se.home && se.away) {
    const r = normaliseOutcome(name, se.home, se.away);
    if (r === '__home__' || r === '__away__' || r === '__draw__') return r;
  }
  return null;
}

// High-margin arbs are NOT dropped — they're often the most valuable ones
// (pricing errors, lagging odds). Instead every arb gets cross-checked, and
// anything that fails a check is flagged "review" with the specific reason,
// so you know exactly what to verify on the book. This used to only surface
// the outlier reasons below when margin >= 5% — but a single wrong odd from
// a bad upstream feed produces a LOW margin, believable arb just as often as
// a high one (arguably more dangerously, since a modest margin reads as
// "safe"). The detection always ran either way; only the warning text was
// margin-gated. Removed 28 Sep 2026 — every arb now gets the same scrutiny
// regardless of size.
const HIGH_MARGIN_REVIEW = 5;   // % — kept for the "persisted suspicious" badge elsewhere; no longer gates outlier checks

// A fixed "15% above median" bar has a blind spot: it's the same bar whether
// the other books agree with each other to within 1% or are already 12%
// apart on their own. In a market where every other book agrees tightly, a
// leg just 6-8% off is genuinely suspicious — a single bad upstream odd
// (OddsPapi/Odds API feed error) is exactly this shape: not absurd enough to
// hit a fixed 15%, low enough margin to look "safe", but still wrong. In a
// naturally volatile market (thin liquidity, few books), 15% apart can be
// completely normal. So the bar now scales with how tightly the OTHER books
// actually agree, instead of using one number for every market:
//   threshold = 1 + max(OUTLIER_MIN_DEVIATION, OUTLIER_SPREAD_MULTIPLIER × spread-of-others)
// Tight consensus (others within ~2%) -> ~12% bar (tighter than the old fixed 15%).
// Others already ~10% apart -> ~15% bar (about the same as before).
// Others already ~20% apart -> ~30% bar (looser — a genuinely volatile market
// isn't penalized for its own natural spread).
const OUTLIER_MIN_DEVIATION = 0.12;     // floor: even with perfect consensus, this much deviation still isn't flagged
const OUTLIER_SPREAD_MULTIPLIER = 1.5;  // how much extra room a leg gets per unit of the other books' own disagreement

// Relative range of a set of prices: (max-min)/median. 0 when 0-1 prices, or
// all identical. This is the "how much do the other books already disagree"
// input to the adaptive threshold above.
function relativeSpread(arr) {
  if (!arr || arr.length < 2) return 0;
  const med = medianOf(arr);
  if (!med) return 0;
  return (Math.max(...arr) - Math.min(...arr)) / med;
}

// A single leg priced way above consensus can still be a real, valuable arb —
// a book slow to react to a red card or injury news genuinely does look like
// an outlier for a while. So the adaptive check above only ever flags for
// review, never excludes. But TWO OR MORE legs of the same market, from the
// SAME book, independently priced this far above consensus at once is a
// different shape of signal: a real news-driven repricing moves one side of
// a market, not several unrelated outcomes at once. Seen directly on 22bet
// Malaga CF vs Espanyol — Malaga @9.3 (median 2.70) AND Draw @7.9 (median
// 3.24) simultaneously — confirmed via /api/oddspapi-debug as one single,
// clean, non-duplicated, active market record; not a parsing bug, just bad
// data at the source. That combination is exclude-worthy; a single extreme
// leg alone is not. This bound stays fixed (not adaptive) — two-plus legs
// from one book this far off consensus is abnormal in any market, volatile
// or not.
const MULTI_OUTLIER_RATIO = 1.5;   // stricter bound used only for the multi-leg check
const MULTI_OUTLIER_MIN_LEGS = 2;  // this many simultaneous outliers from one book -> exclude


// ── FAIR-VALUE ANCHOR ───────────────────────────────────────────────────────
// A soft book can beat the sharp market by a few percent (a lagging line). Much more than that is
// almost always bad data. 5% is a starting point: tune it from the [findArbs] logs.
const ANCHOR_MAX_DEV = 0.05;
// Rank-based leg selection (see findArbs). A leg is the best credible price that at least one other book quotes within
// AGREE_TOL; if the best stands alone the 2nd, then the 3rd best is tried (RANK_DEPTH). A book that lists the same
// selection at several prices contributes its DUP_RANK-th best (0 = best, 1 = 2nd best) instead of being dropped.
const RANK_DEPTH = 3;
const AGREE_TOL = 0.07;                // 7%: two books "agree" if their prices are within this of each other
const DUP_RANK = 1;
const FLAGGED_KEEP_MARGIN = 1;         // % — a flagged arb under this margin is kept as a hidden, viewable 'review' arb instead of being dropped
const RANK_RULE_MIN_MARGIN = 0.6;     // % — arbs whose plain-best margin is <= this keep their plain best prices; the rank rule only applies above it
const CLEAN_MIN_AGREE_NO_ANCHOR = 1;  // with no Pinnacle/Betfair price, every leg needs this many agreeing books to stay out of 'review'
const MISLABEL_MARGIN = 2;             // % — a consensus-matching set that arbs by MORE than this is suspected of a mislabelled market
const ANCHOR_SHARPS = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet'];

// ── PRICE-VS-CONSENSUS FILTER (every sportsbook, every odds provider, every sport) ───────────────────────────
// A candidate leg is REJECTED outright (it cannot be the best price, in either the plain or the rank path) when it
// is more than CONSENSUS_MAX_DEV above the MEDIAN of what the other books quote for the same slot and side. The old
// check only warned (12%+, review tier) and was skipped entirely for arbs under RANK_RULE_MIN_MARGIN, which is how a
// bad 1xBet price made +0.1% and +0.2% arbs that looked safe. Odds API 1X2 prices are held to a tighter bound and
// need more corroborating books, because real 1X2 arbs are very rare and Odds API prices cannot be checked by hand
// from Ghana. A leg quoted by fewer books than the minimum is also rejected: an uncorroborated price is not trusted.
// Books sharing one operator (1xbet/onexbet) never count as each other's "other books" (see bookGroup).
const CONSENSUS_MAX_DEV = 0.08;           // 8%: totals and other markets, any book
const CONSENSUS_MIN_OTHERS = 1;           // other books that must quote the same slot+side
const CONSENSUS_MAX_DEV_STRICT = 0.04;    // 4%: 1X2 legs from any book or provider (real 1X2 arbs are very rare)
const CONSENSUS_MAX_DEV_SPREADS = 0.12;   // 12%: Asian handicap legs; quarter lines legitimately sit further apart between books
const CONSENSUS_MIN_OTHERS_STRICT = 2;
function consensusCheck(slot, q) {
  const strict = q.mktKey === 'h2h';
  const maxDev = strict ? CONSENSUS_MAX_DEV_STRICT
    : q.mktKey === 'spreads' ? CONSENSUS_MAX_DEV_SPREADS
    : CONSENSUS_MAX_DEV;
  const minOthers = strict ? CONSENSUS_MIN_OTHERS_STRICT : CONSENSUS_MIN_OTHERS;
  const others = (slot.all[q.sideKey] || []).filter(p => bookGroup(p.book) !== bookGroup(q.book) && p.price > 1).map(p => p.price);
  if (others.length < minOthers) return { ok: false, reason: 'thin', strict, nOthers: others.length };
  const med = medianOf(others);
  const ratio = q.price / med;
  if (ratio > 1 + maxDev) return { ok: false, reason: 'high', strict, nOthers: others.length, med, ratio };
  return { ok: true, strict, nOthers: others.length, med, ratio };
}

// ── PER-BOOK TRUST PROFILES ─────────────────────────────────────────────────────────────────────────────────
// Prices that pass through OUR code (OddsPapi catalogue mapping, or a scraper's parser) can be wrong in ways no
// generic check can see (22bet's totals were). So each such book needs its own entry here:
//   source   - where its prices come from. Two books on the SAME source can share one upstream mistake, so they
//              cannot vouch for each other in the rank rule (below).
//   verified - per market, true only once the book's OWN site was compared with what the app showed.
// The server tags these books feedPipeline='wa'. One with no entry here, or a market not marked true, is UNVERIFIED:
// its arbs are never dropped, but they go to the hidden 'review' tier with a reason on the card, and its price only
// becomes a leg if a VERIFIED book on a different source agrees with it. Odds API books (Pinnacle, Betfair, ...) are
// the provider's own feed and need no entry. TO ADD A BOOK: add a line, with every market false until you have checked it.
const BOOK_PROFILES = {
  sportybet: { source: 'scraper',  verified: { h2h: true,  spreads: true,  totals: true  } }, // read from SportyBet's own API
  betano:    { source: 'oddspapi', verified: { h2h: true,  spreads: true,  totals: true  } }, // catalogue names checked against betano.com
  '22bet':   { source: 'oddspapi', verified: { h2h: true,  spreads: false, totals: false } }, // totals proven wrong 24 Sep; spreads never checked
  '1xbet':   { source: 'oddspapi', verified: { h2h: false, spreads: false, totals: false } }, // OddsPapi feed, new: nothing checked yet
};
const feedSource = (book, ownFeed) => !ownFeed ? 'oddsapi' : ((BOOK_PROFILES[book] && BOOK_PROFILES[book].source) || 'unknown:' + book);
const feedVerified = (book, ownFeed, mktKey) => !ownFeed || !!(BOOK_PROFILES[book] && BOOK_PROFILES[book].verified[mktKey]);
// May book p (an agreeing quote) vouch for candidate q? Two of OUR OWN feeds on the same source may not; and an
// unverified q needs a verified voucher.
const canVouch = (q, p) => {
  if (q.ownFeed && p.ownFeed && feedSource(q.book, q.ownFeed) === feedSource(p.book, p.ownFeed)) return false;
  if (!feedVerified(q.book, q.ownFeed, q.mktKey) && !feedVerified(p.book, p.ownFeed, q.mktKey)) return false;
  return true;
};
const UNPROFILED_SEEN = new Set();
const noteUnprofiled = bm => {
  if (bm.feedPipeline === 'wa' && !BOOK_PROFILES[bm.key] && !UNPROFILED_SEEN.has(bm.key)) {
    UNPROFILED_SEEN.add(bm.key);
    console.warn('[books] "' + bm.key + '" comes through our own pipeline but has no BOOK_PROFILES entry: treated as UNVERIFIED (its arbs go to review).');
  }
};
// Two standard ways to remove a bookmaker's margin. Both turn one book's prices for ALL sides of a
// market into probabilities that sum to 1.
//   proportional: p_i = (1/o_i) / sum(1/o_j)
//   Shin:         assumes a share z of the money is insider money; solve for z so the p_i sum to 1.
//                 Shades long shots lower than proportional does (favourite-long-shot bias).
function proportionalProbs(odds) {
  const pi = odds.map(o => 1 / o); const S = pi.reduce((a, b) => a + b, 0);
  return pi.map(p => p / S);
}
function shinProbs(odds) {
  const pi = odds.map(o => 1 / o); const S = pi.reduce((a, b) => a + b, 0);
  if (!(S > 1.0001)) return pi.map(p => p / S); // no margin to remove (e.g. an exchange)
  const pAt = (z, q) => (Math.sqrt(z * z + 4 * (1 - z) * q * q / S) - z) / (2 * (1 - z));
  const sumAt = z => pi.reduce((s, q) => s + pAt(z, q), 0);
  let lo = 0, hi = 0.5;
  if (sumAt(hi) > 1) return pi.map(p => p / S); // no root in range: fall back to proportional
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (sumAt(mid) > 1) lo = mid; else hi = mid; }
  const z = (lo + hi) / 2;
  const p = pi.map(q => pAt(z, q)); const t = p.reduce((a, b) => a + b, 0);
  return p.map(v => v / t);
}
// Fair probabilities for every side of one market slot, from sharp books that quote ALL its sides.
// This is ONLY a plausibility filter: it decides which quotes may compete to be the best price. It never
// replaces the arb test (sum of 1/price over the chosen legs < 1), which still uses the actual quotes.
// A quote is judged against the MORE LENIENT of the two methods, so only prices absurd under both are dropped.
function sharpAnchor(slot) {
  const sideKeys = Object.keys(slot.all);
  if (sideKeys.length < 2) return null;
  const perBook = [];
  for (const sb of ANCHOR_SHARPS) {
    const odds = [];
    for (const sk of sideKeys) {
      const qs = (slot.all[sk] || []).filter(r => r.book === sb);
      if (!qs.length) break;
      odds.push(Math.max(...qs.map(r => r.price)));
    }
    if (odds.length !== sideKeys.length) continue;
    const S = odds.reduce((s, o) => s + 1 / o, 0);
    if (!(S > 0.97 && S < 1.12)) continue; // a sharp book's own overround must look sane
    perBook.push({ book: sb, prop: proportionalProbs(odds), shin: shinProbs(odds) });
  }
  if (!perBook.length) return null;
  const avg = key => sideKeys.map((_, i) => perBook.reduce((s, b) => s + b[key][i], 0) / perBook.length);
  const prop = avg('prop'), shin = avg('shin');
  const fair = {}, propBy = {}, shinBy = {};
  sideKeys.forEach((k, i) => { propBy[k] = prop[i]; shinBy[k] = shin[i]; fair[k] = Math.min(prop[i], shin[i]); });
  return { books: perBook.map(b => b.book), fair, prop: propBy, shin: shinBy };
}

// ── QUOTE FRESHNESS ─────────────────────────────────────────────────────────
// Every leg of an arb has its OWN "last updated" time (the-odds-api sends
// last_update per bookmaker and per market; OddsPapi quotes are mapped to the
// same field in lib/oddspapi.js when it exposes one). Fake arbs are very often
// just one stale leg next to a fresh one: the other book already moved, this
// one hasn't refreshed. A leg with no timestamp is "unknown", never "fresh".
const PRE_STALE_MS  = 15 * 60 * 1000; // pre-match: a leg whose BOOK last changed it this long ago gets flagged for review
// How long a price may sit unchanged before that is suspicious. For a game days away, hours without a change is
// normal; the same silence a few hours before kickoff is not. So the tolerance is 5% of the time left to kickoff,
// never under PRE_STALE_MS and never over 6 h.
const BOOK_TOL_FRACTION = 0.05;
const BOOK_TOL_MAX_MS   = 6 * 60 * 60 * 1000;
function bookToleranceMs(msToKickoff) { return Math.min(BOOK_TOL_MAX_MS, Math.max(PRE_STALE_MS, BOOK_TOL_FRACTION * Math.max(0, msToKickoff || 0))); }
// Two kinds of timestamp (quote.updatedKind):
//   'book' = the bookmaker's own last-change time (Odds API last_update): the price really was set then.
//   'pull' = when WE fetched it (OddsPapi / SportyBet / 22bet / Betano): the book may have changed it since.
// Pull-time legs are the ones that can silently go stale, so they get tighter limits and the user is
// shown the pull time and the minimum odds at which the arb still works. No extra API calls needed.
const PULL_MAX_AGE_MS    = 6 * 60 * 1000;  // every source is cached for 5 min, so a pulled leg older than 6 min -> review
const PULL_SPREAD_MS     = 5 * 60 * 1000;  // pulled legs fetched more than one 5-min window apart -> review (one may have moved)
const ARB_EXPIRE_MS      = 12 * 60 * 1000; // 5-min cache + the 5-min auto-rescan + slack; older (tab left open) -> expired, hidden until rescan
const CONFIRMED_FRESH_MS = 5 * 60 * 1000;  // a manual live re-check counts as verification for this long
const isArbExpired = a => !!a.pulledAtMs && Date.now() - a.pulledAtMs > ARB_EXPIRE_MS;
// Lowest odds each leg can drop to before the set stops being an arb (other legs unchanged).
function minOddsFor(outs) {
  return outs.map((o, i) => {
    const others = outs.reduce((s, p, j) => (j === i ? s : s + 1 / p.price), 0);
    return others < 1 ? Math.ceil((1 / (1 - others)) * 100) / 100 : null;
  });
}
// ── PROFIT CAP, ARB AGE, USER REPORTS ───────────────────────────────────────
// Real arbs between books are usually small; a very large one is far more often a
// bad price than a gift. So arbs above DEFAULT_MAX_PROFIT are hidden by default
// (one tap shows them) — hidden, not deleted, so a genuine one is never lost.
const DEFAULT_MAX_PROFIT = 10; // %
// Arb age = how long the same arb (same legs, same prices) has been seen in
// consecutive scans on THIS device. Real edges are usually closed within minutes;
// a big one that just sits there is more likely stale data. Heuristic only — it
// adds a warning, it never removes the arb.
const PERSIST_SUSPICIOUS_MS = 30 * 60 * 1000;
// The four report reasons Surebet uses. A report hides the affected leg's
// fixture (or the whole arb) for this user until it expires. "Odds differ" is
// short-lived because prices move; the others describe a wrong link/match and
// last longer.
const REPORT_REASONS = [
  { key: 'event_not_found',  label: 'Event not found',           ttlHours: 24 * 7 },
  { key: 'odds_different',   label: 'Odds have different values', ttlHours: 6 },
  { key: 'wrong_markets',    label: 'Wrong markets',             ttlHours: 24 * 7 },
  { key: 'different_teams',  label: 'Different teams',           ttlHours: 24 * 7 },
];
// Identifies one book's record of one match. Uses the book's own fixture id when the
// feed gives one, otherwise falls back to match + kickoff.
function legKey(arb, o) {
  return o.book + ':' + (o.fixtureRef ? o.fixtureRef : arb.match + '|' + arb.commenceTime);
}
// Manual-check link (OddsPapi fixturePath, e.g. https://22bet.com/line/369147714). It comes from third-party data, so only a
// plain https link to a 22bet host is ever put in an <a href>; anything else is ignored. Prefers the link carried from the scan,
// falls back to the one a live re-check returned for the same leg.
const SAFE_22BET_LINK = /^https:\/\/(?:[a-z0-9-]+\.)*22bet\.(?:com|net|org|info|[a-z]{2}|(?:com|co)\.[a-z]{2})(?:[\/?#]|$)/i;
function legManualLink(o, rc) {
  if (!o || o.book !== '22bet') return null;
  const fromRecheck = rc && rc.legs && (rc.legs.find(l => l.book === o.book && l.label === o.label) || {}).link;
  const url = o.fixtureUrl || fromRecheck;
  return typeof url === 'string' && SAFE_22BET_LINK.test(url) ? url : null;
}
const normLabel = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const KICKOFF_DIFF_MS = 15 * 60 * 1000; // a book's kickoff this far from the merged event's gets flagged
function fmtAgeShort(ms) {
  const m = Math.floor(ms / 60000);
  return m < 1 ? 'new this scan' : m < 90 ? m + ' min' : (m / 60).toFixed(1) + ' h';
}

const LIVE_MAX_AGE_MS = 2 * 60 * 1000; // in-play prices go stale in seconds: any leg older than this -> excluded

function parseQuoteTime(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v > 1e12 ? v : v > 1e9 ? v * 1000 : null;
  const t = Date.parse(v);
  return isNaN(t) ? null : t;
}
function fmtAge(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 90 ? s + 's' : s < 5400 ? Math.round(s / 60) + ' min' : (s / 3600).toFixed(1) + ' h';
}

function medianOf(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Cross-checks one arb against every OTHER bookmaker quoting the same slot
// (same market, same home-perspective line, same side). Can't prove a price
// is bookable — only a fresh look at the book can — but it separates the two
// cases that need different action:
//   - one leg far above the others  -> possible genuine pricing error; verify THAT leg
//   - every leg matches consensus but the set still arbs -> the market/line is
//     probably mislabelled, i.e. a bug, not a bet
function assessArb(slot, outs, margin, ev) {
  const reasons = [];
  const sideCount = outs.length;

  // Quote freshness (constants above). In-play prices move in seconds, so a
  // stale leg there is excluded outright; pre-match a stale leg, or legs
  // refreshed far apart, are flagged for review rather than dropped, because
  // quiet pre-match markets can legitimately sit unchanged for a while.
  const nowMs = Date.now();
  const startMs = ev && ev.commence_time ? new Date(ev.commence_time).getTime() : NaN;
  const inPlay = !isNaN(startMs) && startMs <= nowMs;
  const aged = outs.filter(o => typeof o.updatedMs === 'number').map(o => ({ o, age: Math.max(0, nowMs - o.updatedMs) }));
  if (inPlay) {
    const tooOld = aged.filter(a => a.age > LIVE_MAX_AGE_MS);
    if (tooOld.length) {
      return {
        level: 'excluded',
        reasons: ['in-play, but ' + tooOld.map(a => a.o.displayLabel + ' (' + a.o.bookName + ') was last updated ' + fmtAge(a.age) + ' ago').join(' and ') + ' — live prices move in seconds, so these legs are not from the same moment'],
      };
    }
    if (aged.length < outs.length) reasons.push('in-play arb — ' + (outs.length - aged.length) + ' leg(s) carry no quote timestamp, so their freshness is unknown');
  } else {
    // Pre-match. Every leg needs a timestamp: "unknown" is never "fresh".
    const noStamp = outs.length - aged.length;
    if (noStamp > 0) reasons.push(noStamp + ' leg(s) carry no timestamp, so their age is unknown');
    const bookTol = bookToleranceMs(isNaN(startMs) ? 0 : startMs - nowMs);
    // (1) The BOOK's own last-change time (Odds API last_update, SportyBet lastOddsChangeTime). If the source was
    // fetched recently, an old change time just means the price has been stable, so the tolerance scales with
    // time to kickoff (see bookToleranceMs).
    const bookAged = aged.filter(a => a.o.updatedKind === 'book');
    const stale = bookAged.filter(a => a.age > bookTol);
    stale.forEach(a => reasons.push(a.o.displayLabel + ' @ ' + a.o.price + ' (' + a.o.bookName + ') last changed ' + fmtAge(a.age) + ' ago — longer than expected this close to kickoff (' + fmtAge(bookTol) + '); it may be stale'));
    if (bookAged.length >= 2 && stale.length === 0) {
      const ages = bookAged.map(a => a.age);
      const spread = Math.max(...ages) - Math.min(...ages);
      if (spread > bookTol) reasons.push('legs last changed ' + fmtAge(spread) + ' apart — the older price may already have moved');
    }
    // (2) When WE fetched each leg (every cache is 5 min). Applies to every cached WA source, SportyBet included.
    const pulled = outs.filter(o => typeof o.pulledMs === 'number').map(o => ({ o, age: Math.max(0, nowMs - o.pulledMs) }));
    pulled.filter(p => p.age > PULL_MAX_AGE_MS).forEach(p => reasons.push(p.o.displayLabel + ' @ ' + p.o.price + ' (' + p.o.bookName + ') was fetched ' + fmtAge(p.age) + ' ago — the book may have changed it since'));
    if (pulled.length >= 2) {
      const ps = pulled.map(p => p.age);
      if (Math.max(...ps) - Math.min(...ps) > PULL_SPREAD_MS) reasons.push('legs were fetched ' + fmtAge(Math.max(...ps) - Math.min(...ps)) + ' apart — the older price may already have moved');
    }
  }

  // A single book pricing both sides of the same line below 100% is a data error.
  const perBook = {};
  for (const [side, quotes] of Object.entries(slot.all)) {
    for (const q of quotes) {
      perBook[q.book] = perBook[q.book] || {};
      perBook[q.book][side] = Math.max(perBook[q.book][side] || 0, q.price);
    }
  }
  for (const [book, sides] of Object.entries(perBook)) {
    const ps = Object.values(sides);
    if (ps.length === sideCount && ps.reduce((sum, p) => sum + 1 / p, 0) < 1) {
      reasons.push(book + ' prices this whole market under 100% by itself — likely a parsing error');
    }
  }

  let outliers = 0, uncheckable = 0;
  const multiOutlierRatiosByBook = {}; // book -> ratios of legs in THIS arb that clear the stricter bound
  for (const o of outs) {
    const others = (slot.all[o.sideKey] || []).filter(q => q.book !== o.book).map(q => q.price);
    if (others.length < 2) { uncheckable++; continue; }
    const med = medianOf(others);
    const ratio = o.price / med;
    const spread = relativeSpread(others);
    const adaptiveThreshold = 1 + Math.max(OUTLIER_MIN_DEVIATION, OUTLIER_SPREAD_MULTIPLIER * spread);
    if (ratio > adaptiveThreshold) {
      outliers++;
      // No margin gate — a wrong single leg produces a low, believable margin
      // just as often as a high one, so this needs to surface either way.
      const tightness = spread < 0.05 ? ' (other books tightly agree, within ' + Math.round(spread * 100) + '%)' : '';
      reasons.push(o.displayLabel + ' @ ' + o.price + ' (' + o.bookName + ') is ' + Math.round((ratio - 1) * 100) + '% above other books (median ' + med.toFixed(2) + ')' + tightness + ' — verify this leg first');
    }
    if (ratio > MULTI_OUTLIER_RATIO) {
      (multiOutlierRatiosByBook[o.book] = multiOutlierRatiosByBook[o.book] || []).push(ratio);
    }
  }

  for (const [book, ratios] of Object.entries(multiOutlierRatiosByBook)) {
    if (ratios.length >= MULTI_OUTLIER_MIN_LEGS) {
      return {
        level: 'excluded',
        kind: 'multi-outlier',   // findArbs keeps these as 'review' (hidden, viewable) when the margin is under FLAGGED_KEEP_MARGIN
        reasons: [book + ' prices ' + ratios.length + ' legs of this market simultaneously at ' +
          ratios.map(r => '+' + Math.round((r - 1) * 100) + '%').join(' and ') +
          ' above consensus — a real repricing moves one side, not several unrelated outcomes at once; looks like broken data for this match on ' + book + ', not a real price'],
      };
    }
  }

  // No margin gate here either — a mislabelled market or a thin-book arb is
  // just as real a concern at 2% margin as at 8%.
  // Duplicate odds: a leg whose book listed this selection at several prices (we used its 2nd best) is never 'clean'.
  outs.filter(o => o.dup).forEach(o => reasons.push(o.displayLabel + ' (' + o.bookName + ') was listed at ' + o.dupPrices.join(' / ') + ' by the same book; used ' + o.price + (o.price === Math.max(...o.dupPrices) ? ' (its highest)' : ' (2nd best)') + ' — verify which one is the real full-time price'));
  // Every leg was already chosen because at least one other book agrees with it (rank-based selection in findArbs),
  // so with no sharp book the books agreeing with each other are the reference. A leg only needs the minimum below.
  // Arbs at or under RANK_RULE_MIN_MARGIN are left as priced, so they are not demoted for lack of agreeing books.
  if (!slot.anchor && margin > RANK_RULE_MIN_MARGIN) {
    const weak = outs.filter(o => (o.agreeBooks || []).length < CLEAN_MIN_AGREE_NO_ANCHOR);
    if (weak.length) reasons.push('no sharp-book price and ' + weak.map(o => o.displayLabel + ' (' + o.bookName + ')').join(', ') + ' has too few agreeing books to cross-check against');
    // A set that matches consensus yet arbs is normal at a small margin (that is what a real small arb looks like).
    // Only a big one, with nothing to anchor it, points at a mislabelled market.
    else if (outliers === 0 && margin > MISLABEL_MARGIN) reasons.push('every leg matches other books yet the set arbs by ' + margin + '% — market or line is probably mislabelled');
  }
  return { level: reasons.length ? 'review' : 'standard', reasons };
}

// Bet Analyzer: real prices for one fixture, from the latest scan. /api/fixtures has no odds and the
// Analyze button used to send odds: 0 for every outcome, so the AI answered "no price to evaluate".
// Matches the fixture to a scanned event (normalised team names, kickoff within 12h) and returns, per
// side, the best price across accessible books plus the median price and how many books quote it
// (the server uses median as the market consensus to measure edge). null = not in the scan / no prices.
function findScannedOddsForGame(game, events, userRegion) {
  const h = normaliseTeamName(game.homeTeam), a = normaliseTeamName(game.awayTeam);
  if (!h || !a) return null;
  const gt = new Date(game.commenceTime).getTime();
  const ev = (events || []).find(e2 => {
    if (normaliseTeamName(e2.home_team) !== h || normaliseTeamName(e2.away_team) !== a) return false;
    const et = new Date(e2.commence_time).getTime();
    return isNaN(gt) || isNaN(et) || Math.abs(et - gt) < 12 * 3600 * 1000;
  });
  if (!ev) return null;
  const side = { __home__: [], __draw__: [], __away__: [] };
  for (const bm of (ev.bookmakers || [])) {
    if (!isBookAccessible(bm.key, userRegion)) continue;
    const name = (BOOKS[bm.key] && BOOKS[bm.key].name) || bm.title || bm.key;
    for (const mkt of (bm.markets || [])) {
      if (mkt.key !== 'h2h') continue;
      for (const o of (mkt.outcomes || [])) {
        const sd = resolveSide(o.name, ev, bm);
        if (sd && typeof o.price === 'number' && o.price > 1) side[sd].push({ price: o.price, book: name });
      }
    }
  }
  const summarise = (label, arr) => {
    if (!arr.length) return null;
    const bestRow = arr.reduce((x, y) => (y.price > x.price ? y : x));
    return { label, odds: bestRow.price, bookName: bestRow.book, medianOdds: medianOf(arr.map(r => r.price)), bookCount: arr.length };
  };
  const home = summarise(game.homeTeam, side.__home__), draw = summarise('Draw', side.__draw__), away = summarise(game.awayTeam, side.__away__);
  if (!home || !away) return null;
  return [home, ...(draw ? [draw] : []), away];
}

let LAST_ARB_DIAG = null; // written by the latest GLOBAL findArbs() call; copied into scanHealth so it shows in the app
function findArbs(events, mode = 'global', userRegion = null) {
  const arbs = [];
  // Coverage diagnostic, per book: quotes used, quotes dropped because the team name could not be resolved to home/away,
  // and quotes rescued by the book's own event names. Logged once per global scan as '[findArbs] coverage'.
  const cov = {};
  const covOf = k => (cov[k] = cov[k] || { quotes: 0, unresolved: 0, rescued: 0, unresolvedNames: [] });
  // Duplicate-odds diagnostic: which book lists the same slot+side at several prices, in which market, with what prices.
  const dupDiag = {};
  const consensusDiag = {};        // book -> { high, thin, examples } for legs the consensus filter rejected
  const consensusSeen = new Set(); // so a quote rejected in both the plain and rank pass is counted once
  // A book's outcome names come from the same feed as its srcEvent (that feed's own home/away names, matched to this
  // event by the server). So when the global-name lookup fails, resolve against the book's OWN names instead of
  // silently dropping the quote.
  const sideFor = (o, bm, ev) => {
    const direct = resolveSide(o.name, ev);
    if (direct) return direct;
    const c = covOf(bm.key);
    const se = bm.srcEvent;
    if (se && se.home && se.away) {
      const r = normaliseOutcome(o.name, se.home, se.away);
      if (r === '__home__' || r === '__away__' || r === '__draw__') { c.rescued++; return r; }
    }
    c.unresolved++;
    if (c.unresolvedNames.length < 4) c.unresolvedNames.push(String(o.name) + ' @ ' + ev.home_team + ' v ' + ev.away_team);
    return null;
  };
  const SIDE_ORDER = { __home__: 0, over: 0, __draw__: 1, under: 1, __away__: 2 };
  for (const ev of events) {
    if (!ev.bookmakers || ev.bookmakers.length < 2) continue;
    const isSoccer = typeof ev.sport_key === 'string' && ev.sport_key.startsWith('soccer');

    // A valid arb needs ALL legs from the same market AND the same line, with
    // legs that are genuine complements of each other:
    //   h2h     -> home / (draw) / away
    //   totals  -> Over X / Under X          (same point)
    //   spreads -> home at line L / away at -L (grouped by the HOME-perspective
    //              line, so home -0.25 and away +0.25 share one slot)
    // Outcomes are keyed by resolved side, not raw name, so two spellings of
    // one team can never appear as two separate legs.
    // Pass 1: collect every quote. Pass 2: build slots, ignoring any bookmaker
    // that quotes the SAME slot+side at two different prices — that means the
    // feed leaked more than one market (half-time, early-payout, team total…)
    // into this slot and we can't tell which one is the real full-time price.
    // Skipping is safe; guessing (or taking the max) is how fake arbs appear.
    const quotes = [];
    for (const bm of ev.bookmakers) {
      // Every book is a COMPARATOR (feeds slot.all, so Pinnacle/Betfair can expose a bad price);
      // only accessible books may be an arb LEG (slot.best). Previously WA mode dropped non-accessible
      // books entirely, so WA arbs had too few comparators and showed as "uncheckable".
      const bookable = mode !== 'wa' || isBookAccessible(bm.key, userRegion);
      // Selections two sources of the SAME book disagreed on (odds.js crossCheckBook) are kept out of bm.markets so
      // no other finder can use either price, but both prices come back here as duplicate quotes of that book.
      const disputedMkts = (bm.disputed || []).flatMap(d => (d.prices || []).map(p => ({ key: d.mktKey, marketName: d.marketName, outcomes: [{ name: d.name, price: p, point: d.point }] })));
      for (const mkt of [...(bm.markets || []), ...disputedMkts]) {
        if (!['h2h', 'spreads', 'totals', 'outrights'].includes(mkt.key)) continue;
        for (const o of mkt.outcomes) {
          if (!(o.price > 1)) continue;
          let slotKey, sideKey, line = null;
          let displayLabel = o.name;
          let marketLabel = 'Match Winner';

          covOf(bm.key).quotes++;
          if (mkt.key === 'h2h') {
            const side = sideFor(o, bm, ev);
            if (!side) continue;
            slotKey = 'h2h'; sideKey = side;
            displayLabel = side === '__home__' ? ev.home_team : side === '__away__' ? ev.away_team : 'Draw';
          } else if (mkt.key === 'spreads') {
            const side = sideFor(o, bm, ev);
            if (side !== '__home__' && side !== '__away__') continue;
            if (typeof o.point !== 'number') continue;
            line = side === '__home__' ? o.point : -o.point;
            slotKey = 'spreads_' + line; sideKey = side;
            marketLabel = 'Asian Handicap';
            const team = side === '__home__' ? ev.home_team : ev.away_team;
            displayLabel = team + ' (' + (o.point > 0 ? '+' : '') + o.point + ')';
          } else if (mkt.key === 'totals') {
            const n = String(o.name || '').trim().toLowerCase();
            if (n !== 'over' && n !== 'under') continue;
            if (typeof o.point !== 'number') continue;
            line = o.point;
            const variant = totalsVariant(mkt);
            slotKey = 'totals_' + variant + '_' + line; sideKey = n;   // a differently-named totals market never shares a slot with full-time totals
            marketLabel = variant === 'fulltime' ? 'Over/Under' : titleCase(variant);
            displayLabel = (n === 'over' ? 'Over' : 'Under') + ' ' + o.point;
          } else {
            slotKey = 'outrights'; sideKey = o.name;
            marketLabel = 'Outright';
          }
          quotes.push({ slotKey, sideKey, line, mktKey: mkt.key, book: bm.key, bookName: bm.title, price: o.price, bookable, displayLabel, marketLabel, point: o.point ?? null, fixtureRef: bm.bookmakerFixtureId || bm.eventId || null, fixtureUrl: bm.fixturePath || null, updatedMs: parseQuoteTime(o.last_update || mkt.last_update || bm.last_update), updatedKind: (o.last_update || mkt.last_update || bm.last_update_kind !== 'pull') ? 'book' : 'pull', pulledMs: bm.last_update_kind === 'pull' ? parseQuoteTime(bm.last_update) : null, srcEvent: bm.srcEvent || null, ownFeed: bm.feedPipeline === 'wa' });
          noteUnprofiled(bm);
        }
      }
    }

    // DUPLICATE ODDS: one book quoting the SAME slot+side at several different prices means its feed leaked
    // more than one market (half-time, early-payout, team total...) into this slot. Skipping the book lost real
    // arbs and taking its highest price is how fake ones appear, so we take that book's DUP_RANK-th best price
    // (0 = best, 1 = 2nd best, ...; capped at its lowest) and mark the quote 'dup' so assessArb flags it.
    const dupGroups = {};
    for (const q of quotes) {
      const k = q.slotKey + '|' + q.sideKey + '|' + q.book;
      (dupGroups[k] = dupGroups[k] || []).push(q);
    }
    const marketSlots = {};
    for (const g of Object.values(dupGroups)) {
      const prices = [...new Set(g.map(x => x.price))].sort((a, b) => b - a);
      if (prices.length > 1) {
        const d = (dupDiag[g[0].book] = dupDiag[g[0].book] || { groups: 0, byMarket: {}, examples: [] });
        d.groups++;
        d.byMarket[g[0].mktKey] = (d.byMarket[g[0].mktKey] || 0) + 1;
        if (d.examples.length < 3) d.examples.push(g[0].mktKey + (g[0].line != null ? ' ' + g[0].line : '') + ' ' + g[0].sideKey + ' [' + prices.join(' / ') + '] @ ' + ev.home_team + ' v ' + ev.away_team);
      }
      const picked = prices[Math.min(DUP_RANK, prices.length - 1)];
      const q = { ...g.find(x => x.price === picked), dup: prices.length > 1, dupPrices: prices };
      if (!marketSlots[q.slotKey]) marketSlots[q.slotKey] = { mktKey: q.mktKey, line: q.line, best: {}, bestPlain: {}, all: {} };
      const slot = marketSlots[q.slotKey];
      (slot.all[q.sideKey] = slot.all[q.sideKey] || []).push({ book: q.book, price: q.price, ownFeed: q.ownFeed, mktKey: q.mktKey });
      if (q.bookable) {
        (slot.cands = slot.cands || []).push(q); // comparator-only books never become legs
        // Untouched version for the low-margin path below: the book's highest price, whatever the rank rule would pick.
        (slot.candsPlain = slot.candsPlain || []).push({ ...g.find(x => x.price === prices[0]), dup: prices.length > 1, dupPrices: prices });
      }
    }

    const noteConsensusReject = (ev2, slot2, q, cc) => {
      const key = ev2.id + '|' + q.slotKey + '|' + q.sideKey + '|' + q.book + '|' + q.price;
      if (consensusSeen.has(key)) return;
      consensusSeen.add(key);
      const d = (consensusDiag[q.book] = consensusDiag[q.book] || { high: 0, thin: 0, examples: [] });
      d[cc.reason]++;
      if (d.examples.length < 3) d.examples.push((cc.strict ? '[strict 1X2] ' : '') + q.mktKey + (q.line != null ? ' ' + q.line : '') + ' ' + q.sideKey + ' @' + q.price + (cc.reason === 'high' ? ' vs median ' + cc.med.toFixed(2) + ' (+' + Math.round((cc.ratio - 1) * 100) + '%)' : ' (only ' + cc.nOthers + ' other book(s))') + ' @ ' + ev2.home_team + ' v ' + ev2.away_team);
    };

    // BEST-PRICE SELECTION WITH A FAIR-VALUE ANCHOR.
    // Taking the highest price per side across many books picks the most wrong one (stale price, parse
    // error): drop that book and the next-most-wrong takes over. So a candidate leg must first be
    // CREDIBLE: no more than ANCHOR_MAX_DEV above the no-vig price implied by the sharp books
    // (Pinnacle/Betfair/...) for the same market. Implausible prices never become legs, whichever
    // books are in the scan. No sharp price for the market -> no anchor -> assessArb marks it review.
    //
    // RANK-BASED LEG SELECTION (1st / 2nd / 3rd best). The highest price on a side is the one most likely to be
    // wrong, so it only becomes the leg if at least one OTHER book (any book in the scan, comparators included)
    // quotes the same selection within AGREE_TOL of it. If the best price stands alone, the 2nd best is tried,
    // then the 3rd (RANK_DEPTH). A side with no corroborated price in its top RANK_DEPTH gets no leg, so the
    // slot cannot form an arb from an unconfirmed price. This is how the four WA books (SportyBet, 22Bet,
    // Betano, Betway) check each other, with Pinnacle/Betfair etc. adding extra agreement where present.
    for (const slot of Object.values(marketSlots)) {
      slot.anchor = sharpAnchor(slot);
      // LOW-MARGIN PATH: plain highest credible price per side, no rank rule. An arb this small is what real
      // pre-match arbs look like, so when the plain legs give <= RANK_RULE_MIN_MARGIN the rank rule is not applied
      // (see the check below). Still anchor-filtered; agreeBooks is computed for display only.
      const plainBySide = {};
      for (const q of (slot.candsPlain || [])) {
        const cc = consensusCheck(slot, q);
        if (!cc.ok) { noteConsensusReject(ev, slot, q, cc); continue; }
        const fp = slot.anchor ? slot.anchor.fair[q.sideKey] : null;
        if (fp && q.price * fp > 1 + ANCHOR_MAX_DEV) continue;
        if (!plainBySide[q.sideKey] || q.price > plainBySide[q.sideKey].price) plainBySide[q.sideKey] = q;
      }
      for (const [sideKey, q] of Object.entries(plainBySide)) {
        const agree = (slot.all[sideKey] || []).filter(p => p.book !== q.book && Math.abs(p.price - q.price) / Math.min(p.price, q.price) <= AGREE_TOL);
        slot.bestPlain[sideKey] = { sideKey, price: q.price, book: q.book, bookName: q.bookName, displayLabel: q.displayLabel, marketLabel: q.marketLabel, marketKey: q.mktKey, point: q.point, fixtureRef: q.fixtureRef, fixtureUrl: q.fixtureUrl, updatedMs: q.updatedMs, srcEvent: q.srcEvent, updatedKind: q.updatedKind, pulledMs: q.pulledMs,
          ownFeed: q.ownFeed, rankUsed: 1, agreeBooks: agree.map(p => p.book), dup: !!q.dup, dupPrices: q.dup ? q.dupPrices : null };
      }
      const bySide = {};
      for (const q of (slot.cands || [])) {
        const cc = consensusCheck(slot, q);
        if (!cc.ok) { noteConsensusReject(ev, slot, q, cc); continue; }
        const fp = slot.anchor ? slot.anchor.fair[q.sideKey] : null;
        if (fp && q.price * fp > 1 + ANCHOR_MAX_DEV) { slot.rejected = (slot.rejected || 0) + 1; continue; }
        (bySide[q.sideKey] = bySide[q.sideKey] || []).push(q);
      }
      for (const [sideKey, list] of Object.entries(bySide)) {
        const ranked = list.sort((a, b) => b.price - a.price);
        for (let r = 0; r < Math.min(RANK_DEPTH, ranked.length); r++) {
          const q = ranked[r];
          const agree = (slot.all[sideKey] || []).filter(p => p.book !== q.book && Math.abs(p.price - q.price) / Math.min(p.price, q.price) <= AGREE_TOL);
          if (!agree.some(p => canVouch(q, p))) { slot.uncorroborated = (slot.uncorroborated || 0) + 1; continue; }
          slot.best[sideKey] = { sideKey, price: q.price, book: q.book, bookName: q.bookName, displayLabel: q.displayLabel, marketLabel: q.marketLabel, marketKey: q.mktKey, point: q.point, fixtureRef: q.fixtureRef, fixtureUrl: q.fixtureUrl, updatedMs: q.updatedMs, srcEvent: q.srcEvent, updatedKind: q.updatedKind, pulledMs: q.pulledMs,
            ownFeed: q.ownFeed, rankUsed: r + 1, agreeBooks: agree.map(p => p.book), dup: !!q.dup, dupPrices: q.dup ? q.dupPrices : null };
          break;
        }
      }
    }

    // Check each market slot independently for an arb
    // Returns the sorted legs of a slot from one leg set (slot.bestPlain or slot.best), or null if the set is not a
    // complete, genuinely cross-book hedge.
    const legsFor = (slot, set) => {
      const sides = Object.keys(set);
      const has = s => sides.includes(s);

      // Completeness: the slot must contain exactly the complementary legs.
      // A partial set (e.g. soccer home+away with no draw) can sum below 1
      // without being a real hedge.
      if (slot.mktKey === 'h2h') {
        const threeWay = isSoccer || has('__draw__');
        if (threeWay ? !(has('__home__') && has('__draw__') && has('__away__')) : !(has('__home__') && has('__away__'))) return null;
      } else if (slot.mktKey === 'spreads') {
        if (!(has('__home__') && has('__away__') && sides.length === 2)) return null;
      } else if (slot.mktKey === 'totals') {
        if (!(has('over') && has('under') && sides.length === 2)) return null;
      } else if (sides.length < 2) return null;

      const legs = Object.values(set)
        .sort((a, b) => (SIDE_ORDER[a.sideKey] ?? 0) - (SIDE_ORDER[b.sideKey] ?? 0));

      // All legs at one bookmaker is not a cross-book arb — it means a
      // parsing/labelling error (this is exactly how the same-sign AH bug showed).
      if (new Set(legs.map(o => bookGroup(o.book))).size < 2) return null;
      return legs;
    };

    for (const slot of Object.values(marketSlots)) {
      // MARGIN-GATED RANK RULE. First price the slot with the plain highest credible price per side. If that
      // is not an arb, nothing below can be (rank legs are never higher), so skip. If the plain margin is
      // <= RANK_RULE_MIN_MARGIN the arb is left exactly as priced (small arbs are believable). Above that, a
      // price this good is more likely a wrong odd, so the legs are re-picked with the rank rule (1st/2nd/3rd
      // best that another book agrees with; a duplicated price uses its 2nd best) and must still arb.
      let outs = legsFor(slot, slot.bestPlain);
      let rule = 'plain';
      if (outs) {
        const impPlain = outs.reduce((s, o) => s + 1 / o.price, 0);
        if (!(impPlain < 1)) continue;
        const plainMargin = (1 - impPlain) / impPlain * 100;
        if (plainMargin > RANK_RULE_MIN_MARGIN) { outs = legsFor(slot, slot.best); rule = 'rank'; }
      }
      if (!outs) continue;

      const imp = outs.reduce((s, o) => s + 1 / o.price, 0);
      if (imp < 1) {
        const margin = parseFloat((((1 - imp) / imp) * 100).toFixed(2));
        let verify = assessArb(slot, outs, margin, ev);
        // Flagged arbs under FLAGGED_KEEP_MARGIN are never thrown away: a multi-outlier flag at this size stays in
        // the hidden 'review' tier (viewable with "Show review arbs"). In-play stale-leg exclusions still drop, because
        // those prices genuinely cannot be bet together.
        if (verify.level === 'excluded' && verify.kind === 'multi-outlier' && margin < FLAGGED_KEEP_MARGIN) verify = { level: 'review', reasons: verify.reasons };
        if (verify.level === 'excluded') { console.warn('[findArbs] excluded (multi-outlier)', margin + '%', ev.home_team, 'vs', ev.away_team, slot.mktKey, slot.line, verify.reasons); continue; }
        if (verify.level === 'review') console.warn('[findArbs] review flag', margin + '%', ev.home_team, 'vs', ev.away_team, slot.mktKey, slot.line, verify.reasons);
        // Per-book trust: a leg from a feed not yet verified for this market keeps the arb visible but moves it to 'review'.
        const unverifiedLegs = outs.filter(o => !feedVerified(o.book, o.ownFeed, o.marketKey));
        if (unverifiedLegs.length) {
          verify = { ...verify, level: 'review', reasons: [...(verify.reasons || []), 'Unverified feed: ' + unverifiedLegs.map(o => (o.bookName || o.book) + ' ' + (o.marketLabel || o.marketKey)).join(', ') + ' (not yet checked against the book\'s own site). Confirm the price on the book before staking'] };
        }
        const minOdds = minOddsFor(outs);
        const pullTimes = outs.filter(o => typeof o.pulledMs === 'number').map(o => o.pulledMs);
        const foundAtMs = Date.now();
        arbs.push({
          id: ev.id + '_' + slot.mktKey + (slot.line != null ? '_' + slot.line : ''),
          foundAtMs,
          anchorBooks: slot.anchor ? slot.anchor.books : null,
          // Oldest fetch time among legs we pulled ourselves; otherwise the scan time. Drives expiry and the on-card age.
          pulledAtMs: pullTimes.length ? Math.min(...pullTimes) : foundAtMs,
          sport: ev.sport_key,
          match: ev.home_team + ' vs ' + ev.away_team,
          commenceTime: ev.commence_time,
          margin,
          rule,   // 'plain' = plain best prices (margin <= RANK_RULE_MIN_MARGIN); 'rank' = 1st/2nd/3rd best rule applied
          verify,
          // 'clean' = every leg cross-checked against >=2 other books, fresh, no flags; otherwise 'review'
          // (hidden in the UI unless opened). A live re-check that returns 'confirmed' promotes it.
          tier: verify.level === 'standard' ? 'clean' : 'review',
          home: ev.home_team,
          away: ev.away_team,
          outcomes: outs.map((o, oi) => ({
            minOdds: minOdds[oi],
            fairDev: slot.anchor && slot.anchor.fair[o.sideKey] ? o.price * slot.anchor.fair[o.sideKey] - 1 : null,
            updatedKind: o.updatedKind,
            side: o.sideKey,
            label: o.displayLabel,
            marketLabel: o.marketLabel,
            marketKey: o.marketKey,
            point: o.point,
            book: o.book,
            bookName: o.bookName,
            odds: o.price,
            rankUsed: o.rankUsed || 1,                 // 1 = best price on this side, 2/3 = best was uncorroborated so a lower one was used
            agreeBooks: o.agreeBooks || [],
            feedVerified: feedVerified(o.book, o.ownFeed, o.marketKey),            // other books quoting this selection within AGREE_TOL
            dup: !!o.dup,
            fixtureRef: o.fixtureRef,
            fixtureUrl: o.fixtureUrl || null,
            updatedAt: o.updatedMs || null,
            srcLabel: o.srcEvent ? o.srcEvent.home + ' vs ' + o.srcEvent.away : null,
            srcStart: o.srcEvent ? o.srcEvent.start : null,
          }))
        });
      }
    }
  }
  if (mode === 'global') {
    try {
      const bad = Object.entries(cov).filter(([, c]) => c.unresolved > 0 || c.rescued > 0);
      console.log('[findArbs] coverage (quotes per book):', Object.entries(cov).map(([k, c]) => k + '=' + c.quotes).join(' '));
      const dupBooks = Object.entries(dupDiag);
      LAST_ARB_DIAG = {
        at: Date.now(),
        dups: dupDiag,
        consensus: consensusDiag,
        unresolved: Object.fromEntries(bad.map(([k, c]) => [k, { unresolved: c.unresolved, rescuedByOwnNames: c.rescued, examples: c.unresolvedNames }])),
        quotes: Object.fromEntries(Object.entries(cov).map(([k, c]) => [k, c.quotes])),
      };
      if (dupBooks.length) console.warn('[findArbs] DUPLICATE ODDS by book (same slot+side listed at several prices):', JSON.stringify(Object.fromEntries(dupBooks)));
      else console.log('[findArbs] duplicate odds: none in this scan');
      const consBooks = Object.entries(consensusDiag);
      if (consBooks.length) console.warn('[findArbs] CONSENSUS FILTER rejected legs (price too far above other books, or too few books quoting it), by book:', JSON.stringify(Object.fromEntries(consBooks)));
      else console.log('[findArbs] consensus filter: no legs rejected in this scan');
      if (bad.length) console.warn('[findArbs] team-name resolution:', JSON.stringify(Object.fromEntries(bad.map(([k, c]) => [k, { unresolved: c.unresolved, rescuedByOwnNames: c.rescued, examples: c.unresolvedNames }]))));
    } catch {}
  }
  return arbs.sort((a, b) => b.margin - a.margin);
}

// ── Sharp reference books by region ─────────────────────────────────────────
// Global (RoW): Pinnacle/Betfair are the gold standard sharp references.
// West Africa:  Use Pinnacle/Betfair as reference (same as global) but filter
//               OUTPUT to WA-accessible books only. 1xBet/Singbet stay as
//               supplementary references when Pinnacle is absent from the feed.
const SHARP_BOOKS_GLOBAL    = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet'];
const SHARP_BOOKS_WESTAFRICA = ['pinnacle', 'betfair_ex_eu', 'betfair_ex_uk', 'singbet', 'sbobet']; // 1xBet removed: it's a soft book, not a sharp reference

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

// ── De-vigging ─────────────────────────────────────────────────────────────
// Turns a book's prices into "fair" probabilities. Plain proportional removal
// (divide each 1/price by their sum) spreads the margin evenly, but real books
// load more margin onto longshots (favourite-longshot bias), so proportional
// OVERSTATES longshot/draw probabilities and manufactures fake +EV on them.
// The power method (find k so Σ (1/price)^k = 1) shaves longshots harder and
// is the standard, more conservative fix. Falls back to proportional only if
// the book has no margin to remove.
function devigPower(prices) {
  const p = prices.map(x => 1 / x);
  const sum = p.reduce((s, x) => s + x, 0);
  if (!(sum > 1)) return p.map(x => x / sum);
  let lo = 1, hi = 30;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const f = p.reduce((s, x) => s + Math.pow(x, mid), 0);
    if (f > 1) lo = mid; else hi = mid;
  }
  const k = (lo + hi) / 2;
  const q = p.map(x => Math.pow(x, k));
  const qs = q.reduce((s, x) => s + x, 0);
  return q.map(x => x / qs);
}

// A book's h2h market, or null if it has none OR quotes more than one different
// h2h market (a feed mix-up — we won't guess which one is the real match result).
function uniqueH2H(bm) {
  const ms = (bm.markets || []).filter(m => m.key === 'h2h');
  if (ms.length === 0) return null;
  if (ms.length === 1) return ms[0];
  const sig = m => (m.outcomes || []).map(o => o.name + ':' + o.price).sort().join('|');
  return ms.every(m => sig(m) === sig(ms[0])) ? ms[0] : null;
}

const EV_REVIEW_PCT = 8; // edges this large are far more often a data problem than a real mispricing

function findEVBets(events, minEV = 2, mode = 'all', userRegion = null, teamForm = null) {
  const runMode = (sharpBooks, filterWA) => {
    const evBets = [];
    const diag = { eventsTotal: 0, eventsWithSharp: 0, sharpBooksSeen: [], compared: 0, bestEV: null, skippedAmbiguous: 0 };
    const sharpSeen = new Set();
    for (const ev of events) {
      if (!ev.bookmakers || ev.bookmakers.length < 2) continue;
      diag.eventsTotal++;
      const isSoccer = typeof ev.sport_key === 'string' && ev.sport_key.startsWith('soccer');

      // Sharp consensus: average the de-vigged true probability across every
      // usable sharp book. A sharp book is only usable if its h2h market is
      // COMPLETE (home + away, plus draw for soccer) and every outcome maps to a
      // side — a partial market can't be de-vigged correctly and would give a
      // wrong "fair" price.
      const probsBySide = {};
      const usedSharpKeys = [];
      for (const sharpBm of ev.bookmakers.filter(b => sharpBooks.includes(b.key))) {
        const sharpMkt = uniqueH2H(sharpBm);
        if (!sharpMkt) { diag.skippedAmbiguous++; continue; }
        const outs = (sharpMkt.outcomes || []).filter(o => o.price > 1);
        const sides = outs.map(o => resolveSide(o.name, ev));
        if (sides.some(s => !s) || new Set(sides).size !== sides.length) continue;
        const need = isSoccer ? ['__home__', '__draw__', '__away__'] : ['__home__', '__away__'];
        if (!need.every(s => sides.includes(s)) || sides.length !== need.length) continue;
        const fair = devigPower(outs.map(o => o.price));
        usedSharpKeys.push(sharpBm.key);
        sharpSeen.add(sharpBm.key);
        sides.forEach((s, idx) => { (probsBySide[s] = probsBySide[s] || []).push(fair[idx]); });
      }
      if (usedSharpKeys.length === 0) continue;
      diag.eventsWithSharp++;

      const trueProbs = {};
      Object.keys(probsBySide).forEach(s => {
        trueProbs[s] = probsBySide[s].reduce((a, p) => a + p, 0) / probsBySide[s].length;
      });

      for (const bm of ev.bookmakers) {
        if (sharpBooks.includes(bm.key)) continue;
        if (filterWA && !isBookAccessible(bm.key, userRegion)) continue;
        const mkt = uniqueH2H(bm);
        if (!mkt) { if ((bm.markets || []).some(m => m.key === 'h2h')) diag.skippedAmbiguous++; continue; }
        for (const o of mkt.outcomes) {
          if (!(o.price > 1)) continue;
          const normKey = resolveSide(o.name, ev, bm);
          if (!normKey) continue;
          const prob = trueProbs[normKey];
          if (!prob) continue;
          const ev_pct = parseFloat(((o.price * prob - 1) * 100).toFixed(2));
          diag.compared++;
          if (diag.bestEV === null || ev_pct > diag.bestEV) diag.bestEV = ev_pct;
          if (ev_pct >= minEV) {
            const isDraw = normKey === '__draw__';
            const outcomeTeam = normKey === '__home__' ? ev.home_team : normKey === '__away__' ? ev.away_team : null;
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
              flag: ev_pct >= EV_REVIEW_PCT ? 'Unusually large edge — check this price on the book and that the sharp line is current before betting.' : null,
              sharpRef: usedSharpKeys.join('+'),
              sharpBookCount: usedSharpKeys.length,
              _wa: !!isBookAccessible(bm.key, userRegion),
              isDraw,
              drawContext: isDraw ? getDrawContext(ev.sport_key, ev.home_team, ev.away_team) : null,
              formContext: (!isDraw && outcomeTeam) ? getFormContextForOutcome(ev.sport_key, outcomeTeam, teamForm) : null,
            });
          }
        }
      }
    }
    diag.sharpBooksSeen = [...sharpSeen];
    evBets.diag = diag;
    return evBets;
  };

  const finish = (arr, diag) => { arr.diag = diag; return arr; };
  if (mode === 'global') { const r = runMode(SHARP_BOOKS_GLOBAL, false); return finish(r.sort((a, b) => b.ev_pct - a.ev_pct), r.diag); }
  if (mode === 'wa')     { const r = runMode(SHARP_BOOKS_WESTAFRICA, true); return finish(r.sort((a, b) => b.ev_pct - a.ev_pct), r.diag); }

  const global = runMode(SHARP_BOOKS_GLOBAL, false);
  const wa     = runMode(SHARP_BOOKS_WESTAFRICA, true);
  const seen   = new Set(global.map(b => b.id));
  const merged = [...global, ...wa.filter(b => !seen.has(b.id))];
  return finish(merged.sort((a, b) => b.ev_pct - a.ev_pct), global.diag);
}

function evDiagLine(d) {
  if (!d) return '';
  return ' · Sharp references this scan: ' + (d.sharpBooksSeen.length ? d.sharpBooksSeen.join(', ') : 'NONE') + ' (' + d.eventsWithSharp + '/' + d.eventsTotal + ' events)';
}

// ── MIDDLE BETTING ─────────────────────────────────────────────────────────
// A middle needs OPPOSITE sides of the same event at different lines, so that
// a range of results makes BOTH bets win. e.g. Team A -3.5 at one book and
// Team B +4.5 at another: if A wins by exactly 4, both win.
// Betting the SAME team at two lines (Team A -0.25 and Team A +1.5) is not a
// middle — both bets just ride on that team winning.
// Every line a book quotes is considered (not just its first market), and a
// middle is only reported if at least one whole-number result lands strictly
// inside the window (a result exactly on a line is a push, not a double win).
function integersBetween(lo, hi) {
  const out = [];
  for (let n = Math.floor(lo + 1e-9) + 1; n < hi - 1e-9; n++) out.push(n);
  return out;
}
const fmtLine = p => (p > 0 ? '+' : '') + p;

// ── MIDDLES: MARKET-IMPLIED PLAUSIBILITY ────────────────────────────────────
// Builds the match's own goal-total distribution from every book's full-time Over/Under
// ladder (each line de-vigged per book, then median across books). No external data:
// the market's pricing IS the probability model. Returns null if fewer than 3 half-lines.
function buildTotalsModel(ev) {
  const byBook = {};
  for (const bm of (ev.bookmakers || [])) {
    for (const mkt of (bm.markets || [])) {
      if ((mkt.key !== 'totals' && mkt.key !== 'alternate_totals') || totalsVariant(mkt) !== 'fulltime') continue;
      for (const o of (mkt.outcomes || [])) {
        if (!(o.price > 1) || typeof o.point !== 'number') continue;
        const side = String(o.name || '').trim().toLowerCase();
        if (side !== 'over' && side !== 'under') continue;
        const b = (byBook[bm.key] = byBook[bm.key] || {});
        const p = (b[o.point] = b[o.point] || {});
        if (p[side] == null) p[side] = o.price;
      }
    }
  }
  const perLine = {};
  for (const pts of Object.values(byBook)) {
    for (const [pt, pr] of Object.entries(pts)) {
      const x = parseFloat(pt);
      if (Math.abs((x % 1) - 0.5) > 1e-9 || !pr.over || !pr.under) continue; // half-lines, both sides
      (perLine[x] = perLine[x] || []).push((1 / pr.over) / (1 / pr.over + 1 / pr.under));
    }
  }
  const xs = Object.keys(perLine).map(Number).sort((a, b) => a - b);
  if (xs.length < 3) return null;
  const med = arr => { const a = [...arr].sort((p, q) => p - q); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const pts = [{ x: -0.5, s: 1 }];
  let prev = 1;
  for (const x of xs) { prev = Math.min(prev, med(perLine[x])); pts.push({ x, s: prev }); }
  return { pts };
}

// P(total > x) for a half-line x, interpolated on the consensus ladder.
function totalsSurvival(model, x) {
  const p = model.pts;
  if (x <= p[0].x) return 1;
  for (let i = 1; i < p.length; i++) {
    if (x <= p[i].x) { const a = p[i - 1], b = p[i]; return a.s + (b.s - a.s) * (x - a.x) / (b.x - a.x); }
  }
  const last = p[p.length - 1], before = p[p.length - 2];
  const ratio = Math.min(0.9, Math.max(0.05, before.s > 0 ? last.s / before.s : 0.3));
  return last.s * Math.pow(ratio, x - last.x);
}

// The line where the market thinks Over/Under is 50/50 — its own expected total.
function totalsMedian(model) {
  const p = model.pts;
  for (let i = 1; i < p.length; i++) {
    if (p[i].s <= 0.5) { const a = p[i - 1], b = p[i]; return a.x + (a.s - 0.5) / (a.s - b.s || 1) * (b.x - a.x); }
  }
  return p[p.length - 1].x;
}

// Expected value of a middle per 1 unit staked in total, staking so either single win returns the same.
function middleEV(model, o, u) {
  const imp = 1 / o.price + 1 / u.price;
  const sa = (1 / o.price) / imp, sb = (1 / u.price) / imp;
  const ints = integersBetween(o.point, u.point);
  let ev = -1, windowProb = 0;
  for (let n = 0; n <= 20; n++) {
    const pn = Math.max(0, totalsSurvival(model, n - 0.5) - totalsSurvival(model, n + 0.5));
    let ret = 0;
    ret += n > o.point ? sa * o.price : (n === o.point ? sa : 0);
    ret += n < u.point ? sb * u.price : (n === u.point ? sb : 0);
    ev += pn * ret;
    if (ints.includes(n)) windowProb += pn;
  }
  return { ev, windowProb };
}

const MIN_MIDDLE_EV_PCT = -2; // default view hides middles estimated worse than this (%), unless they are arbs
const MIN_WINDOW_PROB = 0.10; // a middle must land at least ~1 in 10 by the market's own pricing
// Arbs first; then by estimated EV (probability-weighted, from the match's own ladder);
// middles without a ladder model fall back to cost and sort after modelled ones.
function compareMiddles(a, b) {
  if (a.isArb !== b.isArb) return a.isArb ? -1 : 1;
  const ae = a.evPct, be = b.evPct;
  if (ae != null && be != null) return be - ae;
  if (ae != null) return -1;
  if (be != null) return 1;
  return a.implied - b.implied;
}

function findMiddles(events, mode = 'global', userRegion = null) {
  const middles = [];
  const MAX_PER_EVENT_TYPE = 3;
  const legsOk = (bookA, bookB) => mode !== 'wa' || (isBookAccessible(bookA, userRegion) && isBookAccessible(bookB, userRegion));

  // All quotes for a market type across every market entry of every book. A book
  // quoting the same side+line at two different prices is ambiguous — dropped.
  const collect = (ev, marketKey) => {
    const out = [];
    const prices = {};
    for (const bm of ev.bookmakers) {
      for (const mkt of (bm.markets || [])) {
        if (mkt.key !== marketKey && !(marketKey === 'totals' && mkt.key === 'alternate_totals')) continue; // extra Over/Under lines feed middles only
        if (marketKey === 'totals' && totalsVariant(mkt) !== 'fulltime') continue; // same market-name rule as arbs
        for (const o of (mkt.outcomes || [])) {
          if (!(o.price > 1) || typeof o.point !== 'number') continue;
          if (marketKey === 'totals' && Math.abs(o.point * 2 - Math.round(o.point * 2)) > 1e-9) continue; // no quarter lines
          let side;
          if (marketKey === 'spreads') {
            side = resolveSide(o.name, ev, bm);
            if (side !== '__home__' && side !== '__away__') continue;
          } else {
            side = String(o.name || '').trim().toLowerCase();
            if (side !== 'over' && side !== 'under') continue;
          }
          out.push({ book: bm.key, bookName: bm.title, side, point: o.point, price: o.price, updatedMs: parseQuoteTime(mkt.last_update || bm.last_update) });
          const k = bm.key + '|' + side + '|' + o.point;
          (prices[k] = prices[k] || new Set()).add(o.price);
        }
      }
    }
    return out.filter(q => prices[q.book + '|' + q.side + '|' + q.point].size === 1);
  };

  for (const ev of events) {
    if (!ev.bookmakers || ev.bookmakers.length < 2) continue;
    const match = ev.home_team + ' vs ' + ev.away_team;

    // ── Spreads middle: home at line px  +  away at line py, different books ──
    // Home covers if (home − away) > −px; away covers if (home − away) < py.
    const sp = collect(ev, 'spreads');
    const homes = sp.filter(q => q.side === '__home__');
    const aways = sp.filter(q => q.side === '__away__');
    const spCands = [];
    for (const x of homes) for (const y of aways) {
      if (x.book === y.book || !legsOk(x.book, y.book)) continue;
      const lo = -x.point, hi = y.point;
      const ints = integersBetween(lo, hi);
      if (ints.length === 0) continue;
      const implied = 1 / x.price + 1 / y.price;
      spCands.push({
        id: ev.id + '_sprd_' + x.book + x.point + '_' + y.book + y.point,
        sport: ev.sport_key, match, commenceTime: ev.commence_time, type: 'Spread', team: 'Handicap',
        legA: { book: x.book, bookName: x.bookName, line: x.point, odds: x.price, side: ev.home_team + ' ' + fmtLine(x.point) },
        legB: { book: y.book, bookName: y.bookName, line: y.point, odds: y.price, side: ev.away_team + ' ' + fmtLine(y.point) },
        window: parseFloat((x.point + y.point).toFixed(2)),
        windowText: 'the final goal/point difference (' + ev.home_team + ' minus ' + ev.away_team + ') is ' + (ints.length === 1 ? 'exactly ' + ints[0] : 'one of ' + ints.join(', ')),
        implied: parseFloat(implied.toFixed(4)), isArb: implied < 1,
      });
    }
    spCands.sort((a, b) => a.implied - b.implied);
    middles.push(...spCands.slice(0, MAX_PER_EVENT_TYPE));

    // ── Totals middle: Over at a lower line, Under at a higher line ──
    const tt = collect(ev, 'totals');
    const overs = tt.filter(q => q.side === 'over');
    const unders = tt.filter(q => q.side === 'under');
    const model = buildTotalsModel(ev);
    const median = model ? totalsMedian(model) : null;
    const totCands = [];
    for (const o of overs) for (const u of unders) {
      if (o.book === u.book || !legsOk(o.book, u.book)) continue;
      if (!(o.point < u.point)) continue;
      const ints = integersBetween(o.point, u.point);
      if (ints.length === 0) continue;
      const implied = 1 / o.price + 1 / u.price;
      let ev_ = null, windowProb = null;
      if (model) {
        const r = middleEV(model, o, u);
        ev_ = r.ev; windowProb = r.windowProb;
        if (windowProb < MIN_WINDOW_PROB) continue; // tail windows the market itself calls near-impossible
      }
      const ages = [o.updatedMs, u.updatedMs].filter(t => t != null).map(t => Date.now() - t);
      const staleNote = ages.length && Math.max(...ages) > PRE_STALE_MS ? 'A leg was last updated ' + fmtAge(Math.max(...ages)) + ' ago — verify it on the book.' : null;
      totCands.push({
        id: ev.id + '_tot_' + o.book + o.point + '_' + u.book + u.point,
        sport: ev.sport_key, match, commenceTime: ev.commence_time, type: 'Total', team: 'Goals total',
        legA: { book: o.book, bookName: o.bookName, line: o.point, odds: o.price, side: 'Over ' + o.point },
        legB: { book: u.book, bookName: u.bookName, line: u.point, odds: u.price, side: 'Under ' + u.point },
        window: parseFloat((u.point - o.point).toFixed(2)),
        windowText: 'the total is ' + (ints.length === 1 ? 'exactly ' + ints[0] : 'one of ' + ints.join(', ')),
        implied: parseFloat(implied.toFixed(4)), isArb: implied < 1,
        windowProb: windowProb == null ? null : parseFloat(windowProb.toFixed(3)),
        evPct: ev_ == null ? null : parseFloat((ev_ * 100).toFixed(1)),
        marketMedian: median == null ? null : parseFloat(median.toFixed(1)),
        staleNote,
      });
    }
    totCands.sort(compareMiddles);
    const totPicked = totCands.slice(0, MAX_PER_EVENT_TYPE);
    // Wide-window pairs (e.g. Over 1.5 / Under 4.5) rarely have the top EV, so a top-3-by-EV cut can
    // crowd them out. Also keep the single likeliest-to-land pair, but only if it clears the same EV floor.
    const likeliest = totCands
      .filter(c => c.windowProb != null && (c.isArb || c.evPct >= MIN_MIDDLE_EV_PCT))
      .sort((a, b) => b.windowProb - a.windowProb)[0];
    if (likeliest && !totPicked.includes(likeliest)) totPicked.push(likeliest);
    middles.push(...totPicked);
  }
  return middles.sort(compareMiddles);
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

// ── LAST-SCAN SNAPSHOT ─────────────────────────────────────────────────────────────────────────────
// The finished scan is saved on this device (per user), so reopening the site shows the last real results straight
// away instead of the demo data, and no rescan is made until the 5-minute window is over. The scan itself still
// refreshes everything; this only fills the screen (and saves quota) while the data is still current.
const SNAP_VERSION = 1;
const SNAP_MAX_AGE_MS = 2 * 60 * 60 * 1000;   // older than this is not shown at all (the 12-min arb expiry hides old arbs anyway)
const SCAN_WINDOW_MS = 5 * 60 * 1000;
const snapKey = uid => 'arb_snapshot_v' + SNAP_VERSION + ':' + uid;
const sportsSig = list => JSON.stringify([...(list || [])].sort());
function loadSnapshot(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(snapKey(uid));
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== SNAP_VERSION || !s.savedAt || !Array.isArray(s.arbs)) return null;
    if (Date.now() - s.savedAt > SNAP_MAX_AGE_MS) return null;
    return s;
  } catch { return null; }
}
function saveSnapshot(uid, snap) {
  if (!uid) return;
  const put = s => { try { localStorage.setItem(snapKey(uid), JSON.stringify(s)); return true; } catch { return false; } };
  if (put(snap)) return;
  // Too big for the device's storage: keep the arbs and EV (what matters), drop the bulky lists.
  put({ ...snap, middles: [], middlesWA: [], bestOdds: [], bestOddsWA: [], steam: [] });
}

function ArbEdgeApp({ session, onLogout }) {
  const [tab, setTab] = useState('scanner');
const [apiKey, setApiKey] = useState('server');
  const [apiInput, setApiInput] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const uidRef = React.useRef(session && session.user ? session.user.id : null);
  const [snap0] = useState(() => loadSnapshot(session && session.user ? session.user.id : null)); // last finished scan on this device, or null
  // When the last SUCCESSFUL scan finished (ms) and which leagues it covered. Unlike lastFetch (stamped when a scan STARTS,
  // so a scan abandoned mid-way still looked fresh), these only move when real data was actually saved.
  const lastGoodScanRef = React.useRef(snap0 ? snap0.savedAt : 0);
  const lastGoodSigRef = React.useRef(snap0 ? (snap0.sports || '') : '');
  const [arbs, setArbs] = useState(snap0 ? snap0.arbs : MOCK);
  const [arbsWAReal, setArbsWAReal] = useState(snap0 ? (snap0.arbsWA || []) : []); // properly computed WA-only arbs (not a post-filter of global picks)
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, sport: '' });
  const [lastFetch, setLastFetch] = useState(() => {
  try {
    const saved = localStorage.getItem('arb_lastFetch');
    return saved ? new Date(saved) : null;
  } catch { return null; }
});
  const [error, setError] = useState('');
  const [isDemo, setIsDemo] = useState(!snap0);
  const [isDemoEV, setIsDemoEV] = useState(!snap0);
  const [waHealth, setWaHealth] = useState(snap0 ? (snap0.waHealth || null) : null);
  const [scanHealth, setScanHealth] = useState(snap0 ? (snap0.scanHealth || null) : null); // WA book coverage from last scan
  const [showScanHealth, setShowScanHealth] = useState(false); // expand/collapse detail panel
  const [sel, setSel] = useState(null);
  const [stake, setStake] = useState(500);
  const [currency, setCurrency] = useState('GHS');
  const [groupFilter, setGroupFilter] = useState('all');
  // Capped to 20 popular FOOTBALL leagues only (was previously mixed with
  // basketball/tennis/MMA/cricket/NFL, which fragmented the shared scan cache
  // across sports nobody was actually comparing). Every entry here has a
  // confirmed WA-scraper tournament ID, so capping doesn't lose WA coverage.
  const TOP_SPORTS = ['soccer_epl','soccer_uefa_champs_league','soccer_spain_la_liga','soccer_germany_bundesliga','soccer_italy_serie_a','soccer_france_ligue_one','soccer_africa_cup_of_nations','soccer_ghana_premiership','soccer_fifa_world_cup','soccer_uefa_europa_league','soccer_conmebol_copa_libertadores','soccer_usa_mls','soccer_efl_champ','soccer_netherlands_eredivisie','soccer_portugal_primeira_liga','soccer_belgium_first_div','soccer_spl','soccer_norway_eliteserien','soccer_sweden_allsvenskan','soccer_brazil_campeonato','basketball_nba'];
const [selectedSports, setSelectedSports] = useState(() => {
  try { const saved = localStorage.getItem('arb_sports'); return saved ? JSON.parse(saved) : TOP_SPORTS; } catch { return TOP_SPORTS; }
});
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [minMargin, setMinMargin] = useState(0);
  const [showHighProfit, setShowHighProfit] = useState(false);
  const [showReview, setShowReview] = useState(false); // review-tier arbs stay hidden unless opened
  // user's active reports = their personal denylist (table arb_reports, see arb_reports.sql)
  const [reports, setReports] = useState([]);
  const [reportOpenId, setReportOpenId] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportLeg, setReportLeg] = useState('all');
  const [reportStatus, setReportStatus] = useState('idle');
  // arb signature -> first time it was seen (kept across reloads on this device)
  const firstSeenRef = React.useRef((() => { try { return JSON.parse(localStorage.getItem('arb_firstSeen') || '{}'); } catch { return {}; } })());
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
  const [partialPct, setPartialPct] = useState(50);
  useEffect(() => { betsRef.current = bets; }, [bets]);
  useEffect(() => {
    if (!session || !session.user) return;
    let cancelled = false;
    supabase.from('arb_reports').select('arb_id, leg_key, reason, expires_at')
      .eq('user_id', session.user.id).gt('expires_at', new Date().toISOString())
      .then(({ data, error }) => { if (!cancelled && !error && data) setReports(data); }); // no table yet -> just no denylist
    return () => { cancelled = true; };
  }, [session && session.user && session.user.id]);
  const isDenied = a => reports.some(r => {
    if (new Date(r.expires_at).getTime() < Date.now()) return false;
    if (!r.leg_key) return r.arb_id === a.id;
    return a.outcomes.some(o => legKey(a, o) === r.leg_key);
  });
  const submitReport = async arb => {
    if (!reportReason) { setReportStatus('pick'); return; }
    const reason = REPORT_REASONS.find(x => x.key === reportReason);
    const leg = reportLeg === 'all' ? null : arb.outcomes.find(o => o.book === reportLeg);
    const row = {
      user_id: session.user.id,
      arb_id: arb.id,
      leg_key: leg ? legKey(arb, leg) : null,
      book: leg ? leg.book : null,
      reason: reason.key,
      match: arb.match,
      margin: arb.margin,
      odds_snapshot: arb.outcomes.map(o => ({ book: o.book, label: o.label, odds: o.odds, fixtureRef: o.fixtureRef || null, srcLabel: o.srcLabel || null, updatedAt: o.updatedAt || null })),
      expires_at: new Date(Date.now() + reason.ttlHours * 3600000).toISOString(),
    };
    setReportStatus('sending');
    const { error } = await supabase.from('arb_reports').insert(row);
    if (error) { setReportStatus('error'); return; }
    setReports(p => [...p, row]);
    setReportOpenId(null); setReportReason(''); setReportLeg('all'); setReportStatus('idle');
  };
  const [bankroll, setBankroll] = useState(() => { try { return parseFloat(localStorage.getItem('arb_bankroll') || '500'); } catch { return 500; } });
  const [referrals, setReferrals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('arb_referrals') || '{}'); } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem('arb_referrals', JSON.stringify(referrals)); } catch {} }, [referrals]);
  const [trackerView, setTrackerView] = useState('bets'); // 'bets' | 'dashboard'
  const [clvInputs, setClvInputs] = useState({}); // betId -> closing odds string
  useEffect(() => { try { localStorage.setItem('arb_sports', JSON.stringify(selectedSports)); } catch {} }, [selectedSports]);

const betsLoadedRef = React.useRef(false);

useEffect(() => {
  if (!session?.user?.id) return;
  supabase
    .from('tracked_bets')
    .select('id, data')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) { console.error('Failed to load bets:', error); return; }
      if (data) setBets(data.map(row => ({ ...row.data, id: row.id })));
      betsLoadedRef.current = true;
    });
}, [session]);
  const [manualOutcomes, setManualOutcomes] = useState([
    { label: 'Home', book: 'betway', odds: '' },
    { label: 'Draw', book: 'sportybet', odds: '' },
    { label: 'Away', book: 'betano', odds: '' },
  ]);
  const [manualMeta, setManualMeta] = useState(EMPTY_MANUAL);
  const [manualStake, setManualStake] = useState(500);
  const [manualResult, setManualResult] = useState(null);
  const [evBets, setEvBets] = useState(snap0 ? (snap0.ev || []) : MOCK_EV);
  const [integrity, setIntegrity] = useState(snap0 ? (snap0.integrity || null) : null);
  const [evDiag, setEvDiag] = useState(null);
  const [evDiagWA, setEvDiagWA] = useState(null);
  const [evWA, setEvWA] = useState(snap0 ? (snap0.evWA || []) : []); // West Africa EV bets — Pinnacle reference, WA-accessible books only
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
  const [quota, setQuota] = useState(snap0 && snap0.quota ? snap0.quota : { remaining: null, used: null, keyIndex: 1 });
  const [userRegion, setUserRegion] = useState(snap0 && snap0.userRegion ? snap0.userRegion : { country: null, isWA: true, accessibleBooks: null }); // default WA until detected
  const [nextScanAt, setNextScanAt] = useState(() => {
  try { const saved = localStorage.getItem('arb_nextScanAt'); return saved ? Number(saved) : null; } catch { return null; }
});
  const [countdown, setCountdown] = useState(0);
  const [cardAnalysis, setCardAnalysis] = useState({});
  const [analyzingId, setAnalyzingId] = useState(null);
  const [recheck, setRecheck] = useState({});
  const [recheckingId, setRecheckingId] = useState(null);
  const [middles, setMiddles] = useState(snap0 ? (snap0.middles || []) : []);
  const [middlesWA, setMiddlesWA] = useState(snap0 ? (snap0.middlesWA || []) : []); // West Africa middles — both legs accessible
  const [middleSection, setMiddleSection] = useState('global'); // 'global' | 'wa'
  const [middleSort, setMiddleSort] = useState('ev'); // 'ev' = best estimated EV first, 'likely' = biggest chance of landing first
  const [showAllMiddles, setShowAllMiddles] = useState(false); // false = hide middles whose estimated EV is clearly negative
  const [steam, setSteam] = useState(snap0 ? (snap0.steam || []) : []);
  const [bestOdds, setBestOdds] = useState(snap0 ? (snap0.bestOdds || []) : []);
  const [bestOddsWA, setBestOddsWA] = useState(snap0 ? (snap0.bestOddsWA || []) : []); // West Africa line shopping — accessible books only
  const [lineshopSection, setLineshopSection] = useState('global'); // 'global' | 'wa'
  const [edgeTab, setEdgeTab] = useState('lineshop'); // 'lineshop' | 'middle' | 'steam'
  const prevEventsRef = React.useRef([]);
  const teamFormRef = React.useRef(TEAM_FORM);

  // -- PREMIUM PLAN STATE --------------------------------------------------
  const [plan, setPlan] = useState({ loaded: false, isPremium: false, isOwner: false, periodEnd: null, quotes: {}, defaultCurrency: 'GHS', autoCurrencies: [], freeSports: [], scannedSports: [], notAvailable: false });
  const [payCurrency, setPayCurrency] = useState('');
  const [upgradeNotice, setUpgradeNotice] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return (data && data.session && data.session.access_token) || '';
  };
  const refreshPlan = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = (data && data.session && data.session.access_token) || '';
      const res = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) return null;
      const j = await res.json();
      setPlan({ loaded: true, isPremium: !!j.isPremium, isOwner: !!j.isOwner, periodEnd: j.currentPeriodEnd, quotes: j.quotes || {}, defaultCurrency: j.defaultCurrency || 'GHS', autoCurrencies: j.autoCurrencies || [], freeSports: j.freeSports || [], scannedSports: j.scannedSports || [], notAvailable: !!j.notAvailable });
      return j;
    } catch { return null; }
  }, []);
  useEffect(() => {
    refreshPlan();
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('paid') === '1') {
        let tries = 0;
        const t = setInterval(async () => {
          tries++;
          const j = await refreshPlan();
          if ((j && j.isPremium) || tries >= 10) { clearInterval(t); window.history.replaceState({}, '', '/'); }
        }, 3000);
        return () => clearInterval(t);
      }
    } catch {}
  }, [refreshPlan]);
  const curSel = payCurrency || plan.defaultCurrency;
  const priceLabel = (plan.quotes[curSel] && plan.quotes[curSel].label) || 'Premium';
  const _q = plan.quotes[curSel];
  const chargeNote = (_q && _q.chargeLabel && _q.displayCurrency !== _q.currency)
    ? createElement('div', { style: { marginTop: 8, fontSize: 11, color: '#6b7280', lineHeight: 1.4 } }, 'At checkout you are charged ' + _q.chargeLabel + ' (the equivalent of ' + _q.label + '). Your card converts it to your own currency and your bank may add its own fees.')
    : null;
  const startCheckout = async (mode) => {
    setCheckoutLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ mode, currency: payCurrency || plan.defaultCurrency }),
      });
      const j = await res.json();
      if (j.url) { window.location.href = j.url; return; }
      setUpgradeNotice(j.error || 'Could not start checkout. Please try again.');
    } catch { setUpgradeNotice('Could not start checkout. Please try again.'); }
    setCheckoutLoading(false);
  };

  const planRef = React.useRef(plan);
  planRef.current = plan;
  const [pickerNotice, setPickerNotice] = useState('');
  const isLocked = (key) => plan.loaded && !plan.isPremium && plan.freeSports.length > 0 && !plan.freeSports.includes(key);
  const lockMsg = (n) => '\uD83D\uDD12 ' + n + (n === 1 ? ' league is' : ' leagues are') + ' Premium only. Go Premium (' + priceLabel + ' for 30 days) to scan every league.';
  const toggleSport = (key) => {
    if (selectedSports.includes(key)) { setSelectedSports(p => p.filter(k => k !== key)); return; }
    if (isLocked(key)) { setPickerNotice(lockMsg(1)); return; }
    setPickerNotice('');
    setSelectedSports(p => [...p, key]);
  };
  const addSports = (keys) => {
    const ok = keys.filter(k => !isLocked(k));
    const blocked = keys.length - ok.length;
    setPickerNotice(blocked > 0 ? lockMsg(blocked) : '');
    setSelectedSports(p => [...new Set([...p, ...ok])]);
  };
  const setSportsExactly = (keys) => {
    const ok = keys.filter(k => !isLocked(k));
    const blocked = keys.length - ok.length;
    setPickerNotice(blocked > 0 ? lockMsg(blocked) : '');
    setSelectedSports(ok);
  };

  const allowedKeys = plan.isOwner ? ALL_SPORTS.map(s => s.key) : (plan.scannedSports.length ? plan.scannedSports : TOP_SPORTS);
  const pickerGroups = plan.isOwner
    ? SPORT_GROUPS
    : [{ group: '\u26BD Scanned leagues', sports: allowedKeys.map(k => ALL_SPORTS.find(s => s.key === k)).filter(Boolean) }];

  const [myRegion, setMyRegion] = useState(() => { try { return localStorage.getItem('arb_region') || 'auto'; } catch { return 'auto'; } });
  const [regionNotice, setRegionNotice] = useState('');
  const myRegionRef = React.useRef(myRegion);
  myRegionRef.current = myRegion;
  const userRegionRef = React.useRef(userRegion);
  userRegionRef.current = userRegion;
  const changeRegion = (val) => {
    if (val === 'us') { setRegionNotice('ArbEdge does not have odds for US sportsbooks, so it is not available in the United States.'); return; }
    setRegionNotice('');
    setMyRegion(val);
    myRegionRef.current = val;
    try { localStorage.setItem('arb_region', val); } catch {}
    try { fetchOddsRef.current(apiKey || 'server'); } catch {}
  };
  const _regionName = (k) => { const o = REGION_OPTIONS.find(x => x.key === k); return o ? o.label : ''; };
  const isWAUserNow = userRegion.isWA !== false;
  const myLabel = isWAUserNow ? '\uD83C\uDDEC\uD83C\uDDED West Africa' : '\u2705 My region';
  const myLabelOnly = isWAUserNow ? '\uD83C\uDDEC\uD83C\uDDED West Africa only' : '\u2705 Available to me only';
  const regionFallbackText = 'Only books available in your region are compared, so every gap shown is a bet you can actually place.';

  // -- MENU (account, support, region, help, legal, log out) ------------------
  const [menuOpen, setMenuOpen] = useState(false);
  const [fbCategory, setFbCategory] = useState('bug');
  const [fbMessage, setFbMessage] = useState('');
  const [fbStatus, setFbStatus] = useState('idle');
  const [planCheckMsg, setPlanCheckMsg] = useState('');
  const submitFeedback = async () => {
    const msg = fbMessage.trim();
    if (msg.length < 5) { setFbStatus('short'); return; }
    setFbStatus('sending');
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: session.user.id,
        email: session.user.email,
        category: fbCategory,
        message: msg.slice(0, 2000),
        plan_status: plan.isOwner ? 'owner' : (plan.isPremium ? 'premium' : 'free'),
        region: userRegion.region || null,
      });
      if (error) throw error;
      setFbMessage('');
      setFbStatus('sent');
    } catch { setFbStatus('error'); }
  };
  const checkPayment = async () => {
    setPlanCheckMsg('Checking...');
    const j = await refreshPlan();
    if (j && j.isPremium) setPlanCheckMsg('Your Premium is active.');
    else setPlanCheckMsg('Still showing the Free plan. If you paid a minute ago, wait a little and check again. If it has been longer, email us with your payment receipt and we will fix it.');
  };
  const renderPremiumCard = () => {
    const e = createElement;
    const features = [
      'Every league we scan — not just the free set',
      'Every sportsbook we cover, in one scan',
      '+EV bet finder with sharp-book consensus',
      'AI Bet Analyzer for match context',
      'Bet tracker with closing line value (CLV)',
      'Cash-out analyzer',
      'Affiliate earnings tracker',
    ];
    return e('div', {
      style: { border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginTop: 10, background: '#fafafa' }
    },
      e('div', { style: { fontSize: 13, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 } }, 'Premium'),
      e('div', { style: { fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 2 } }, priceLabel),
      e('div', { style: { fontSize: 12, color: '#6b7280', marginBottom: 12 } }, 'per 30 days'),
      e('div', { style: { marginBottom: 14 } },
        features.map((f, i) => e('div', {
          key: i,
          style: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151', marginBottom: 6 }
        },
          e('span', { style: { color: '#10b981', fontWeight: 700 } }, '✓'),
          e('span', null, f)
        ))
      ),
      e('button', {
        onClick: () => startCheckout('prepaid'),
        disabled: checkoutLoading,
        style: { ...st.btn('primary'), width: '100%' }
      }, checkoutLoading ? 'Opening...' : (plan.isPremium ? 'Renew for 30 days' : 'Upgrade to Premium'))
    );
  };
  const renderMenu = () => {
    if (!menuOpen) return null;
    const e = createElement;
    const userEmail = (session && session.user && session.user.email) || '';
    const sec = { marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' };
    const h = { fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 };
    const p = { fontSize: 13, color: '#374151', lineHeight: 1.5, margin: '0 0 8px' };
    const link = { color: '#2563eb', textDecoration: 'underline', fontSize: 13 };
    const planLine = plan.isOwner ? 'Owner access' : plan.isPremium ? 'Premium' + (plan.periodEnd ? ' until ' + new Date(plan.periodEnd).toLocaleDateString() : '') : 'Free plan';
    const canPay = !plan.notAvailable && Object.keys(plan.quotes).length > 0;
    const supportBody = 'Account: ' + userEmail + '\n\n';
    const faq = [
      ['What does Premium include?', 'Every league we scan, AI bet analysis, and the full set of tools. The free plan covers a limited set of leagues.'],
      ['How do I pay?', 'By card through Paystack, and by mobile money where available. The price for your region is shown before you pay.'],
      ['I paid but I am still on Free', 'Open Account in this menu and tap "Paid but still on Free?". If it does not change after a few minutes, email us your receipt.'],
      ['How do I cancel?', 'A 30-day payment does not renew, so there is nothing to cancel. If you chose auto-renew, email us before your next charge and we will stop it.'],
      ['Why do some odds say Not accessible?', 'Not every sportsbook is available in every country. Set My region so the app shows the books you can actually use. These labels are guidance and can be wrong.'],
      ['Are arbs guaranteed profit?', 'No. Odds move fast and sportsbooks can limit or void bets. Always check the price on the sportsbook before you bet.'],
      ['How often do odds refresh?', 'The scanner runs about every 5 minutes while the app is open.'],
    ];
    return e('div', { style: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)' }, onClick: () => setMenuOpen(false) },
      e('div', { onClick: ev => ev.stopPropagation(), style: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(94vw, 420px)', background: '#fff', overflowY: 'auto', padding: 16, boxSizing: 'border-box' } },
        e('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 } },
          e('div', { style: { fontSize: 18, fontWeight: 800, color: '#111827' } }, 'Menu'),
          e('button', { onClick: () => setMenuOpen(false), style: { ...st.btn('outline'), padding: '6px 12px' } }, 'Close')
        ),

        e('div', { style: sec },
          e('div', { style: h }, 'Account'),
          e('div', { style: p }, userEmail),
          e('div', { style: p }, 'Plan: ' + planLine),
          !plan.isOwner && canPay && renderPremiumCard(),
          !plan.isPremium && e('div', { style: { marginTop: 10 } },
            e('button', { onClick: checkPayment, style: st.btn('outline') }, 'Paid but still on Free?'),
            planCheckMsg && e('div', { style: { ...p, marginTop: 8 } }, planCheckMsg)
          )
        ),

        e('div', { style: sec },
          e('div', { style: h }, 'Customer support'),
          e('div', { style: p }, 'Send us a message and we will reply by email.'),
          e('select', { value: fbCategory, onChange: ev => setFbCategory(ev.target.value), style: { width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' } },
            [['bug', 'Something is broken'], ['payment', 'Payment problem'], ['idea', 'Idea or feedback'], ['other', 'Something else']].map(([k, l]) => e('option', { key: k, value: k }, l))
          ),
          e('textarea', { value: fbMessage, onChange: ev => setFbMessage(ev.target.value), maxLength: 2000, rows: 4, placeholder: 'Tell us what happened or what you would like to see...', style: { width: '100%', boxSizing: 'border-box', padding: 8, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', marginBottom: 8 } }),
          e('button', { onClick: submitFeedback, disabled: fbStatus === 'sending', style: st.btn('primary') }, fbStatus === 'sending' ? 'Sending...' : 'Send message'),
          fbStatus === 'sent' && e('div', { style: { ...p, marginTop: 8, color: '#047857' } }, 'Thank you. We got your message.'),
          fbStatus === 'short' && e('div', { style: { ...p, marginTop: 8, color: '#b45309' } }, 'Please write a little more.'),
          fbStatus === 'error' && e('div', { style: { ...p, marginTop: 8, color: '#b91c1c' } }, 'Could not send. Please email us instead.'),
          e('div', { style: { marginTop: 10 } }, e('a', { href: mailto('ArbEdge support', supportBody), style: link }, 'Or email ' + SUPPORT_EMAIL))
        ),

        e('div', { style: sec },
          e('div', { style: h }, 'My region'),
          e('select', { value: myRegion, onChange: ev => changeRegion(ev.target.value), style: { width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' } },
            REGION_OPTIONS.map(o => e('option', { key: o.key, value: o.key }, o.label))
          ),
          myRegion === 'auto' && userRegion.region && e('div', { style: { ...p, marginTop: 6, color: '#6b7280' } }, 'Detected: ' + _regionName(userRegion.region)),
          e('div', { style: { ...p, marginTop: 6 } }, 'This decides which sportsbooks count as available to you.'),
          regionNotice && e('div', { style: { padding: '8px 10px', borderRadius: 8, fontSize: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' } }, regionNotice)
        ),

        e('div', { style: sec },
          e('div', { style: h }, 'Help and FAQ'),
          faq.map(([q, a], i) => e('details', { key: i, style: { marginBottom: 8 } },
            e('summary', { style: { cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#111827' } }, q),
            e('div', { style: { ...p, marginTop: 6 } }, a)
          ))
        ),

        e('div', { style: sec },
          e('div', { style: h }, 'Legal'),
          e('div', { style: { display: 'flex', gap: 16 } },
            e('a', { href: '/terms', target: '_blank', rel: 'noreferrer', style: link }, 'Terms of Service'),
            e('a', { href: '/privacy', target: '_blank', rel: 'noreferrer', style: link }, 'Privacy Policy')
          )
        ),

        e('div', { style: sec },
          e('div', { style: h }, 'Responsible gambling'),
          e('div', { style: p }, 'Gamble responsibly. Only 18+ (or the legal age where you live). Gambling is addictive. Never bet money you cannot afford to lose, and take a break or set limits if it stops being fun.'),
          e('div', { style: p }, 'In the UK, free support is available at ', e('a', { href: 'https://www.begambleaware.org', target: '_blank', rel: 'noreferrer', style: link }, 'begambleaware.org'), '. Elsewhere, please contact your national gambling support service.')
        ),

        e('div', { style: sec },
          e('div', { style: h }, 'Your data'),
          e('div', { style: p }, 'You can ask us to delete your account and the data we hold about you.'),
          e('a', { href: mailto('Delete my ArbEdge account', 'Please delete my account: ' + userEmail + '\n'), style: link }, 'Request account deletion')
        ),

        e('button', { onClick: onLogout, style: { width: '100%', fontSize: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid #dc2626', color: '#dc2626', background: 'transparent', cursor: 'pointer', fontWeight: 600 } }, 'Log out')
      )
    );
  };

  const fetchOdds = useCallback(async (key) => {
  if (!key) return;
    setLoading(true); setError('');
    setLastFetch(new Date()); // mark attempt now, so the 5-min gate holds even if this scan fails entirely (quota exhausted etc.)
    const _p = planRef.current;
    const _gated = _p.loaded && !_p.isPremium && _p.freeSports.length > 0;
    const _inScope = (k) => _p.isOwner || !_p.loaded || _p.scannedSports.length === 0 || _p.scannedSports.includes(k);
    const _selected = ALL_SPORTS.filter(s => selectedSports.includes(s.key) && _inScope(s.key));
    const sportsToScan = _gated ? _selected.filter(s => _p.freeSports.includes(s.key)) : _selected;
    const _lockedCount = _selected.length - sportsToScan.length;
    const all = [];
    let okCount = 0, lastFailStatus = null, lastFailBody = '', premiumBlocked = _lockedCount;
    const authToken = await getToken();
    let regionNow = userRegionRef.current;
    // Aggregates WA scraper health across the ENTIRE scan, not just the last sport checked —
    // previously setWaHealth() was called fresh on every iteration, so a 403 on sport #3
    // would get silently overwritten by sport #20's "ok" status, making the "WA 3/3" badge
    // lie about scrapers that actually failed partway through.
    const waHealthAgg = {};
    let quotaNow = null;
    const booksSeenAgg = new Set(); // every bookmaker key the server returned during this scan (diagnostics)
    for (let i = 0; i < sportsToScan.length; i++) {
      const sp = sportsToScan[i];
      setScanProgress({ current: i + 1, total: sportsToScan.length, sport: sp.label });
      await new Promise(r => setTimeout(r, 150));
      try {
        // Outright/futures sport keys (e.g. '..._winner') ONLY accept markets=outrights.
        // Regular match-based sports ONLY accept h2h/spreads/totals. Mixing the two in
        // one request triggers the upstream API's INVALID_MARKET_COMBO error and fails
        // the ENTIRE request — which is why every sport was coming back empty.
        const isOutright = sp.key.endsWith('_winner');
        const sportMarkets = isOutright ? 'outrights' : 'h2h,spreads,totals';
        const res = await fetch('/api/odds?sport=' + sp.key + '&region=' + sp.region + '&market=' + sportMarkets + (myRegionRef.current && myRegionRef.current !== 'auto' ? '&myRegion=' + myRegionRef.current : ''), { headers: { Authorization: 'Bearer ' + authToken } });
        if (res.status === 401) { setError('Session expired. Please log out and log in again.'); break; }
        if (res.status === 402) { premiumBlocked++; continue; }
        if (res.status === 451) { setPlan(p => ({ ...p, notAvailable: true })); break; }
        if (res.status === 429) {
          // Two different 429s: our own per-user limit vs. the data providers' quota.
          let b429 = null; try { b429 = await res.json(); } catch {}
          setError(b429 && b429.error === 'rate_limited' ? 'Scanning too fast. Wait a few seconds and scan again.' : 'API quota reached. Try again later.');
          break;
        }
        if (!res.ok) {
          lastFailStatus = res.status;
          try { lastFailBody = await res.text(); } catch { lastFailBody = ''; }
          console.warn('Odds fetch failed for', sp.key, res.status, lastFailBody);
          continue;
        }
        okCount++;
        const json = await res.json();
const data = json.data || json;
if (json.remainingRequests) { quotaNow = { remaining: json.remainingRequests, used: json.usedRequests, keyIndex: json.keyIndex || 1 }; setQuota(quotaNow); }
if (json.userAccessibleBooks) {
  regionNow = { country: json.userCountry, region: json.userRegion, detectedRegion: json.detectedRegion, isWA: json.isWAUser, accessibleBooks: json.userAccessibleBooks };
  setUserRegion(regionNow);
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
data.forEach(e => { e.sport_key = sp.key; (e.bookmakers || []).forEach(b => booksSeenAgg.add(b.key)); });
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
    setUpgradeNotice(premiumBlocked > 0 ? premiumBlocked + ' of your selected sports need Premium. Free plan covers a limited set of leagues.' : '');
    const keepPrevious = sportsToScan.length > 0 && okCount === 0 && lastGoodScanRef.current > 0;
    if (sportsToScan.length > 0 && okCount === 0 && premiumBlocked === 0) {
      const failMsg = 'Could not load odds for any of the ' + sportsToScan.length + ' sports scanned (last status: ' + (lastFailStatus ?? 'network error') + '). This is not "no arbs found" — the scan itself failed. ';
      setError(prev => prev || (failMsg + (keepPrevious ? 'Showing your last successful scan from ' + new Date(lastGoodScanRef.current).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' instead.' : 'Showing demo data below.')));
    }
    if (keepPrevious) {
      // The scan itself failed (quota, outage, offline). Keep showing the last real results instead of replacing them with demo data.
      setLoading(false);
      setNextScanAt(Date.now() + SCAN_WINDOW_MS);
      return;
    }
    const integrityReport = sanitizeEvents(all);
    setIntegrity(integrityReport);
    const found = findArbs(all, 'global', regionNow);
    const foundArbsWA = findArbs(all, 'wa', regionNow);
    // Auto-verify the scan's top candidates (see verifyTopCandidates above) —
    // server picks which ones actually get checked (top-N by margin, or
    // anything ≥ HIGH_MARGIN_REVIEW); anything it confirms as gone is dropped
    // here, everything else is stamped with its liveVerify result so cards
    // can show "live-verified" / "margin adjusted" without another round trip.
    const verifyMap = await verifyTopCandidates(found.concat(foundArbsWA));
    const applyVerification = (list) => list
      .filter(a => !verifyMap[a.id] || verifyMap[a.id].status !== 'dropped')
      .map(a => verifyMap[a.id] ? { ...a, liveVerify: verifyMap[a.id] } : a);
    // arb age: stamp each arb with when this exact arb (same legs + prices) was first seen
    const stampAge = list => {
      const seen = firstSeenRef.current, now = Date.now();
      return list.map(a => {
        const sig = a.id + '|' + a.outcomes.map(o => o.book + ':' + o.odds).join(',');
        if (!seen[sig]) seen[sig] = now;
        return { ...a, firstSeenMs: seen[sig] };
      });
    };
    const foundVerified = stampAge(applyVerification(found));
    const foundArbsWAVerified = stampAge(applyVerification(foundArbsWA));
    const foundEV = findEVBets(all, minEV, 'global', userRegion, teamFormRef.current);
    const foundEVWA = findEVBets(all, minEV, 'wa', userRegion, teamFormRef.current);
    if (foundVerified.length > 0) { setArbs(foundVerified); setIsDemo(false); }
    else if (okCount === 0) { setArbs(MOCK); setIsDemo(true); } // scan failed entirely — labelled demo
    else { setArbs([]); setIsDemo(false); } // scan worked, genuinely no arbs
    setArbsWAReal(foundArbsWAVerified);
    // Only forget arbs that disappeared when the scan itself worked — a failed scan
    // must not reset every arb's age. An arb that vanishes and later returns starts over.
    if (okCount > 0) {
      const live = new Set(foundVerified.concat(foundArbsWAVerified).map(a => a.id + '|' + a.outcomes.map(o => o.book + ':' + o.odds).join(',')));
      Object.keys(firstSeenRef.current).forEach(k => { if (!live.has(k)) delete firstSeenRef.current[k]; });
      try { localStorage.setItem('arb_firstSeen', JSON.stringify(firstSeenRef.current)); } catch {}
    }
    if (foundEV.length > 0) { setEvBets(foundEV); setIsDemoEV(false); }
    else if (okCount === 0) { setEvBets(MOCK_EV); setIsDemoEV(true); } // scan failed entirely
    else { setEvBets([]); setIsDemoEV(false); } // scan worked, genuinely no +EV right now
    setEvWA(foundEVWA);
    setEvDiag(foundEV.diag || null);
    setEvDiagWA(foundEVWA.diag || null);
    const middlesWAResult = findMiddles(all, 'wa', regionNow);
    const bestOddsWAResult = findBestOdds(all, 'wa', regionNow);
    const middlesGlobalResult = findMiddles(all, 'global', regionNow);
    const bestOddsGlobalResult = findBestOdds(all, 'global', regionNow);
    const steamResult = findSteam(prevEventsRef.current, all);
    setMiddles(middlesGlobalResult);
    setMiddlesWA(middlesWAResult);
    setSteam(steamResult);
    setBestOdds(bestOddsGlobalResult);
    setBestOddsWA(bestOddsWAResult);

    // ── SCAN HEALTH ─────────────────────────────────────────────────────────────
    // Track which WA-accessible books were actually seen in this scan, and how
    // many events had enough coverage to produce arbs/EV for West Africa users.
    const WA_BOOKS = Object.entries(BOOKS).filter(([,b]) => b.wa).map(([k]) => k);
    const seenKeys = new Set(all.flatMap(ev => (ev.bookmakers || []).map(b => b.key)));
    const waBookStatus = WA_BOOKS.map(key => ({
      key,
      name: BOOKS[key].name,
      seen: seenKeys.has(key),
    }));
    const eventsWithWACoverage = all.filter(ev =>
      (ev.bookmakers || []).filter(bm => isBookAccessible(bm.key, regionNow)).length >= 2
    ).length;
    const scanHealthResult = {
      waBooks: waBookStatus,
      eventsScanned: all.length,
      eventsWithWACoverage,
      scannedAt: new Date().toISOString(),
      arbDiag: LAST_ARB_DIAG, // duplicate-odds + team-name diagnostics from findArbs (also logged to the console)
    };
    setScanHealth(scanHealthResult);

    // ── BOOK-KEY DIAGNOSTIC ─────────────────────────────────────────────────────
    // Lists every bookmaker key the server sent in this scan, and flags keys that are not in BOOKS
    // (a key mismatch, e.g. 'sporty_bet' vs 'sportybet', makes a book silently invisible to the finders).
    try {
      const seenList = [...booksSeenAgg].sort();
      const unknownKeys = seenList.filter(k => !BOOKS[k]);
      console.log('[scan] books returned by server (' + seenList.length + '):', seenList.join(', '));
      if (unknownKeys.length) console.warn('[scan] book keys NOT in BOOKS (ignored by name lookups):', unknownKeys.join(', '));
      const waMissing = WA_BOOKS.filter(k => !booksSeenAgg.has(k));
      if (waMissing.length) console.warn('[scan] WA books with ZERO events in this scan:', waMissing.join(', '));
    } catch {}

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
    setNextScanAt(Date.now() + SCAN_WINDOW_MS);

    // ── SAVE THIS SCAN ──────────────────────────────────────────────────────────
    // Only a scan that actually loaded data is saved, so a failed scan can never overwrite good results.
    if (okCount > 0) {
      const savedAt = Date.now();
      lastGoodScanRef.current = savedAt;
      lastGoodSigRef.current = sportsSig(selectedSports);
      saveSnapshot(uidRef.current, {
        v: SNAP_VERSION,
        savedAt,
        sports: lastGoodSigRef.current,
        arbs: foundVerified,
        arbsWA: foundArbsWAVerified,
        ev: foundEV,
        evWA: foundEVWA,
        middles: middlesGlobalResult,
        middlesWA: middlesWAResult,
        steam: steamResult,
        bestOdds: bestOddsGlobalResult,
        bestOddsWA: bestOddsWAResult,
        waHealth: Object.keys(waHealthAgg).length > 0 ? waHealthAgg : null,
        scanHealth: scanHealthResult,
        integrity: integrityReport,
        quota: quotaNow,
        userRegion: regionNow,
      });
    }
  }, [selectedSports, minEV]);

  const saveKey = () => {
    try { localStorage.setItem('oa_key', apiInput); } catch {}
    setApiKey(apiInput); setShowSetup(false); fetchOdds(apiInput);
  };

  // fetchOddsRef always points at the LATEST fetchOdds closure (current
  // selectedSports/minEV baked in), but reading it via ref rather than as a
  // direct effect dependency means the interval below never has to be torn
  // down and recreated when those change — editing the sports list just
  // changes what the NEXT scheduled tick will scan, without moving that
  // tick's time or firing an extra scan in between.
  const fetchOddsRef = React.useRef(fetchOdds);
  useEffect(() => { fetchOddsRef.current = fetchOdds; }, [fetchOdds]);

  const lastFetchRef = React.useRef(lastFetch);
  lastFetchRef.current = lastFetch;
  useEffect(() => {
  const scanNow = () => fetchOddsRef.current(apiKey || 'server');
  const ATTEMPT_GAP_MS = 2 * 60 * 1000; // never start two scans closer together than this (guards refresh-spamming and failed scans)
  const lastTry = () => (lastFetchRef.current ? new Date(lastFetchRef.current).getTime() : 0);
  // Reopening the site: if the saved scan is under 5 min old (and covers the same leagues), it is already on screen,
  // so wait out the rest of its 5-min window instead of scanning again. Otherwise scan right away.
  const sameSports = lastGoodSigRef.current === sportsSig(selectedSports);
  const goodAge = lastGoodScanRef.current ? Date.now() - lastGoodScanRef.current : Infinity;
  let delay = 0;
  if (sameSports && goodAge < SCAN_WINDOW_MS) delay = SCAN_WINDOW_MS - goodAge;
  else if (Date.now() - lastTry() < ATTEMPT_GAP_MS) delay = ATTEMPT_GAP_MS - (Date.now() - lastTry());
  let id = null;
  const first = setTimeout(() => { scanNow(); id = setInterval(scanNow, SCAN_WINDOW_MS); }, delay);
  // Phones pause timers while the screen is off or the tab is in the background, so a page left open can show
  // prices 20+ minutes old. Rescan as soon as the page is visible again IF the last good scan is over 5 min old
  // (so this never scans more often than every 5 min and the shared cache absorbs it).
  const onVisible = () => {
    if (document.visibilityState !== 'visible' || !apiKey) return;
    if (lastGoodScanRef.current && lastGoodSigRef.current === sportsSig(selectedSports) && Date.now() - lastGoodScanRef.current < SCAN_WINDOW_MS) return; // still current
    if (Date.now() - lastTry() < ATTEMPT_GAP_MS) return; // a scan was just started (visibilitychange and pageshow often fire together)
    lastFetchRef.current = new Date(); // claim it now
    scanNow();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onVisible);
  return () => {
    clearTimeout(first);
    if (id) clearInterval(id);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onVisible);
  };
}, [apiKey]); // fetchOdds intentionally omitted — read via fetchOddsRef so edits to
              // selectedSports/minEV don't tear down and restart this interval

  // ── TEAM FORM ────────────────────────────────────────────────────────────────
  // Fetches from /api/team-form (backed by API-Football) once on mount, then
  // every 6 hours — matching the server-side cache TTL so we never hammer the
  // upstream API. Falls back gracefully to the empty TEAM_FORM skeleton if the
  // endpoint isn't configured yet (API_FOOTBALL_KEY not set in Vercel env).
  const [teamForm, setTeamForm] = useState(TEAM_FORM);
  const [teamFormLoading, setTeamFormLoading] = useState(false);
  const [teamFormError, setTeamFormError] = useState('');

  const fetchTeamForm = useCallback(async () => {
    setTeamFormLoading(true);
    setTeamFormError('');
    try {
      // season=2024 = the 2024/25 season (API-Football keys by start year).
      // The 2025/26 season just ended but API-Football hasn't published its
      // finished fixtures yet under season=2025 — switch to 2025 once they do.
      const res = await fetch('/api/team-form?sport=all&season=2024');
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.warn('[team-form] fetch failed', res.status, body);
        setTeamFormError('Team form unavailable (' + res.status + ')');
        return;
      }
      const json = await res.json();
      if (!json.TEAM_FORM) {
        console.warn('[team-form] unexpected response shape', json);
        setTeamFormError('Team form unavailable (bad response)');
        return;
      }
      // Merge into the skeleton so missing leagues stay as {} not undefined
      setTeamForm(prev => {
        const merged = { ...prev, ...json.TEAM_FORM };
        teamFormRef.current = merged; // keep ref in sync for fetchOdds
        return merged;
      });
      console.log('[team-form] loaded', Object.keys(json.TEAM_FORM).length, 'leagues, season', json.season);
    } catch (err) {
      console.warn('[team-form] fetch threw', err);
      setTeamFormError('Team form unavailable');
    } finally {
      setTeamFormLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeamForm();
    const id = setInterval(fetchTeamForm, 6 * 60 * 60 * 1000); // refresh every 6h
    return () => clearInterval(id);
  }, [fetchTeamForm]);

  const betSyncChainRef = React.useRef(Promise.resolve());
  const betSyncQueuedRef = React.useRef(false);
  const latestBetsRef = React.useRef(bets);
  useEffect(() => {
  if (!session?.user?.id || !betsLoadedRef.current) return;
  const userId = session.user.id;
  latestBetsRef.current = bets;
  // Syncs run one at a time, and a burst of changes collapses into one run that uses the newest list.
  // INSERT BEFORE DELETE: the old rows are removed only after the new ones are stored, so a failed insert
  // (offline, RLS, timeout) can no longer wipe the user's whole bet history the way delete-then-insert did.
  if (betSyncQueuedRef.current) return;
  betSyncQueuedRef.current = true;
  betSyncChainRef.current = betSyncChainRef.current.then(async () => {
    betSyncQueuedRef.current = false;
    const snapshot = latestBetsRef.current;
    try {
      const { data: oldRows, error: readErr } = await supabase.from('tracked_bets').select('id').eq('user_id', userId);
      if (readErr) { console.error('Failed to sync bets (read):', readErr); return; }
      if (snapshot.length > 0) {
        const rows = snapshot.map(b => ({ user_id: userId, data: b }));
        const { error } = await supabase.from('tracked_bets').insert(rows);
        if (error) { console.error('Failed to sync bets:', error); return; } // keep the old rows
      }
      const oldIds = (oldRows || []).map(r => r.id);
      if (oldIds.length > 0) {
        const { error: delErr } = await supabase.from('tracked_bets').delete().in('id', oldIds);
        if (delErr) console.error('Superseded bet rows not removed (duplicates until next sync):', delErr);
      }
    } catch (err) { console.error('Failed to sync bets:', err); }
  });
}, [bets, session]);
  useEffect(() => { try { localStorage.setItem('arb_bankroll', bankroll.toString()); } catch {} }, [bankroll]);
  useEffect(() => { try { if (lastFetch) localStorage.setItem('arb_lastFetch', lastFetch.toISOString()); } catch {} }, [lastFetch]);
  useEffect(() => { try { if (nextScanAt) localStorage.setItem('arb_nextScanAt', String(nextScanAt)); } catch {} }, [nextScanAt]);

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

// Auto-verifies the scan's highest-value/highest-risk candidates against the
// live bookmaker API BEFORE they're shown (see pages/api/verify-top-candidates.js
// for the server-side selection/checking logic and why it re-queries the
// bookmaker directly rather than OddsPapi again). Distinct from recheckArb()
// below, which is the manual per-arb "recheck" button the user triggers
// themselves on an arb already on screen.
const verifyTopCandidates = async (candidates) => {
  if (!candidates || candidates.length === 0) return {};
  try {
    const res = await fetch('/api/verify-top-candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await getToken() },
      body: JSON.stringify({ candidates }),
    });
    const data = await res.json();
    if (!res.ok) return {};
    return Object.fromEntries(data.results.map(r => [r.id, r]));
  } catch {
    return {}; // verification failing should never block showing the scan results
  }
};

const recheckArb = async (arb) => {
  if (recheckingId === arb.id) return;
  setRecheckingId(arb.id);
  try {
    const res = await fetch('/api/verify-arb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await getToken() },
      body: JSON.stringify({ sport: arb.sport, home: arb.home, away: arb.away, commenceTime: arb.commenceTime, outcomes: arb.outcomes })
    });
    const data = await res.json();
    setRecheck(p => ({ ...p, [arb.id]: res.ok ? data : { error: data.error || 'Re-check failed' } }));
  } catch (err) {
    setRecheck(p => ({ ...p, [arb.id]: { error: 'Re-check failed' } }));
  }
  setRecheckingId(null);
};

const analyzeArb = async (arb) => {  
  if (analyzingId === arb.id) return;
  setAnalyzingId(arb.id);
  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await getToken() },
      body: JSON.stringify({
        match: arb.match, sport: getSportInfo(arb.sport).label, sportKey: arb.sport,
        outcomes: arb.outcomes, margin: arb.margin,
        marketType: arb.marketType || 'Match Winner'
      })
    });
    const data = await res.json();
    if (res.status === 402) { data.error = data.message || 'AI analysis is a Premium feature.'; setUpgradeNotice(data.error); }
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

  // Default view: clean arbs, plus any arb whose legs were just re-fetched live and confirmed.
  const recheckFresh = a => recheck[a.id] && recheck[a.id].verdict === 'confirmed' && Date.now() - new Date(recheck[a.id].checkedAt).getTime() < CONFIRMED_FRESH_MS;
  const isShownByDefault = a => recheckFresh(a) || (a.tier !== 'review' && !isArbExpired(a));
  const hiddenReview = arbsBase.filter(a => !isDenied(a) && !isShownByDefault(a)).length;

  const filteredArbs = arbsBase.filter(a => {
    if (groupFilter !== 'all') { const g = SPORT_GROUPS.find(g => g.group === groupFilter); if (g && !g.sports.some(s => s.key === a.sport)) return false; }
    if (wayFilter === '2' && a.outcomes.length !== 2) return false;
    if (wayFilter === '3' && a.outcomes.length !== 3) return false;
    if (isDenied(a)) return false;
    if (!showHighProfit && a.margin > DEFAULT_MAX_PROFIT) return false;
    if (!showReview && !isShownByDefault(a)) return false;
    if (accessOnly && !isFullyAccessible(a.outcomes, userRegion)) return false;
    if (arbSection === 'global' && isFullyAccessible(a.outcomes, userRegion)) return false;
    return a.margin >= minMargin;
  });

  // Independent totals for the metrics grid — each computed from its own properly-sourced
  // array (not a partition of one mixed array), same pattern as Line Shopping/Middles/+EV.
  const sameFilters = a => {
    if (isDenied(a)) return false;
    if (!showHighProfit && a.margin > DEFAULT_MAX_PROFIT) return false;
    if (!showReview && !isShownByDefault(a)) return false;
    if (groupFilter !== 'all') { const g = SPORT_GROUPS.find(g => g.group === groupFilter); if (g && !g.sports.some(s => s.key === a.sport)) return false; }
    if (wayFilter === '2' && a.outcomes.length !== 2) return false;
    if (wayFilter === '3' && a.outcomes.length !== 3) return false;
    return a.margin >= minMargin;
  };
  const arbsGlobal = arbs.filter(sameFilters);
  const arbsWA     = arbsWAReal.filter(sameFilters);

  const hiddenHighProfit = arbsBase.filter(a => !isDenied(a) && a.margin > DEFAULT_MAX_PROFIT).length;
  const hiddenByReports = arbsBase.filter(a => isDenied(a)).length;
  const calc = sel ? calcStakes(sel.outcomes, stake) : null;

  // ── KEY FIX: use named import instead of React.createElement
  const e = createElement;

  return e('div', { style: st.app },
    e('div', { style: st.header },
      e('div', { style: st.logoRow },
        e('img', { src: '/favicon.svg', alt: 'ArbEdge', width: 36, height: 36, style: { width: 36, height: 36, borderRadius: 8, display: 'block', flexShrink: 0 } }),
        e('div', null, e('div', { style: st.logoTitle }, 'ArbEdge'), e('div', { style: st.logoSub }, '\uD83C\uDF0D Global' + (isWAUserNow ? ' \u00B7 \uD83C\uDDEC\uD83C\uDDED West Africa' : '')))
      ),
      e('div', { style: st.headerRow },
        e('span', { style: st.badge('#052e16', '#6ee7b7') }, loading ? '⟳ ' + scanProgress.sport + '...' : '● ' + filteredArbs.length + ' arbs'),
        lastFetch && e('span', { style: st.badge('#1f2937', '#9ca3af') }, lastFetch.toLocaleTimeString()),
        isDemo && e('span', { style: st.badge('#451a03', '#fcd34d') }, '⚠ Demo'),
        e('button', { onClick: () => setShowSetup(v => !v), style: { ...st.btn('outline'), fontSize: 11, padding: '4px 10px' } }, apiKey ? '⚙ Connected' : 'Connect Live ↗')
      ),
      showSetup && e('div', { style: st.setupBox },
        e('div', { style: st.setupText }, 'Free API key at the-odds-api.com — covers FIFA World Cup, AFCON, all tennis Slams, NBA, UFC, Cricket + 100 leagues.'),
        e('div', { style: { display: 'flex', gap: 8 } },
          e('input', { value: apiInput, onChange: ev => setApiInput(ev.target.value), placeholder: 'Paste Odds API key...', style: { ...st.input, flex: 1, background: '#1f2937', borderColor: '#374151', color: '#f9fafb' } }),
          e('button', { onClick: saveKey, style: st.btn('primary') }, 'Save')
        )
      ),
    ),
           e('div', { style: { display: 'flex', justifyContent: 'flex-end', padding: '6px 4px' } },
  e('button', { onClick: () => setMenuOpen(true), style: { fontSize: 13, padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', color: '#111827', background: '#fff', cursor: 'pointer', fontWeight: 600 } }, '\u2630 Menu')
),
    renderMenu(),
    plan.loaded && e('div', { style: { margin: '8px 4px', padding: '10px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.5, color: '#1f2937', background: plan.isPremium ? '#ecfdf5' : '#fefce8', border: '1px solid ' + (plan.isPremium ? '#a7f3d0' : '#fde68a') } },
      plan.isPremium
        ? plan.isOwner ? 'Owner access: everything is unlocked.' : 'Premium active' + (plan.periodEnd ? ' until ' + new Date(plan.periodEnd).toLocaleDateString() : '') + '.'
        : plan.notAvailable ? 'ArbEdge is not available in the United States yet. We do not have odds coverage for US sportsbooks.'
        : Object.keys(plan.quotes).length === 0 ? 'Payments are temporarily unavailable. Please try again in a few minutes.'
        : e('div', null,
            e('div', { style: { marginBottom: 8 } }, upgradeNotice || 'Free plan: a limited set of leagues. Go Premium for every league, all books and the full toolset.'),
            e('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } },
              Object.keys(plan.quotes).length > 1 && e('select', { value: curSel, onChange: ev => setPayCurrency(ev.target.value), style: { padding: '6px 8px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12 } },
                Object.keys(plan.quotes).map(c => e('option', { key: c, value: c }, c))
              ),
              e('button', { onClick: () => startCheckout('prepaid'), disabled: checkoutLoading, style: st.btn('primary') }, checkoutLoading ? 'Opening...' : 'Pay ' + priceLabel + ' for 30 days'),
              plan.autoCurrencies.includes(curSel) && e('button', { onClick: () => startCheckout('auto'), disabled: checkoutLoading, style: st.btn('outline') }, 'Auto-renew ' + priceLabel + '/month (card)')
            ),
            chargeNote
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

      // Partial cash out math
      const partialFrac = partialPct / 100;
      const partialCashNow = offerN * partialFrac;               // guaranteed cash received now
      const partialStakeRiding = stakeN * (1 - partialFrac);    // effective stake still at risk
      const partialWinPayout = potentialPayout * (1 - partialFrac); // extra payout if remaining leg wins
      const partialBreakEven = partialCashNow;                   // worst case: already secured this

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
          ),

          // ── PARTIAL CASH OUT BREAKDOWN ────────────────────────────────────
          offerN > 0 && e('div', { key: 'partial', style: { background: '#1f2937', borderRadius: 12, padding: '14px', marginTop: 4 } },
            e('div', { style: { fontSize: 13, fontWeight: 700, color: '#f9fafb', marginBottom: 4 } }, '⚖️ Partial Cash Out'),
            e('div', { style: { fontSize: 11, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 } },
              'Cash out a portion now, let the rest ride. Drag to find your risk/reward sweet spot.'
            ),
            e('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 } },
              e('span', { style: { fontSize: 12, color: '#9ca3af' } }, 'Cash out %'),
              e('span', { style: { fontSize: 14, fontWeight: 700, color: '#f9fafb' } }, partialPct + '%')
            ),
            e('input', {
              type: 'range', min: 0, max: 100, step: 5, value: partialPct,
              onChange: ev => setPartialPct(parseInt(ev.target.value)),
              style: { width: '100%', marginBottom: 14, accentColor: C.green }
            }),
            e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 } },
              [
                ['Cashing out now', currency + partialCashNow.toFixed(2), '#6ee7b7', '#052e16'],
                ['Stake still at risk', currency + partialStakeRiding.toFixed(2), '#fca5a5', '#450a0a'],
                ['Payout if remaining wins', currency + partialWinPayout.toFixed(2), '#93c5fd', '#1e3a8a'],
                ['Break-even guaranteed', currency + partialBreakEven.toFixed(2), '#fcd34d', '#451a03'],
              ].map(([label, val, fg, bg]) =>
                e('div', { key: label, style: { background: bg, borderRadius: 8, padding: '8px 10px' } },
                  e('div', { style: { fontSize: 10, color: fg, opacity: 0.8, marginBottom: 2 } }, label),
                  e('div', { style: { fontSize: 16, fontWeight: 700, color: fg } }, val)
                )
              )
            ),
            e('div', { style: { background: '#111827', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#9ca3af', lineHeight: 1.6 } },
              partialPct === 0
                ? '🎯 Holding everything. Full ' + currency + potentialPayout.toFixed(2) + ' payout if it wins, full ' + currency + stakeN.toFixed(2) + ' lost if not.'
                : partialPct === 100
                ? '🔒 Full cash out. ' + currency + offerN.toFixed(2) + ' locked in, no further exposure.'
                : '🔀 Cashing ' + partialPct + '% locks in ' + currency + partialCashNow.toFixed(2) + ' now. The remaining ' + (100 - partialPct) + '% of your stake (' + currency + partialStakeRiding.toFixed(2) + ') stays in play — if it wins you collect an extra ' + currency + partialWinPayout.toFixed(2) + ', if it loses you keep only the ' + currency + partialCashNow.toFixed(2) + ' you already took. Your worst-case is ' + currency + (partialCashNow - stakeN).toFixed(2) + ' vs a full loss of -' + currency + stakeN.toFixed(2) + ' holding.'
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
          [myLabel, arbsWA.length, C.green],
          ['Next Scan', loading ? '...' : (nextScanAt && !loading ? (countdown > 0 ? Math.floor(countdown / 60) + ':' + String(countdown % 60).padStart(2, '0') : '0:00') : '—'), loading ? C.muted : countdown < 30 && countdown > 0 && !loading ? C.amber : C.text]
        ].map(([l, v, c]) =>
          e('div', { key: l, style: st.metric }, e('div', { style: st.metricLabel }, l), e('div', { style: st.metricVal(c) }, v))
        )
      ),
      // Region toggle
      e('div', { style: { display: 'flex', gap: 6, marginBottom: 12 } },
        [['all','🔍 All'], ['global','🌍 Global only'], ['wa',myLabelOnly]].map(([k,l]) =>
          e('button', { key: k, onClick: () => setArbSection(k), style: { ...st.btn(arbSection === k ? 'primary' : 'outline'), fontSize: 12, padding: '6px 12px' } }, l)
        )
      ),
      isWAUserNow && (arbSection === 'wa' || arbSection === 'all') && e('div', {
        style: { background: '#dcfce7', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: C.greenDark }
      }, '🇬🇭 Scanning 3 West Africa-accessible sportsbooks: SportyBet, Betway, 1xBet. More being added.'),
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
        e('button', { onClick: () => setShowSportPicker(v => !v), style: { ...st.btn('outline'), fontSize: 12, padding: '6px 10px' } }, '⚙ Sports (' + selectedSports.length + ')')
      ),
      showSportPicker && e('div', { style: { background: C.white, border: '1px solid ' + C.border, borderRadius: 12, padding: 14, marginBottom: 14, maxHeight: 300, overflowY: 'auto' } },
        e('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 10 } },
          e('span', { style: { fontSize: 13, fontWeight: 600 } }, 'Select sports to scan'),
          e('div', { style: { display: 'flex', gap: 6 } },
            e('button', { onClick: () => setSportsExactly(TOP_SPORTS), style: { ...st.btn('outline'), fontSize: 11, padding: '4px 8px' } }, 'Default'),
            e('button', { onClick: () => setSportsExactly(allowedKeys), style: { ...st.btn('success'), fontSize: 11, padding: '4px 8px' } }, 'All'),
            e('button', { onClick: () => setSelectedSports([]), style: { ...st.btn('danger'), fontSize: 11, padding: '4px 8px' } }, 'None')
          )
        ),
        pickerNotice && e('div', { style: { background: '#fefce8', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '8px 10px', fontSize: 12, marginBottom: 10, lineHeight: 1.5 } },
          pickerNotice, ' ',
          e('button', { onClick: () => startCheckout('prepaid'), disabled: checkoutLoading, style: { ...st.btn('primary'), fontSize: 11, padding: '4px 10px', marginLeft: 6 } }, checkoutLoading ? 'Opening...' : 'Go Premium')
        ),
        pickerGroups.map(g => e('div', { key: g.group, style: { marginBottom: 12 } },
          e('div', { onClick: () => { const keys = g.sports.map(s => s.key); const allOn = keys.every(k => selectedSports.includes(k)); if (allOn) { setSelectedSports(p => p.filter(k => !keys.includes(k))); } else { addSports(keys); } }, style: { fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 } },
            e('input', { type: 'checkbox', readOnly: true, checked: g.sports.every(s => selectedSports.includes(s.key)) }), ' ', g.group
          ),
          e('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 8 } },
            g.sports.map(s => e('label', { key: s.key, style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', background: selectedSports.includes(s.key) ? C.greenLight : C.grayLight, padding: '3px 8px', borderRadius: 20, color: selectedSports.includes(s.key) ? C.greenDark : C.muted } },
              e('input', { type: 'checkbox', checked: selectedSports.includes(s.key), onChange: () => toggleSport(s.key) }), ' ', s.label + (isLocked(s.key) ? ' \uD83D\uDD12' : '')
            ))
          )
        ))
      ),
      error && e('div', { style: { background: '#fef3c7', color: '#92400e', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 } }, error),
        quota.remaining !== null && e('div', { style: { background: parseInt(quota.remaining) < 50 ? '#fef3c7' : '#f0fdf4', color: parseInt(quota.remaining) < 50 ? '#92400e' : '#14532d', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10, display: 'flex', justifyContent: 'space-between' } }, e('span', null, 'Key ' + (quota.keyIndex || 1) + ' | Used: ' + quota.used), e('span', { style: { fontWeight: 700 } }, quota.remaining + ' remaining')),
      isDemo && !error && e('div', { style: { background: C.blueLight, color: '#1e3a8a', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 12, lineHeight: 1.5 } },
        apiKey
          ? '📌 No live arbitrage opportunities right now — showing example cards (marked DEMO) so you can see how it works. Scan runs again automatically every 5 min.'
          : '📌 Demo mode — tap Connect Live to scan real odds across the ' + 20 + ' top leagues. For Betano, MSport & SportyBet odds, use the ✏️ Manual Arb tab.'
      ),
      integrity && (integrity.total > 0 || Object.keys(integrity.quarantined || {}).length > 0) && e('div', { style: { fontSize: 11, color: '#1e3a8a', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 8px', marginBottom: 8, lineHeight: 1.5 } },
        integrity.total > 0 && e('div', null, '🛡 ' + integrity.total + ' quote' + (integrity.total === 1 ? '' : 's') + ' excluded by data-integrity checks (impossible margins or out-of-order lines) — they never enter an arb. ' + Object.entries(integrity.byBook).map(([b, n]) => b + ': ' + n).join(', ')),
        integrity.total > 0 && e('div', null, 'Why: ' + Object.entries(integrity.byReason || {}).map(([r, n]) => r + ' x' + n).join('; ') + (integrity.examples && integrity.examples.length ? ' | e.g. ' + integrity.examples.slice(0, 3).map(x => x.book + ' ' + x.market + ' (' + x.match + ')').join('; ') : '')),
        scanHealth && scanHealth.arbDiag && scanHealth.arbDiag.consensus && Object.keys(scanHealth.arbDiag.consensus).length > 0 && e('div', null, 'Consensus filter rejected legs (price too far above other books / too few books quote it): ' + Object.entries(scanHealth.arbDiag.consensus).map(([b, d]) => b + ' high ' + d.high + ', thin ' + d.thin).join('; ')),
        Object.entries(integrity.quarantined || {}).map(([b, why]) => e('div', { key: b }, '⏸ ' + b + ' is held back from all results: ' + why + '.'))
      ),
      filteredArbs.length === 0 && !isDemo && e('div', { style: { textAlign: 'center', padding: '40px 16px', color: C.muted } },
        e('div', { style: { fontSize: 28, marginBottom: 10 } }, '✅'),
        e('div', { style: { fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 } }, 'No arbitrage opportunities in this scan'),
        e('div', { style: { fontSize: 12, lineHeight: 1.6 } }, 'The scan completed and no cross-book arbs passed the checks. That is a normal result — real arbs are rare and short-lived.')
      ),
 (hiddenReview > 0 || showReview) && e('div', { style: { fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 8px', marginBottom: 8, lineHeight: 1.5 } },
   !showReview ? e('div', null, '🔍 ' + hiddenReview + ' arb' + (hiddenReview === 1 ? '' : 's') + ' hidden: not enough cross-checks or a flagged price. ', e('a', { href: '#', style: { fontWeight: 700 }, onClick: ev => { ev.preventDefault(); setShowReview(true); } }, 'Show review arbs'))
     : e('div', null, 'Showing review arbs: verify every leg on the book before staking. ', e('a', { href: '#', style: { fontWeight: 700 }, onClick: ev => { ev.preventDefault(); setShowReview(false); } }, 'Hide again'))
 ),
 (hiddenHighProfit > 0 || showHighProfit || hiddenByReports > 0) && e('div', { style: { fontSize: 11, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', marginBottom: 8, lineHeight: 1.5 } },
   hiddenHighProfit > 0 && !showHighProfit && e('div', null, '🔒 ' + hiddenHighProfit + ' arb' + (hiddenHighProfit === 1 ? '' : 's') + ' above +' + DEFAULT_MAX_PROFIT + '% hidden — that size is far more often a bad price than a real edge. ', e('a', { href: '#', style: { fontWeight: 700 }, onClick: ev => { ev.preventDefault(); setShowHighProfit(true); } }, 'Show them')),
   showHighProfit && e('div', null, 'Showing arbs above +' + DEFAULT_MAX_PROFIT + '% — treat each as unverified until checked on the book. ', e('a', { href: '#', style: { fontWeight: 700 }, onClick: ev => { ev.preventDefault(); setShowHighProfit(false); } }, 'Hide again')),
   hiddenByReports > 0 && e('div', null, '🚩 ' + hiddenByReports + ' arb' + (hiddenByReports === 1 ? '' : 's') + ' hidden because you reported them.')
 ),
 filteredArbs.map(arb => {
        const info = getSportInfo(arb.sport);
        // Group outcomes by market so mixed-market arbs are easy to read
        const marketGroups = {};
        arb.outcomes.forEach(o => {
          const mk = o.marketLabel || 'Match Winner';
          (marketGroups[mk] = marketGroups[mk] || []).push(o);
        });
        const multiMarket = Object.keys(marketGroups).length > 1;
        return e('div', { key: arb.id, style: st.card(sel && sel.id === arb.id, isDemo), onClick: () => setSel(sel && sel.id === arb.id ? null : arb) },
          e('div', { style: st.cardRow },
            e('div', null, e('div', { style: st.sportLabel }, info.emoji + ' ' + info.label + ' · ⏱ ' + timeUntil(arb.commenceTime)), e('div', { style: st.matchTitle }, arb.match)),
            e('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 } },
              isDemo && e('span', { style: st.badge('#451a03', '#fcd34d') }, 'DEMO'),
              !isFullyAccessible(arb.outcomes, userRegion) && e('span', { style: st.badge('#7f1d1d', '#fecaca') }, '🚫 Not all books accessible'),
              e('span', { style: st.profitBadge(arb.margin) }, '+' + arb.margin.toFixed(1) + '%')
            )
          ),
          arb.firstSeenMs && e('div', { style: { fontSize: 10, color: C.muted, marginTop: 4 } }, '⏳ Seen for ' + fmtAgeShort(Date.now() - arb.firstSeenMs)),
          arb.firstSeenMs && arb.margin >= HIGH_MARGIN_REVIEW && (Date.now() - arb.firstSeenMs) >= PERSIST_SUSPICIOUS_MS && e('div', { style: { fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 8px', marginTop: 6 } }, '⚠ This arb has stayed open for ' + fmtAgeShort(Date.now() - arb.firstSeenMs) + '. Real edges of this size are usually closed within minutes — a price that never moves is more likely stale.'),
          e('div', { style: { fontSize: 11, marginTop: 6, fontWeight: 600, color: (recheck[arb.id] && recheck[arb.id].verdict === 'confirmed') ? C.greenDark : (arb.liveVerify ? '#1e3a8a' : '#92400e') } },
            recheck[arb.id] && recheck[arb.id].verdict === 'confirmed' ? '✅ Verified live · ' + fmtAgeShort(Date.now() - new Date(recheck[arb.id].checkedAt).getTime()) + ' ago'
            : recheck[arb.id] && recheck[arb.id].verdict ? '⚠️ Re-checked: see result below'
            : arb.liveVerify ? '🔎 Live-checked at scan: ' + String(arb.liveVerify.status || 'checked').replace(/_/g, ' ')
            : '⏳ Feed data, not live-verified. Confirm each leg on the bookmaker and bet only at or above the minimum odds shown.'),
          arb.pulledAtMs && e('div', { style: { fontSize: 10, marginTop: 3, color: isArbExpired(arb) ? '#b91c1c' : C.muted, fontWeight: isArbExpired(arb) ? 700 : 400 } },
            isArbExpired(arb)
              ? '⌛ Expired: prices pulled ' + new Date(arb.pulledAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + fmtAgeShort(Date.now() - arb.pulledAtMs) + ' ago). Rescan before using.'
              : '🕒 Prices pulled ' + new Date(arb.pulledAtMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + fmtAgeShort(Date.now() - arb.pulledAtMs) + ' ago). A bookmaker can change a price after that.'),
          arb.verify && arb.verify.level === 'review' && e('div', { style: { fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 8px', marginTop: 6 } }, '⚠ Verify on the book before staking: ' + arb.verify.reasons.join(' · ')),
          Object.entries(marketGroups).map(([mktLabel, outs]) =>
            e('div', { key: mktLabel },
              multiMarket && e('div', { style: { fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, marginBottom: 4 } }, mktLabel),
              e('div', { style: st.oddsGrid(outs.length) },
                outs.map((o, i) => e('div', { key: i, style: st.oddsCell },
                  e('div', { style: { fontSize: 10, color: C.muted, marginBottom: 1 } }, mktLabel + (multiMarket ? '' : '')),
                  e('div', { style: { fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 1 } }, o.label),
                  e('div', { style: { fontSize: 12, color: C.muted, marginBottom: 1 } }, o.bookName),
                  o.srcLabel && e('div', { style: { fontSize: 9, lineHeight: 1.3, marginBottom: 1, color: (o.srcStart && Math.abs(new Date(o.srcStart) - new Date(arb.commenceTime)) > KICKOFF_DIFF_MS) ? '#b45309' : C.muted } },
                    '📄 ' + o.srcLabel + ((o.srcStart && Math.abs(new Date(o.srcStart) - new Date(arb.commenceTime)) > KICKOFF_DIFF_MS) ? ' · kickoff ' + new Date(o.srcStart).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' ≠ other books' : '')),
                  !isBookAccessible(o.book, userRegion) && e('div', { style: { fontSize: 9, fontWeight: 700, color: '#b91c1c', marginBottom: 1 } }, '🚫 Not accessible'),
                  e('div', { style: { fontSize: 16, fontWeight: 700, color: C.green } }, o.odds.toFixed(2)),
                  o.minOdds && e('div', { style: { fontSize: 9, color: '#92400e', marginTop: 1 } }, 'bet only at ≥ ' + o.minOdds.toFixed(2)),
                  o.feedVerified === false && e('div', { style: { fontSize: 9, fontWeight: 700, color: '#b45309', marginTop: 1 } }, '⚠ unverified feed'),
                  typeof o.fairDev === 'number' && e('div', { style: { fontSize: 9, color: C.muted } }, (o.fairDev >= 0 ? '+' : '') + (o.fairDev * 100).toFixed(1) + '% vs sharp fair price'),
                  typeof o.updatedAt === 'number' && e('div', { style: { fontSize: 9, color: C.muted } }, (o.updatedKind === 'pull' ? 'fetched ' : 'price last changed ') + new Date(o.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
                  legManualLink(o, recheck[arb.id]) && e('a', { href: legManualLink(o, recheck[arb.id]), target: '_blank', rel: 'noopener noreferrer', onClick: ev => ev.stopPropagation(), style: { display: 'block', marginTop: 4, fontSize: 10, fontWeight: 700, color: '#1e3a8a', background: C.blueLight, border: '1px solid #bfdbfe', borderRadius: 6, padding: '3px 6px', textDecoration: 'none', textAlign: 'center' } }, 'Check price on ' + (o.bookName || '22Bet') + ' ↗'),
                  e('a', { href: (BOOKS[o.book] && BOOKS[o.book].sportUrls && BOOKS[o.book].sportUrls[arb.sport.split('_')[0]]) || (BOOKS[o.book] && BOOKS[o.book].url) || '#', target: '_blank', style: { display: 'block', marginTop: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: C.green, borderRadius: 6, padding: '3px 6px', textDecoration: 'none', textAlign: 'center' } }, 'Bet Now →')
                ))
              )
            )
          ),
          sel && sel.id === arb.id && e('div', { style: { marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' } },
            e('button', { style: st.btn('primary'), onClick: ev => { ev.stopPropagation(); setTab('calculator'); } }, 'Calculate →'),
            e('button', { style: { ...st.btn('outline'), fontSize: 12 }, onClick: ev => { ev.stopPropagation(); setReportOpenId(reportOpenId === arb.id ? null : arb.id); setReportStatus('idle'); } }, '🚩 Report'),
            e('button', { style: { ...st.btn('outline'), fontSize: 12 }, onClick: ev => { ev.stopPropagation(); analyzeArb(arb); } }, analyzingId === arb.id ? 'Analyzing...' : 'AI Analysis'),
            arb.home && e('button', { style: { ...st.btn('outline'), fontSize: 12 }, onClick: ev => { ev.stopPropagation(); recheckArb(arb); } }, recheckingId === arb.id ? 'Checking...' : '🔄 Re-check (uses API quota)')
          ),
          recheck[arb.id] && e('div', { style: { marginTop: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', fontSize: 12, lineHeight: 1.6 } },
            recheck[arb.id].error
              ? e('div', { style: { color: '#dc2626' } }, '⚠️ ' + recheck[arb.id].error)
              : e('div', null,
                  e('div', { style: { fontWeight: 700, marginBottom: 4 } },
                    recheck[arb.id].verdict === 'confirmed' ? '✅ Confirmed live: +' + recheck[arb.id].freshMargin.toFixed(2) + '%'
                    : recheck[arb.id].verdict === 'partial' ? '⚠️ Partly re-checked: +' + recheck[arb.id].freshMargin.toFixed(2) + '% (some legs could not be re-checked)'
                    : recheck[arb.id].verdict === 'gone' ? '❌ Arb is gone at current prices (' + recheck[arb.id].freshMargin.toFixed(2) + '%)'
                    : '❌ A leg is no longer offered or could not be fetched'),
                  recheck[arb.id].legs.map((l, li) => e('div', { key: li, style: { color: C.muted } },
                    l.label + ' · ' + l.book + ': ' + l.was.toFixed(2) + (l.now != null ? ' → ' + l.now.toFixed(2) : '') + ' (' + l.status.replace(/_/g, ' ') + ')')),
                  e('div', { style: { fontSize: 10, color: C.muted, marginTop: 4 } }, 'Checked ' + new Date(recheck[arb.id].checkedAt).toLocaleTimeString())
                )
          ),
          reportOpenId === arb.id && e('div', { onClick: ev => ev.stopPropagation(), style: { marginTop: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', fontSize: 12, lineHeight: 1.6 } },
            e('div', { style: { fontWeight: 700, marginBottom: 6 } }, '🚩 What is wrong with this arb?'),
            e('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
              REPORT_REASONS.map(r => e('button', { key: r.key, style: { ...st.btn(reportReason === r.key ? 'primary' : 'outline'), fontSize: 11 }, onClick: () => { setReportReason(r.key); setReportStatus('idle'); } }, r.label))
            ),
            e('div', { style: { fontWeight: 600, margin: '8px 0 4px' } }, 'Which leg looks wrong?'),
            e('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
              [{ book: 'all', name: 'Not sure — hide the whole arb' }].concat([...new Set(arb.outcomes.map(o => o.book))].map(b => ({ book: b, name: arb.outcomes.find(o => o.book === b).bookName }))).map(x =>
                e('button', { key: x.book, style: { ...st.btn(reportLeg === x.book ? 'primary' : 'outline'), fontSize: 11 }, onClick: () => setReportLeg(x.book) }, x.name))
            ),
            e('div', { style: { marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
              e('button', { style: { ...st.btn('primary'), fontSize: 12 }, onClick: () => submitReport(arb) }, reportStatus === 'sending' ? 'Sending...' : 'Submit report'),
              reportStatus === 'pick' && e('span', { style: { color: '#b91c1c' } }, 'Pick a reason first.'),
              reportStatus === 'error' && e('span', { style: { color: '#b91c1c' } }, 'Could not save the report — try again.')
            ),
            e('div', { style: { fontSize: 10, color: C.muted, marginTop: 6 } }, 'Hides this ' + (reportLeg === 'all' ? 'arb' : 'book\'s record of this match') + ' for you' + (reportReason ? ' for ' + REPORT_REASONS.find(r => r.key === reportReason).ttlHours + ' hours.' : ' until the report expires.'))
          ),
          cardAnalysis[arb.id] && e('div', { style: { marginTop: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', fontSize: 12, lineHeight: 1.6 } },
            cardAnalysis[arb.id].error
              ? e('div', { style: { color: '#dc2626' } }, '⚠️ ' + cardAnalysis[arb.id].error)
              : e('div', null,
                  e('div', { style: { fontWeight: 700, fontSize: 13, color: C.greenDark, marginBottom: 8 } }, '🤖 AI Analysis'),
                  (() => {
                    const ca = cardAnalysis[arb.id];
                    const cell = (kk, label, val, color) => val ? e('div', { key: kk, style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, label), e('div', { style: { fontWeight: 700, color } }, val)) : null;
                    const cells = [
                      cell('p', 'Predicted', ca.predictedOutcome, C.text),
                      cell('c', 'Confidence', ca.confidence ? ca.confidence + '%' : null, C.blue),
                      cell('r', 'Risk', ca.riskLevel, C.amber),
                      cell('v', 'Best Value', ca.valueLeg, C.green),
                    ].filter(Boolean);
                    return cells.length ? e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 } }, cells) : null;
                  })(),
                  cardAnalysis[arb.id].valueAssessment && e('div', { style: { background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 12, lineHeight: 1.5 } },
                    e('div', { style: { fontWeight: 700, fontSize: 11, color: C.muted, marginBottom: 4 } }, '⚖️ VALUE ASSESSMENT'),
                    e('div', { style: { color: C.text } }, cardAnalysis[arb.id].valueAssessment)
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
        [['global','🌍 Global'], ['wa',myLabel]].map(([k,l]) =>
          e('button', { key: k, onClick: () => setEvSection(k), style: { ...st.btn(evSection === k ? 'primary' : 'outline'), fontSize: 12, padding: '7px 14px' } }, l)
        )
      ),
      // Reference book info banner
      e('div', { style: { background: evSection === 'wa' ? '#dcfce7' : '#eff6ff', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: evSection === 'wa' ? C.greenDark : '#1e3a8a' } },
        (evSection === 'wa'
          ? (isWAUserNow ? '🇬🇭 Using Pinnacle / Betfair as sharp reference — showing only WA-accessible books (Betway, SportyBet, Betano, MSport, 1xBet)' : 'Using Pinnacle / Betfair as sharp reference \u2014 showing only books available in your region.')
          : '🌍 Using Pinnacle / Betfair as sharp reference — showing all books globally') + evDiagLine(evSection === 'wa' ? evDiagWA : evDiag)
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
              : (() => {
                  const d = evSection === 'wa' ? evDiagWA : evDiag;
                  if (!d) return 'Scan finished but no diagnostics were recorded.';
                  if (d.eventsTotal === 0) return 'No events with 2+ bookmakers were found in this scan.';
                  if (d.eventsWithSharp === 0) return 'None of the ' + d.eventsTotal + ' events scanned had a usable sharp reference (Pinnacle, Betfair, Singbet or SBOBet with a complete match-result market), so +EV cannot be calculated. This is a data gap, not a lack of value — the Odds API may be out of credits or not returning these books for the sports selected.';
                  return d.eventsWithSharp + ' of ' + d.eventsTotal + ' events had a sharp reference; ' + d.compared + ' bookmaker prices were compared' + (d.bestEV !== null ? ' and the best edge was ' + (d.bestEV >= 0 ? '+' : '') + d.bestEV.toFixed(1) + '%' : '') + ', below your +' + minEV + '% threshold. Lower Min EV to see smaller edges.';
                })()
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
            bet.flag && e('div', { style: { fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 8px', marginTop: 6 } }, '⚠ ' + bet.flag),
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
      // ── Scan Health Panel ───────────────────────────────────────────────────
      scanHealth && e('div', { style: { background: '#1f2937', borderRadius: 12, padding: '12px 14px', marginBottom: 14 } },
        e('div', { style: { fontSize: 13, fontWeight: 700, color: '#f9fafb', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          e('span', null, '🇬🇭 West Africa Scan Health'),
          e('span', { style: { fontSize: 11, color: '#6b7280' } }, new Date(scanHealth.scannedAt).toLocaleTimeString())
        ),
        e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 } },
          scanHealth.waBooks.map(b =>
            e('div', { key: b.key, style: { display: 'flex', alignItems: 'center', gap: 6, background: b.seen ? '#052e16' : '#111827', borderRadius: 8, padding: '6px 10px' } },
              e('span', null, b.seen ? '✅' : '⬜'),
              e('div', null,
                e('div', { style: { fontSize: 12, fontWeight: 600, color: b.seen ? '#6ee7b7' : '#6b7280' } }, b.name),
                e('div', { style: { fontSize: 10, color: b.seen ? '#4ade80' : '#4b5563' } }, b.seen ? 'Live in scan' : 'Not seen')
              )
            )
          )
        ),
        e('div', { style: { display: 'flex', gap: 8 } },
          e('div', { style: { flex: 1, background: '#111827', borderRadius: 8, padding: '8px 10px', textAlign: 'center' } },
            e('div', { style: { fontSize: 22, fontWeight: 700, color: '#f9fafb' } }, scanHealth.eventsScanned),
            e('div', { style: { fontSize: 11, color: '#6b7280', marginTop: 2 } }, 'total events scanned')
          ),
          e('div', { style: { flex: 1, background: scanHealth.eventsWithWACoverage > 0 ? '#052e16' : '#111827', borderRadius: 8, padding: '8px 10px', textAlign: 'center' } },
            e('div', { style: { fontSize: 22, fontWeight: 700, color: scanHealth.eventsWithWACoverage > 0 ? '#6ee7b7' : '#6b7280' } }, scanHealth.eventsWithWACoverage),
            e('div', { style: { fontSize: 11, color: '#6b7280', marginTop: 2 } }, 'events with WA coverage')
          )
        ),
        scanHealth.arbDiag && e('div', { style: { marginTop: 10, background: '#111827', borderRadius: 8, padding: '8px 10px' } },
          e('div', { style: { fontSize: 12, fontWeight: 700, color: '#f9fafb', marginBottom: 4 } }, '🔁 Duplicate odds'),
          Object.keys(scanHealth.arbDiag.dups || {}).length === 0
            ? e('div', { style: { fontSize: 11, color: '#6ee7b7' } }, 'None in this scan: no book listed the same selection at several prices.')
            : Object.entries(scanHealth.arbDiag.dups).map(([k, d]) =>
                e('div', { key: k, style: { fontSize: 11, color: '#fbbf24', marginTop: 4 } },
                  e('div', { style: { fontWeight: 600 } }, ((BOOKS[k] && BOOKS[k].name) || k) + ': ' + d.groups + ' group' + (d.groups === 1 ? '' : 's') + ' (' + Object.entries(d.byMarket || {}).map(([m, n]) => m + ' ' + n).join(', ') + ')'),
                  (d.examples || []).map((x, i) => e('div', { key: i, style: { fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', marginTop: 2, wordBreak: 'break-word' } }, x)))),
          Object.keys(scanHealth.arbDiag.unresolved || {}).length > 0 && e('div', { style: { marginTop: 8, fontSize: 11, color: '#f59e0b' } },
            '⚠ Team names not resolved: ' + Object.entries(scanHealth.arbDiag.unresolved).map(([k, u]) => ((BOOKS[k] && BOOKS[k].name) || k) + ' ' + u.unresolved + (u.rescuedByOwnNames ? ' (' + u.rescuedByOwnNames + ' rescued)' : '')).join(', '))
        ),
        scanHealth.eventsWithWACoverage === 0 && e('div', { style: { marginTop: 10, fontSize: 12, color: '#f59e0b', background: '#451a03', borderRadius: 8, padding: '8px 10px' } },
          '⚠ No events had 2+ WA books priced. This means Betway/1xBet aren\'t appearing in the Odds API feed for your selected sports right now — likely off-season or those books aren\'t covered for the current leagues.'
        )
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
          [['global','🌍 Global'], ['wa',myLabel]].map(([k,l]) =>
            e('button', { key: k, onClick: () => setLineshopSection(k), style: { ...st.btn(lineshopSection === k ? 'primary' : 'outline'), fontSize: 12, padding: '7px 14px' } }, l)
          )
        ),
        e('div', { style: { background: lineshopSection === 'wa' ? '#dcfce7' : '#eff6ff', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: lineshopSection === 'wa' ? C.greenDark : '#1e3a8a' } },
          lineshopSection === 'wa'
            ? (isWAUserNow ? '🇬🇭 Comparing only books accessible in West Africa (Betway, SportyBet, Betano, MSport, 1xBet) — gaps shown are bets you can actually place.' : regionFallbackText)
            : '🌍 Comparing all scanned books worldwide, including books not accessible from West Africa.'
        ),
        (() => {
          const activeOdds = lineshopSection === 'wa' ? bestOddsWA : bestOdds;
          if (activeOdds.length === 0) return e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } },
            e('div', { style: { fontSize: 32, marginBottom: 8 } }, '🛒'),
            e('div', { style: { fontSize: 14 } },
              lineshopSection === 'wa'
                ? (isWAUserNow ? 'No West Africa price gaps found yet. Run a scan, or odds may be aligned across WA books right now.' : 'No price gaps found yet among books available in your region. Run a scan.')
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
          '↔ A middle is when two books offer different spread/total lines on the same game, creating a window of results where BOTH bets win. Outside the window one bet wins and one loses, and unless the prices are unusually good that is a small net loss. "Lands" is an estimate from the market\'s own prices, not a promise. Only bet what you can afford to lose.'
        ),
        // Region section toggle
        e('div', { style: { display: 'flex', gap: 6, marginBottom: 10 } },
          [['global','🌍 Global'], ['wa',myLabel]].map(([k,l]) =>
            e('button', { key: k, onClick: () => setMiddleSection(k), style: { ...st.btn(middleSection === k ? 'primary' : 'outline'), fontSize: 12, padding: '7px 14px' } }, l)
          )
        ),
        e('div', { style: { background: middleSection === 'wa' ? '#dcfce7' : '#fdf4ff', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: middleSection === 'wa' ? C.greenDark : '#6b21a8' } },
          middleSection === 'wa'
            ? (isWAUserNow ? '🇬🇭 Both legs must be on books accessible in West Africa (Betway, SportyBet, Betano, MSport, 1xBet) — every middle shown here is placeable.' : 'Both legs must be on books available in your region, so every middle shown here is placeable.')
            : '🌍 Showing middles across all scanned books worldwide, including books not accessible from West Africa.'
        ),
        (() => {
          const activeMiddles = middleSection === 'wa' ? middlesWA : middles;
          if (activeMiddles.length === 0) return e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } },
            e('div', { style: { fontSize: 32, marginBottom: 8 } }, '↔'),
            e('div', { style: { fontSize: 14 } },
              middleSection === 'wa'
                ? (isWAUserNow ? 'No West Africa middles found yet. Run a scan — these need a price gap between two WA-accessible books.' : 'No middles found yet between books available in your region. Run a scan.')
                : 'No middles found yet. Run a scan — middles appear most often in NBA and NFL spreads/totals.'
            )
          );
          // Middles with a market-implied EV estimate below the floor are hidden by default. Middles the
          // model can't score (e.g. spreads) are kept, since hiding them would be a guess.
          const isWeak = m => !m.isArb && m.evPct != null && m.evPct < MIN_MIDDLE_EV_PCT;
          const hiddenWeak = activeMiddles.filter(isWeak).length;
          const filteredMiddles = showAllMiddles ? activeMiddles : activeMiddles.filter(m => !isWeak(m));
          const shownMiddles = middleSort === 'likely'
            ? filteredMiddles.slice().sort((a, b) => (b.windowProb ?? -1) - (a.windowProb ?? -1))
            : filteredMiddles;
          const sortBar = e('div', { key: '__sort', style: { display: 'flex', gap: 6, marginBottom: 8 } },
            [['ev', 'Best EV'], ['likely', '🎯 Most likely to land']].map(([k, l]) =>
              e('button', { key: k, onClick: () => setMiddleSort(k), style: { ...st.btn(middleSort === k ? 'primary' : 'outline'), fontSize: 11, padding: '5px 10px' } }, l)));
          const banner = (hiddenWeak > 0 || showAllMiddles) && e('div', { key: '__weak', style: { fontSize: 11, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', marginBottom: 8, lineHeight: 1.5 } },
            showAllMiddles
              ? e('span', null, 'Showing all middles, including ones with negative estimated EV. ', e('a', { href: '#', style: { fontWeight: 700 }, onClick: ev => { ev.preventDefault(); setShowAllMiddles(false); } }, 'Hide weak ones'))
              : e('span', null, '🔒 ' + hiddenWeak + ' middle' + (hiddenWeak === 1 ? '' : 's') + ' hidden: estimated EV below ' + MIN_MIDDLE_EV_PCT + '% (the books\' margins cost more than the window can win back). ', e('a', { href: '#', style: { fontWeight: 700 }, onClick: ev => { ev.preventDefault(); setShowAllMiddles(true); } }, 'Show all')));
          if (shownMiddles.length === 0) return e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } },
            banner,
            e('div', { style: { fontSize: 32, marginBottom: 8 } }, '↔'),
            e('div', { style: { fontSize: 14 } }, 'No middles worth taking in this scan.')
          );
          return [sortBar, banner].concat(shownMiddles.map(m => {
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
                e('span', { style: { background: m.isArb ? C.greenLight : '#fdf4ff', color: m.isArb ? C.greenDark : '#7c3aed', fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 16 } }, m.isArb ? '⚡ Arb+Middle' : (m.windowProb != null ? '🎯 ~' + Math.round(m.windowProb * 100) + '% lands' : '↔ ' + m.window + ' pt window')),
                e('span', { style: { fontSize: 11, color: C.muted } }, m.isArb ? 'Guaranteed profit + middle chance' : (m.evPct != null ? 'Est. EV ' + (m.evPct > 0 ? '+' : '') + m.evPct + '%' : (parseFloat(overround) > 0 ? 'Cost: ' + overround + '% overround' : 'Near break-even')))
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
              (m.windowText ? '💡 If ' + m.windowText + ', both legs win. Otherwise one wins and the other loses (or pushes on a whole-number line).' : '💡 If the final margin falls between ' + Math.abs(m.legA.line) + ' and ' + Math.abs(m.legB.line) + ', both legs win. Otherwise one leg wins, one loses.'),
              m.marketMedian != null && e('div', { style: { marginTop: 4, fontSize: 11, color: C.muted } }, 'The books price this match at about ' + m.marketMedian + ' total goals.'),
              m.staleNote && e('div', { style: { marginTop: 4, fontSize: 11, color: '#92400e' } }, '⚠ ' + m.staleNote)
            )
          );
        }));
        })()
      ),

      // ── STEAM CHASING ──
      edgeTab === 'steam' && e('div', null,
        e('div', { style: { background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400e', lineHeight: 1.6 } },
          '💨 Steam moves are when sharp books (Pinnacle/Betfair) sharply shorten a line — indicating professional money has come in. Soft books that haven\'t updated yet represent the value. Steam is detected by comparing each scan to the previous one.'
        ),
        steam.length === 0 && e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } },
          e('div', { style: { fontSize: 32, marginBottom: 8 } }, '💨'),
          e('div', { style: { fontSize: 14 } }, steam.length === 0 && prevEventsRef.current.length === 0 ? 'Steam needs two scans to compare. Run a second scan after 5 minutes.' : 'No significant line moves detected in the last scan.')
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
                    const priced = findScannedOddsForGame(game, prevEventsRef.current, userRegion);
                    // No fake zeros: an unpriced match sends labels only, and oddsAvailable:false tells the API.
                    const outcomes = priced || (String(game.sport || '').startsWith('soccer') ? [{ label: game.homeTeam }, { label: 'Draw' }, { label: game.awayTeam }] : [{ label: game.homeTeam }, { label: game.awayTeam }]);
                    const res = await fetch('/api/analyze', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await getToken() },
                      body: JSON.stringify({
                        match: game.match,
                        sport: game.league || getSportInfo(game.sport).label,
                        sportKey: game.sport,
                        outcomes,
                        oddsAvailable: !!priced,
                        margin: 0,
                        marketType: 'Match Winner',
                        venue: game.venue || '',
                        includeNews: true,
                      })
                    });
                    const data = await res.json();
                    if (res.status === 402) { data.error = data.message || 'AI analysis is a Premium feature.'; setUpgradeNotice(data.error); }
                    setGameAnalyses(p => ({ ...p, [game.id]: { ...data, _priced: !!priced } }));
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
                    analysis._priced === false && e('div', { style: { background: C.amberLight, borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#78350f' } },
                      'This match is not in your latest scan, so there is no price data: form and context only, no value pricing. Scan this sport first for price-based analysis.'),
                    (() => {
                      const cell = (k, label, val, color) => val ? e('div', { key: k, style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, label), e('div', { style: { fontWeight: 700, color } }, val)) : null;
                      const cells = [
                        cell('p', 'Predicted', analysis.predictedOutcome, C.text),
                        cell('c', analysis.confidenceLabel || 'Confidence', analysis.confidence ? analysis.confidence + '%' : null, C.blue),
                        cell('r', 'Risk', analysis.riskLevel, C.amber),
                        cell('v', 'Best Value', analysis.valueLeg, C.green),
                        cell('d', 'Data quality', analysis.dataQuality && analysis.dataQuality.level, C.muted),
                      ].filter(Boolean);
                      return cells.length ? e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 } }, cells) : null;
                    })(),
                    analysis.dataQuality && analysis.dataQuality.note && e('div', { style: { fontSize: 10, color: C.muted, marginBottom: 8, lineHeight: 1.4 } }, '📎 Data used: ' + (analysis.dataQuality.level || 'None') + ' — ' + analysis.dataQuality.note + (analysis.priced === false ? ' · Prices: none in your latest scan for this match.' : '')),
                    analysis.valueAssessment && e('div', { style: { background: '#fff', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 12, lineHeight: 1.5 } },
                      e('div', { style: { fontWeight: 700, fontSize: 11, color: C.muted, marginBottom: 4 } }, '⚖️ VALUE ASSESSMENT'),
                      e('div', { style: { color: C.text } }, analysis.valueAssessment)
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
      e('div', { style: st.guideP }, 'ArbEdge scans 20 top football competitions, including the Premier League, Champions League, La Liga, Bundesliga, Serie A, Ligue 1, AFCON, the World Cup, Europa League, Copa Libertadores, MLS and Brazil Serie A.'),
      e('div', { style: st.guideH }, '⚠️ Key risks'),
      e('div', { style: st.guideP }, 'Account limits: bookmakers detect arbers. Use round stakes and place occasional recreational bets. Odds movement: place the better-odds leg first — you have 30 seconds to 3 minutes. For Betano and MSport you need to check odds manually and move fast.'),
      e('div', { style: st.guideH }, '📋 Quick checklist'),
      ['Margin at least 1.5% (covers drift)', 'Same event start time on both books', 'Funds pre-loaded — no deposits mid-arb', 'Higher-odds leg placed first', 'Screenshot betslips after placement', 'Log bet in Tracker tab', 'Withdraw profits regularly'].map((item, i) =>
       e('div', { key: i, style: { display: 'flex', gap: 8, marginBottom: 6 } },
          e('span', { style: { color: C.green, flexShrink: 0 } }, '✓'),
          e('span', { style: { fontSize: 13, color: C.muted, lineHeight: 1.4 } }, item)
        )
      ),
      e('div', { style: { background: C.amberLight, borderRadius: 10, padding: '11px 14px', marginTop: 16, fontSize: 12, color: '#78350f', lineHeight: 1.6 } },
        e('div', { style: { fontWeight: 700, marginBottom: 4 } }, '⚖️ Gamble Responsibly. Only 18+ Years. Gambling is Addictive.'),
        'ArbEdge is an odds-comparison tool — it does not accept bets or hold funds. All wagers are placed directly with licensed third-party sportsbooks. ',
        e('a', { href: '/terms', target: '_blank', style: { color: '#78350f', fontWeight: 700, textDecoration: 'underline' } }, 'Terms'),
        ' · ',
        e('a', { href: '/privacy', target: '_blank', style: { color: '#78350f', fontWeight: 700, textDecoration: 'underline' } }, 'Privacy')
      )
    )
  );
}
const e = React.createElement;

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
  if (mode === 'signup' && !ageConfirmed) {
    setError('You must confirm you are 18 or older to create an account.');
    return;
  }
  setError(''); setLoading(true);
  try {
 const { data, error } = mode === 'login'
  ? await supabase.auth.signInWithPassword({ email, password })
  : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (mode === 'signup' && !data.session) {
      setError('Check your email to confirm your account, then log in.');
      return;
    }
    onAuth(data.session);
  } catch (err) {
    setLoading(false);
    setError('Unexpected error: ' + (err?.message || String(err)));
  }
};
  return e('div', { style: { maxWidth: 360, margin: '80px auto', padding: 24, fontFamily: 'system-ui' } },
    e('img', { src: '/favicon.svg', alt: 'ArbEdge', width: 64, height: 64, style: { display: 'block', margin: '0 auto 16px', width: 64, height: 64, borderRadius: 14 } }),
    e('h2', { style: { marginBottom: 16, textAlign: 'center' } }, mode === 'login' ? 'Log in to ArbEdge' : 'Create your ArbEdge account'),
    e('input', { type: 'email', placeholder: 'Email', value: email, onChange: ev => setEmail(ev.target.value), style: { width: '100%', padding: 10, marginBottom: 10, border: '1px solid #ddd', borderRadius: 8 } }),
    e('input', { type: 'password', placeholder: 'Password', value: password, onChange: ev => setPassword(ev.target.value), style: { width: '100%', padding: 10, marginBottom: 10, border: '1px solid #ddd', borderRadius: 8 } }),
    mode === 'signup' && e('label', { style: { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, fontSize: 12, color: '#4b5563', cursor: 'pointer' } },
      e('input', { type: 'checkbox', checked: ageConfirmed, onChange: ev => setAgeConfirmed(ev.target.checked), style: { marginTop: 2 } }),
      e('span', null,
        'I confirm I am 18 years or older, and I agree to the ',
        e('a', { href: '/terms', target: '_blank', style: { color: '#0f172a', fontWeight: 600 } }, 'Terms of Service'),
        ' and ',
        e('a', { href: '/privacy', target: '_blank', style: { color: '#0f172a', fontWeight: 600 } }, 'Privacy Policy'),
        '.'
      )
    ),
    error && e('div', { style: { color: '#dc2626', fontSize: 13, marginBottom: 10 } }, error),
    e('button', { onClick: submit, disabled: loading, style: { width: '100%', padding: 10, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, marginBottom: 10 } }, loading ? 'Please wait…' : (mode === 'login' ? 'Log in' : 'Sign up')),
    e('div', { style: { fontSize: 13, textAlign: 'center', color: '#666' } },
      mode === 'login' ? "Don't have an account? " : 'Already have an account? ',
      e('a', { href: '#', onClick: ev => { ev.preventDefault(); setMode(mode === 'login' ? 'signup' : 'login'); }, style: { color: '#0f172a', fontWeight: 600 } }, mode === 'login' ? 'Sign up' : 'Log in')
    )
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) return e('div', { style: { padding: 40, textAlign: 'center' } }, 'Loading…');
  if (!session) return e(AuthScreen, { onAuth: setSession });

  return e(ArbEdgeApp, { session, onLogout: () => supabase.auth.signOut() });
}
