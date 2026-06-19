/**
 * scrapers/msport.js
 * Fetches live odds from MSport Ghana's internal API.
 * Normalised to The Odds API bookmaker format.
 *
 * MSport uses a REST JSON API at their backend —
 * the same endpoint their web frontend calls.
 */

const MSPORT_SPORT_MAP = {
  soccer_epl:                   { sportId: 1, leagueId: '39'   },
  soccer_uefa_champs_league:    { sportId: 1, leagueId: '2'    },
  soccer_uefa_europa_league:    { sportId: 1, leagueId: '3'    },
  soccer_spain_la_liga:         { sportId: 1, leagueId: '140'  },
  soccer_germany_bundesliga:    { sportId: 1, leagueId: '78'   },
  soccer_italy_serie_a:         { sportId: 1, leagueId: '135'  },
  soccer_france_ligue_one:      { sportId: 1, leagueId: '61'   },
  soccer_ghana_premiership:     { sportId: 1, leagueId: '288'  },
  soccer_africa_cup_of_nations: { sportId: 1, leagueId: '6'    },
  soccer_fifa_world_cup:        { sportId: 1, leagueId: '1'    },
  basketball_nba:               { sportId: 2, leagueId: '12'   },
  tennis_atp_wimbledon:         { sportId: 5, leagueId: '3'    },
  mma_mixed_martial_arts:       { sportId: 30, leagueId: null  },
};

const BASE_URL = 'https://www.msport.com/gh/api/product/match/list';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Referer': 'https://www.msport.com/gh/',
};

async function fetchMsportOdds(sportKey) {
  const mapping = MSPORT_SPORT_MAP[sportKey];
  if (!mapping) return [];

  try {
    const body = {
      sportId: mapping.sportId,
      ...(mapping.leagueId ? { leagueId: mapping.leagueId } : {}),
      matchStatus: 1, // prematch only
      pageNum: 1,
      pageSize: 50,
      marketType: [1, 18], // 1=1x2, 18=over/under
    };

    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn('[MSport] HTTP', res.status, 'for', sportKey);
      return [];
    }

    const json = await res.json();
    const events = json?.data?.list || json?.data?.matchList || [];

    return events.map(ev => normaliseEvent(ev, sportKey)).filter(Boolean);
  } catch (err) {
    console.warn('[MSport] fetch error for', sportKey, err.message);
    return [];
  }
}

function normaliseEvent(ev, sportKey) {
  try {
    const homeTeam = ev.homeTeam || ev.homeName || 'Home';
    const awayTeam = ev.awayTeam || ev.awayName || 'Away';
    const commenceTime = ev.matchTime
      ? new Date(ev.matchTime * 1000).toISOString()
      : ev.startTime
      ? new Date(ev.startTime).toISOString()
      : new Date().toISOString();

    const markets = [];
    const h2hOutcomes = [];
    const totalsOutcomes = [];

    for (const market of (ev.markets || ev.oddsList || [])) {
      const mId = market.marketType || market.marketId;

      for (const sel of (market.odds || market.outcomes || [])) {
        const odds = parseFloat(sel.odds || sel.price);
        if (!odds || odds <= 1) continue;

        if (mId === 1 || mId === '1') {
          // 1x2
          const nameMap = { '1': homeTeam, 'X': 'Draw', '2': awayTeam,
                            'Home': homeTeam, 'Draw': 'Draw', 'Away': awayTeam };
          const outName = nameMap[sel.name] || nameMap[sel.oddName] || sel.name;
          if (outName) h2hOutcomes.push({ name: outName, price: odds });
        } else if (mId === 18 || mId === '18') {
          // Over/Under
          const raw = sel.name || sel.oddName || '';
          const isOver = raw.toLowerCase().includes('over');
          totalsOutcomes.push({
            name: isOver ? 'Over' : 'Under',
            price: odds,
            point: parseFloat(sel.handicap || sel.line || 2.5),
          });
        }
      }
    }

    if (h2hOutcomes.length >= 2) markets.push({ key: 'h2h', outcomes: h2hOutcomes });
    if (totalsOutcomes.length >= 2) markets.push({ key: 'totals', outcomes: totalsOutcomes });
    if (markets.length === 0) return null;

    return {
      id: 'msport_' + (ev.matchId || ev.id),
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: commenceTime,
      bookmakers: [{
        key: 'msport',
        title: 'MSport',
        markets,
        _wa: true,
      }],
    };
  } catch {
    return null;
  }
}

module.exports = { fetchMsportOdds };
