guimport React, { useState, useEffect, useCallback, createElement } from 'react';

// ─── BOOKMAKERS ───────────────────────────────────────────────────────────────
const BOOKS = {
  betway:        { name: 'Betway',       momo: true,  licensed: true,  manual: false, url: 'https://www.betway.com.gh/sports/all-sports', sportUrls: { soccer: 'https://www.betway.com.gh/sports/soccer', basketball: 'https://www.betway.com.gh/sports/basketball', tennis: 'https://www.betway.com.gh/sports/tennis', cricket: 'https://www.betway.com.gh/sports/cricket', mma: 'https://www.betway.com.gh/sports/mma' } },
  '1xbet':       { name: '1xBet',        momo: true,  licensed: true,  manual: false, url: 'https://1xbet.com/en/line', sportUrls: { soccer: 'https://1xbet.com/en/line/football', basketball: 'https://1xbet.com/en/line/basketball', tennis: 'https://1xbet.com/en/line/tennis', cricket: 'https://1xbet.com/en/line/cricket', mma: 'https://1xbet.com/en/line/mma' } },
  bet365:        { name: 'Bet365',       momo: false, licensed: false, manual: false, url: 'https://www.bet365.com/#/AS/B1/', sportUrls: { soccer: 'https://www.bet365.com/#/AS/B1/', basketball: 'https://www.bet365.com/#/AS/B18/', tennis: 'https://www.bet365.com/#/AS/B13/', cricket: 'https://www.bet365.com/#/AS/B19/', mma: 'https://www.bet365.com/#/AS/B14/' } },
  pinnacle:      { name: 'Pinnacle',     momo: false, licensed: false, manual: false, url: 'https://www.pinnacle.com/en/soccer/matchups', sportUrls: { soccer: 'https://www.pinnacle.com/en/soccer/matchups', basketball: 'https://www.pinnacle.com/en/basketball/matchups', tennis: 'https://www.pinnacle.com/en/tennis/matchups', cricket: 'https://www.pinnacle.com/en/cricket/matchups', mma: 'https://www.pinnacle.com/en/mixed-martial-arts/matchups' } },
  betfair_ex_eu: { name: 'Betfair',      momo: false, licensed: false, manual: false, url: 'https://www.betfair.com/exchange/plus/football', sportUrls: { soccer: 'https://www.betfair.com/exchange/plus/football', basketball: 'https://www.betfair.com/exchange/plus/basketball', tennis: 'https://www.betfair.com/exchange/plus/tennis', cricket: 'https://www.betfair.com/exchange/plus/cricket', mma: 'https://www.betfair.com/exchange/plus/mixed-martial-arts' } },
  marathonbet:   { name: 'MarathonBet',  momo: false, licensed: false, manual: false, url: 'https://www.marathonbet.com/en/betting/Football', sportUrls: { soccer: 'https://www.marathonbet.com/en/betting/Football', basketball: 'https://www.marathonbet.com/en/betting/Basketball', tennis: 'https://www.marathonbet.com/en/betting/Tennis', cricket: 'https://www.marathonbet.com/en/betting/Cricket', mma: 'https://www.marathonbet.com/en/betting/MMA' } },
  unibet_eu:     { name: 'Unibet',       momo: false, licensed: false, manual: false, url: 'https://www.unibet.com/betting/sports/filter/football/all/matches', sportUrls: { soccer: 'https://www.unibet.com/betting/sports/filter/football/all/matches', basketball: 'https://www.unibet.com/betting/sports/filter/basketball/all/matches', tennis: 'https://www.unibet.com/betting/sports/filter/tennis/all/matches', cricket: 'https://www.unibet.com/betting/sports/filter/cricket/all/matches', mma: 'https://www.unibet.com/betting/sports/filter/mma/all/matches' } },
  williamhill:   { name: 'William Hill', momo: false, licensed: false, manual: false, url: 'https://www.williamhill.com/sports/football', sportUrls: { soccer: 'https://www.williamhill.com/sports/football', basketball: 'https://www.williamhill.com/sports/basketball', tennis: 'https://www.williamhill.com/sports/tennis', cricket: 'https://www.williamhill.com/sports/cricket', mma: 'https://www.williamhill.com/sports/mma' } },
  melbet:        { name: 'MelBet',       momo: true,  licensed: false, manual: false, url: 'https://melbet.com/en/sport/football', sportUrls: { soccer: 'https://melbet.com/en/sport/football', basketball: 'https://melbet.com/en/sport/basketball', tennis: 'https://melbet.com/en/sport/tennis', cricket: 'https://melbet.com/en/sport/cricket', mma: 'https://melbet.com/en/sport/mma' } },
  sportybet:     { name: 'SportyBet',    momo: true,  licensed: true,  manual: true,  url: 'https://www.sportybet.com/gh/sport/football', sportUrls: { soccer: 'https://www.sportybet.com/gh/sport/football', basketball: 'https://www.sportybet.com/gh/sport/basketball', tennis: 'https://www.sportybet.com/gh/sport/tennis', cricket: 'https://www.sportybet.com/gh/sport/cricket', mma: 'https://www.sportybet.com/gh/sport/mma' } },
  betano:        { name: 'Betano',       momo: true,  licensed: false, manual: true,  url: 'https://www.betano.com.gh/sport/football', sportUrls: { soccer: 'https://www.betano.com.gh/sport/football', basketball: 'https://www.betano.com.gh/sport/basketball', tennis: 'https://www.betano.com.gh/sport/tennis', cricket: 'https://www.betano.com.gh/sport/cricket', mma: 'https://www.betano.com.gh/sport/mma' } },
  msport:        { name: 'MSport',       momo: true,  licensed: false, manual: true,  url: 'https://www.msport.com/gh/football', sportUrls: { soccer: 'https://www.msport.com/gh/football', basketball: 'https://www.msport.com/gh/basketball', tennis: 'https://www.msport.com/gh/tennis', cricket: 'https://www.msport.com/gh/cricket', mma: 'https://www.msport.com/gh/mma' } },
  footballcom:   { name: 'Football.com', momo: false, licensed: false, manual: true,  url: 'https://www.football.com/betting', sportUrls: { soccer: 'https://www.football.com/betting/football' } },
};

const API_BOOKS = Object.entries(BOOKS).filter(([,b]) => !b.manual).map(([k]) => k);
const MANUAL_BOOKS = Object.entries(BOOKS).filter(([,b]) => b.manual);

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

const MOCK = [
  { id: 'm1', sport: 'soccer_epl', match: 'Arsenal vs Chelsea', commenceTime: new Date(Date.now() + 3 * 3600000).toISOString(), margin: 3.7, outcomes: [{ label: 'Arsenal', book: 'betway', bookName: 'Betway', odds: 2.50 }, { label: 'Draw', book: '1xbet', bookName: '1xBet', odds: 4.10 }, { label: 'Chelsea', book: 'bet365', bookName: 'Bet365', odds: 3.40 }] },
  { id: 'm2', sport: 'soccer_uefa_champs_league', match: 'Real Madrid vs Man City', commenceTime: new Date(Date.now() + 26 * 3600000).toISOString(), margin: 2.1, outcomes: [{ label: 'Real Madrid', book: 'pinnacle', bookName: 'Pinnacle', odds: 2.20 }, { label: 'Draw', book: 'marathonbet', bookName: 'MarathonBet', odds: 3.80 }, { label: 'Man City', book: '1xbet', bookName: '1xBet', odds: 3.40 }] },
  { id: 'm3', sport: 'basketball_nba', match: 'Lakers vs Celtics', commenceTime: new Date(Date.now() + 5 * 3600000).toISOString(), margin: 1.8, outcomes: [{ label: 'Lakers', book: 'betway', bookName: 'Betway', odds: 2.10 }, { label: 'Celtics', book: '1xbet', bookName: '1xBet', odds: 1.98 }] },
  { id: 'm4', sport: 'mma_mixed_martial_arts', match: 'Pereira vs Ankalaev', commenceTime: new Date(Date.now() + 48 * 3600000).toISOString(), margin: 2.4, outcomes: [{ label: 'Pereira', book: 'bet365', bookName: 'Bet365', odds: 1.72 }, { label: 'Ankalaev', book: 'pinnacle', bookName: 'Pinnacle', odds: 2.30 }] },
  { id: 'm5', sport: 'cricket_ipl', match: 'Mumbai Indians vs CSK', commenceTime: new Date(Date.now() + 12 * 3600000).toISOString(), margin: 1.5, outcomes: [{ label: 'Mumbai Indians', book: '1xbet', bookName: '1xBet', odds: 2.05 }, { label: 'CSK', book: 'betway', bookName: 'Betway', odds: 1.90 }] },
];

function findArbs(events) {
  const arbs = [];
  for (const ev of events) {
    if (!ev.bookmakers || ev.bookmakers.length < 2) continue;
    const best = {};
    for (const bm of ev.bookmakers) {
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

function findEVBets(events, minEV = 2) {
  const evBets = [];
  for (const ev of events) {
    if (!ev.bookmakers || ev.bookmakers.length < 2) continue;
    const pinnBm = ev.bookmakers.find(b => b.key === 'pinnacle');
    if (!pinnBm) continue;
    const pinnMkt = (pinnBm.markets || []).find(m => m.key === 'h2h');
    if (!pinnMkt) continue;
    const pinnOuts = pinnMkt.outcomes;
    const rawImplied = pinnOuts.reduce((s, o) => s + 1 / o.price, 0);
    const trueProbs = {};
    pinnOuts.forEach(o => { trueProbs[o.name] = (1 / o.price) / rawImplied; });
    for (const bm of ev.bookmakers) {
      if (bm.key === 'pinnacle') continue;
      const mkt = (bm.markets || []).find(m => m.key === 'h2h');
      if (!mkt) continue;
      for (const o of mkt.outcomes) {
        const prob = trueProbs[o.name];
        if (!prob) continue;
        const ev_pct = parseFloat(((o.price * prob - 1) * 100).toFixed(2));
        if (ev_pct >= minEV) {
          evBets.push({
            id: ev.id + '_' + bm.key + '_' + o.name,
            sport: ev.sport_key,
            match: ev.home_team + ' vs ' + ev.away_team,
            commenceTime: ev.commence_time,
            outcome: o.name,
            book: bm.key,
            bookName: bm.title,
            odds: o.price,
            trueProb: parseFloat((prob * 100).toFixed(1)),
            pinnacleOdds: parseFloat((1 / prob).toFixed(2)),
            ev_pct,
          });
        }
      }
    }
  }
  return evBets.sort((a, b) => b.ev_pct - a.ev_pct);
}

function kellyCriterion(odds, trueProb, fraction = 0.25) {
  const p = trueProb / 100;
  const b = odds - 1;
  const kelly = (b * p - (1 - p)) / b;
  return Math.max(0, parseFloat((kelly * fraction * 100).toFixed(2)));
}

const MOCK_EV = [
  { id: 'ev1', sport: 'soccer_epl', match: 'Arsenal vs Chelsea', commenceTime: new Date(Date.now() + 3 * 3600000).toISOString(), outcome: 'Arsenal', book: 'betway', bookName: 'Betway', odds: 2.55, trueProb: 41.2, pinnacleOdds: 2.43, ev_pct: 5.1 },
  { id: 'ev2', sport: 'basketball_nba', match: 'Lakers vs Celtics', commenceTime: new Date(Date.now() + 5 * 3600000).toISOString(), outcome: 'Celtics', book: '1xbet', bookName: '1xBet', odds: 1.95, trueProb: 52.8, pinnacleOdds: 1.89, ev_pct: 3.0 },
  { id: 'ev3', sport: 'soccer_uefa_champs_league', match: 'Real Madrid vs Man City', commenceTime: new Date(Date.now() + 26 * 3600000).toISOString(), outcome: 'Draw', book: 'bet365', bookName: 'Bet365', odds: 3.90, trueProb: 26.1, pinnacleOdds: 3.83, ev_pct: 1.8 },
  { id: 'ev4', sport: 'mma_mixed_martial_arts', match: 'Pereira vs Ankalaev', commenceTime: new Date(Date.now() + 48 * 3600000).toISOString(), outcome: 'Ankalaev', book: 'marathonbet', bookName: 'MarathonBet', odds: 2.45, trueProb: 42.0, pinnacleOdds: 2.38, ev_pct: 2.9 },
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
  card: (sel) => ({ background: C.white, borderRadius: 12, padding: '13px 14px', marginBottom: 10, cursor: 'pointer', border: sel ? '2px solid #00d4aa' : '1px solid ' + C.border }),
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
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, sport: '' });
  const [lastFetch, setLastFetch] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(null);
  const [stake, setStake] = useState(500);
  const [currency, setCurrency] = useState('GHS');
  const [groupFilter, setGroupFilter] = useState('all');
  const TOP_SPORTS = ['soccer_epl','soccer_uefa_champs_league','soccer_spain_la_liga','soccer_germany_bundesliga','soccer_italy_serie_a','soccer_france_ligue_one','soccer_africa_cup_of_nations','soccer_ghana_premiership','soccer_fifa_world_cup','basketball_nba','tennis_atp_wimbledon','tennis_wta_wimbledon','mma_mixed_martial_arts','boxing_boxing','cricket_ipl','cricket_t20_world_cup','americanfootball_nfl','soccer_uefa_europa_league','soccer_conmebol_copa_libertadores','soccer_usa_mls'];
const [selectedSports, setSelectedSports] = useState(TOP_SPORTS);
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [minMargin, setMinMargin] = useState(0);
  const [wayFilter, setWayFilter] = useState('all');
  const [bets, setBets] = useState(() => { try { return JSON.parse(localStorage.getItem('arb_bets') || '[]'); } catch { return []; } });
  const [manualOutcomes, setManualOutcomes] = useState([
    { label: 'Home', book: 'betway', odds: '' },
    { label: 'Draw', book: 'sportybet', odds: '' },
    { label: 'Away', book: 'betano', odds: '' },
  ]);
  const [manualMeta, setManualMeta] = useState(EMPTY_MANUAL);
  const [manualStake, setManualStake] = useState(500);
  const [manualResult, setManualResult] = useState(null);
  const [evBets, setEvBets] = useState(MOCK_EV);
  const [minEV, setMinEV] = useState(2);
  const [evStake, setEvStake] = useState(500);
  const [evFilter, setEvFilter] = useState('all');
  const [quota, setQuota] = useState({ remaining: null, used: null, keyIndex: 1 });
  const [cardAnalysis, setCardAnalysis] = useState({});
const [analyzingId, setAnalyzingId] = useState(null);

  const fetchOdds = useCallback(async (key) => {
  if (!key) return;
    setLoading(true); setError('');
    const sportsToScan = ALL_SPORTS.filter(s => selectedSports.includes(s.key));
    const all = [];
    for (let i = 0; i < sportsToScan.length; i++) {
      const sp = sportsToScan[i];
      setScanProgress({ current: i + 1, total: sportsToScan.length, sport: sp.label });
      try {
        const res = await fetch('/api/odds?sport=' + sp.key + '&region=' + sp.region + '&market=h2h,spreads,totals,outrights');
        if (res.status === 401) { setError('Invalid API key.'); break; }
        if (res.status === 429) { setError('API quota reached. Try again later.'); break; }
        if (!res.ok) continue;
        const json = await res.json();
const data = json.data || json;
if (json.remainingRequests) setQuota({ remaining: json.remainingRequests, used: json.usedRequests, keyIndex: json.keyIndex || 1 });
data.forEach(e => { e.sport_key = sp.key; });
all.push(...data);
      } catch { /* sport offline */ }
    }
    const found = findArbs(all);
    const foundEV = findEVBets(all, minEV);
    if (found.length > 0) { setArbs(found); setLastFetch(new Date()); }
    else { setArbs(MOCK); setError('No live arbs right now. Showing demo data.'); }
    if (foundEV.length > 0) setEvBets(foundEV);
    else setEvBets(MOCK_EV);
    setLoading(false);
  }, [selectedSports, minEV]);

  const saveKey = () => {
    try { localStorage.setItem('oa_key', apiInput); } catch {}
    setApiKey(apiInput); setShowSetup(false); fetchOdds(apiInput);
  };

  useEffect(() => {
   fetchOdds(apiKey || 'server');
    const id = setInterval(() => { if (apiKey) fetchOdds(apiKey); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [apiKey, fetchOdds]);

  useEffect(() => { try { localStorage.setItem('arb_bets', JSON.stringify(bets)); } catch {} }, [bets]);

  const logBet = (outcomes, matchName, sport, profitAmt) => {
    const c = calcStakes(outcomes, stake);
    setBets(p => [{ id: Date.now(), match: matchName || sel.match, sport: sport || sel.sport, margin: sel ? sel.margin : 0, stake, currency, profit: profitAmt !== undefined ? profitAmt : parseFloat(c.profit.toFixed(2)), date: new Date().toISOString(), status: 'pending', outcomes: outcomes.map((o, i) => ({ ...o, stake: parseFloat(c.stakes[i].toFixed(2)), ret: parseFloat(c.returns[i].toFixed(2)) })) }, ...p]);
    setTab('tracker');
  };

const analyzeArb = async (arb) => {   ← paste starts here
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

  const filteredArbs = arbs.filter(a => {
    if (groupFilter !== 'all') { const g = SPORT_GROUPS.find(g => g.group === groupFilter); if (g && !g.sports.some(s => s.key === a.sport)) return false; }
    if (wayFilter === '2' && a.outcomes.length !== 2) return false;
if (wayFilter === '3' && a.outcomes.length !== 3) return false;
return a.margin >= minMargin;
  });

  const calc = sel ? calcStakes(sel.outcomes, stake) : null;
  const totalProfit = bets.filter(b => b.status === 'won').reduce((s, b) => s + b.profit, 0);
  const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
  const roi = totalStaked > 0 ? ((totalProfit / totalStaked) * 100).toFixed(1) : '0.0';

  // ── KEY FIX: use named import instead of React.createElement
  const e = createElement;

  return e('div', { style: st.app },
    e('div', { style: st.header },
      e('div', { style: st.logoRow },
        e('div', { style: st.logoBox }, '📈'),
        e('div', null, e('div', { style: st.logoTitle }, 'ArbEdge'), e('div', { style: st.logoSub }, 'Global Scanner · West Africa'))
      ),
      e('div', { style: st.headerRow },
        e('span', { style: st.badge('#052e16', '#6ee7b7') }, loading ? '⟳ ' + scanProgress.sport + '...' : '● ' + filteredArbs.length + ' arbs'),
        lastFetch && e('span', { style: st.badge('#1f2937', '#9ca3af') }, lastFetch.toLocaleTimeString()),
        !apiKey && e('span', { style: st.badge('#451a03', '#fcd34d') }, '⚠ Demo'),
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
      [['scanner','🔍 Scanner'], ['calculator','🧮 Calculator'], ['manual','✏️ Manual Arb'], ['ev','📈 +EV Bets'], ['tracker','📒 Bets (' + bets.length + ')'], ['guide','📚 Guide']].map(([k, l]) =>
        e('button', { key: k, style: st.tab(tab === k), onClick: () => setTab(k) }, l)
      )
    ),
    tab === 'scanner' && e('div', { style: st.section },
      e('div', { style: st.metricsGrid },
        [['Arbs', filteredArbs.length, null], ['Best', filteredArbs[0] ? filteredArbs[0].margin.toFixed(1) + '%' : '—', C.green], ['Sports', selectedSports.length, null], ['Mode', apiKey ? 'Live' : 'Demo', apiKey ? C.green : C.amber]].map(([l, v, c]) =>
          e('div', { key: l, style: st.metric }, e('div', { style: st.metricLabel }, l), e('div', { style: st.metricVal(c) }, v))
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
        e('button', { onClick: () => setShowSportPicker(v => !v), style: { ...st.btn('outline'), fontSize: 12, padding: '6px 10px' } }, '⚙ Sports (' + selectedSports.length + ')'),
        e('button', { onClick: () => fetchOdds(apiKey), disabled: loading || !apiKey, style: { ...st.btn('outline'), fontSize: 12, padding: '6px 10px' } }, loading ? '...' : '↻')
      ),
      showSportPicker && e('div', { style: { background: C.white, border: '1px solid ' + C.border, borderRadius: 12, padding: 14, marginBottom: 14, maxHeight: 300, overflowY: 'auto' } },
        e('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 10 } },
          e('span', { style: { fontSize: 13, fontWeight: 600 } }, 'Select sports to scan'),
          e('div', { style: { display: 'flex', gap: 6 } },
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
      !apiKey && e('div', { style: { background: C.blueLight, color: '#1e3a8a', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 12, lineHeight: 1.5 } }, '📌 Demo mode — tap Connect Live to scan real odds across ' + ALL_SPORTS.length + ' sports. For Betano, MSport & SportyBet odds, use the ✏️ Manual Arb tab.'),
      filteredArbs.map(arb => {
        const info = getSportInfo(arb.sport);
        return e('div', { key: arb.id, style: st.card(sel && sel.id === arb.id), onClick: () => setSel(sel && sel.id === arb.id ? null : arb) },
          e('div', { style: st.cardRow },
            e('div', null, e('div', { style: st.sportLabel }, info.emoji + ' ' + info.label + ' · ⏱ ' + timeUntil(arb.commenceTime)), e('div', { style: st.matchTitle }, arb.match)),
            e('span', { style: st.profitBadge(arb.margin) }, '+' + arb.margin.toFixed(1) + '%')
          ),
          e('div', { style: st.oddsGrid(arb.outcomes.length) },
            arb.outcomes.map((o, i) => e('div', { key: i, style: st.oddsCell },
              e('div', { style: { fontSize: 11, color: C.muted, marginBottom: 2 } }, o.label),
              e('div', { style: { fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 1 } }, o.bookName),
              e('div', { style: { fontSize: 14, fontWeight: 700, color: C.green } }, o.odds.toFixed(2)),
e('a', { href: (BOOKS[o.book] && BOOKS[o.book].sportUrls && BOOKS[o.book].sportUrls[arb.sport.split('_')[0]]) || (BOOKS[o.book] && BOOKS[o.book].url) || '#', target: '_blank', style: { display: 'block', marginTop: 4, fontSize: 10, fontWeight: 700, color: '#fff', background: C.green, borderRadius: 6, padding: '3px 6px', textDecoration: 'none', textAlign: 'center' } }, 'Bet Now →')
            ))
          ),
          sel && sel.id === arb.id && e('div', { style: { marginTop: 10, display: 'flex', gap: 8 } },
            e('button', { style: st.btn('primary'), onClick: ev => { ev.stopPropagation(); setTab('calculator'); } }, 'Calculate →'),
            e('button', { style: { ...st.btn('outline'), fontSize: 12 }, onClick: ev => { ev.stopPropagation(); analyzeArb(arb); } }, analyzingId === arb.id ? 'Analyzing...' : 'AI Analysis'),
          ),
            cardAnalysis[arb.id] && e('div', { style: { marginTop: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px', fontSize: 12, lineHeight: 1.6 } }, cardAnalysis[arb.id].error ? e('div', { style: { color: '#dc2626' } }, '⚠️ ' + cardAnalysis[arb.id].error) : e('div', null, e('div', { style: { fontWeight: 700, fontSize: 13, color: C.greenDark, marginBottom: 8 } }, '🤖 AI Analysis'), e('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 } }, e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Predicted'), e('div', { style: { fontWeight: 700, color: C.text } }, cardAnalysis[arb.id].predictedOutcome)), e('div', { style: st.oddsCell }, e('div', { style: { fontSize: 10, color: C.muted } }, 'Confidence'), e
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
        '📈 Positive Expected Value (+EV) bets are NOT guaranteed profit like arbs. They are bets where the bookmaker\'s odds are HIGHER than the true probability suggests — meaning if you place hundreds of these bets, you profit long-term. Uses Pinnacle as the sharp reference book to calculate true probabilities.'
      ),
      e('div', { style: st.metricsGrid },
        [
          ['+EV found', evBets.filter(b => evFilter === 'all' || b.sport === evFilter).length, null],
          ['Best EV', evBets[0] ? '+' + evBets[0].ev_pct.toFixed(1) + '%' : '—', C.blue],
          ['Avg EV', evBets.length > 0 ? '+' + (evBets.reduce((s,b) => s + b.ev_pct, 0) / evBets.length).toFixed(1) + '%' : '—', C.blue],
          ['Mode', apiKey ? 'Live' : 'Demo', apiKey ? C.green : C.amber],
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
        )
      ),
      evBets.filter(b => evFilter === 'all' || b.sport === evFilter).length === 0 &&
        e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } }, 'No +EV bets found at this threshold. Lower the min EV or connect a live API key.'),
      evBets.filter(b => evFilter === 'all' || b.sport === evFilter).map(bet => {
        const kelly = kellyCriterion(bet.odds, bet.trueProb);
        const kellyStake = parseFloat((kelly / 100 * evStake).toFixed(2));
        const expectedProfit = parseFloat(((bet.odds * bet.trueProb / 100 - 1) * kellyStake).toFixed(2));
        const info = getSportInfo(bet.sport);
        return e('div', { key: bet.id, style: { ...st.card(false), cursor: 'default' } },
          e('div', { style: st.cardRow },
            e('div', null,
              e('div', { style: st.sportLabel }, info.emoji + ' ' + info.label + ' · ⏱ ' + timeUntil(bet.commenceTime)),
              e('div', { style: st.matchTitle }, bet.match),
              e('div', { style: { fontSize: 13, color: C.text, marginTop: 3 } },
                e('span', { style: { fontWeight: 700 } }, bet.outcome),
                e('span', { style: { color: C.muted } }, ' · ' + bet.bookName)
              )
            ),
            e('span', { style: { background: '#eff6ff', color: '#1e40af', fontSize: 13, fontWeight: 700, padding: '4px 11px', borderRadius: 20, flexShrink: 0 } }, '+' + bet.ev_pct.toFixed(1) + '% EV')
          ),
          e('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 4 } },
            [
              ['Your odds', bet.odds.toFixed(2), C.green],
              ['Fair odds', bet.pinnacleOdds.toFixed(2), C.muted],
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
          )
        );
      })
    ),
    tab === 'tracker' && e('div', { style: st.section },
      e('div', { style: st.metricsGrid },
        [['Bets', bets.length, null], ['Staked', (bets[0] ? bets[0].currency : 'GHS') + ' ' + totalStaked.toFixed(0), null], ['Profit', (bets[0] ? bets[0].currency : 'GHS') + ' ' + totalProfit.toFixed(2), totalProfit >= 0 ? C.green : '#dc2626'], ['ROI', roi + '%', parseFloat(roi) >= 0 ? C.green : '#dc2626']].map(([l, v, c]) =>
          e('div', { key: l, style: st.metric }, e('div', { style: st.metricLabel }, l), e('div', { style: st.metricVal(c) }, v))
        )
      ),
      bets.length === 0
        ? e('div', { style: { textAlign: 'center', padding: '40px 0', color: C.muted } }, e('div', { style: { fontSize: 36, marginBottom: 8 } }, '📒'), e('div', { style: { fontSize: 14 } }, 'No bets yet.'))
        : bets.map(bet => e('div', { key: bet.id, style: { ...st.card(false), cursor: 'default' } },
          e('div', { style: st.cardRow },
            e('div', null,
              e('div', { style: st.sportLabel }, getSportInfo(bet.sport).emoji + ' ' + getSportInfo(bet.sport).label + ' · ' + new Date(bet.date).toLocaleDateString()),
              e('div', { style: st.matchTitle }, bet.match)
            ),
            e('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } },
              e('span', { style: { fontSize: 13, fontWeight: 700, color: C.green } }, '+' + bet.currency + ' ' + bet.profit.toFixed(2)),
              e('select', { value: bet.status, onChange: ev => setBets(p => p.map(b => b.id === bet.id ? { ...b, status: ev.target.value } : b)), style: { fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid ' + C.border, background: C.white } },
                e('option', { value: 'pending' }, 'Pending'), e('option', { value: 'won' }, 'Won ✓'), e('option', { value: 'lost' }, 'Lost ✗')
              ),
              e('button', { onClick: () => setBets(p => p.filter(b => b.id !== bet.id)), style: { ...st.btn('danger'), padding: '3px 8px', fontSize: 11 } }, '✕')
            )
          ),
          e('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            bet.outcomes.map((o, i) => e('div', { key: i, style: { background: C.grayLight, borderRadius: 8, padding: '5px 9px', fontSize: 12 } },
              e('span', { style: { color: C.muted } }, o.label + ' · ' + (BOOKS[o.book]?.name || o.bookName || o.book)),
              e('span', { style: { fontWeight: 700, marginLeft: 6 } }, bet.currency + ' ' + o.stake.toFixed(2))
            ))
          )
        ))
    ),
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
        '✏️ Betano, MSport and SportyBet are not yet in the Odds API feed. To arb with them: open their app, find the best odds on a match, then enter those odds in the Manual Arb tab to check if an arb exists against any auto-scanned book.'
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
