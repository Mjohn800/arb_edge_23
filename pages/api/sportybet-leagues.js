// pages/api/sportybet-leagues.js
//
// Admin-only: for each SportyBet tournament ID in the scraper's map, asks SportyBet which league it
// really is (SportyBet labels its own events) and shows the first fixtures, so you can confirm each
// ID in one page load instead of checking SportyBet's network tab league by league.
//
// Needs env ADMIN_DEBUG_TOKEN (404s without it). Reads SportyBet only: 0 OddsPapi / Odds API calls.
//
//   All soccer leagues in the map:   /api/sportybet-leagues?token=TOKEN
//   One league:                      /api/sportybet-leagues?token=TOKEN&sport=soccer_belgium_first_div
//   Try ANY tournament ID (to find a correct one):
//                                    /api/sportybet-leagues?token=TOKEN&id=sr:tournament:38
//
// Marks:  OK  = the league name SportyBet returns matches what we expect for that key
//         ??  = it returned matches but the league name is not what we expected (or has no name): look
//         --  = no matches (wrong ID, or the league is between seasons / has no upcoming fixtures)
//
// NOTE: the ID list below is a copy of SPORTYBET_SPORT_MAP in scrapers/sportybet.js. If you change an
// ID there, change it here too (or test it with ?id=).

export const config = { maxDuration: 60 };

const BASE = 'https://www.sportybet.com/api/gh/factsCenter';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Origin': 'https://www.sportybet.com',
  'Referer': 'https://www.sportybet.com/gh/m/sport/football',
};

// key -> [tournamentId, words that must appear in the league/country name SportyBet returns (any one)]
const LEAGUES = {
  soccer_epl:                       ['sr:tournament:17',   ['premier league']],
  soccer_uefa_champs_league:        ['sr:tournament:7',    ['champions league']],
  soccer_uefa_europa_league:        ['sr:tournament:679',  ['europa league']],
  soccer_spain_la_liga:             ['sr:tournament:8',    ['laliga', 'la liga']],
  soccer_germany_bundesliga:        ['sr:tournament:35',   ['bundesliga']],
  soccer_italy_serie_a:             ['sr:tournament:23',   ['serie a']],
  soccer_france_ligue_one:          ['sr:tournament:34',   ['ligue 1']],
  soccer_ghana_premiership:         ['sr:tournament:1436', ['ghana']],
  soccer_africa_cup_of_nations:     ['sr:tournament:5765', ['africa cup', 'afcon']],
  soccer_fifa_world_cup:            ['sr:tournament:16',   ['world cup']],
  soccer_netherlands_eredivisie:    ['sr:tournament:37',   ['eredivisie']],
  soccer_portugal_primeira_liga:    ['sr:tournament:238',  ['primeira', 'liga portugal']],
  soccer_norway_eliteserien:        ['sr:tournament:20',   ['eliteserien']],
  soccer_sweden_allsvenskan:        ['sr:tournament:40',   ['allsvenskan']],
  soccer_spl:                       ['sr:tournament:36',   ['scotland', 'premiership']],
  soccer_belgium_first_div:         ['sr:tournament:38',   ['belgi', 'pro league', 'jupiler']],
  soccer_efl_champ:                 ['sr:tournament:18',   ['championship']],
  soccer_brazil_campeonato:         ['sr:tournament:325',  ['brasil', 'brazil']],
  soccer_usa_mls:                   ['sr:tournament:242',  ['mls', 'major league']],
  soccer_conmebol_copa_libertadores:['sr:tournament:384',  ['libertadores']],
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Same unwrapping the scraper does: SportyBet may return flat events or category/tournament wrappers.
function unwrap(json) {
  const data = json && json.data;
  const flat = data && (data.events || data.tournamentEvents || data.matchList || data.list);
  const wrappers = flat || (Array.isArray(data) ? data : []);
  const names = [];
  let events;
  if (flat && flat.length > 0 && !(flat[0] && flat[0].events)) events = flat;
  else {
    events = wrappers.flatMap(w => { if (w && (w.name || w.categoryName)) names.push([w.categoryName, w.name].filter(Boolean).join(' / ')); return (w && (w.events || w.matches || w.items)) || []; });
  }
  return { events: events || [], wrapperNames: names };
}

// SportyBet events usually carry their own league label: sport.category.tournament.name.
function eventLeagueLabel(ev) {
  const s = ev && ev.sport, c = s && s.category, t = c && c.tournament;
  return [c && c.name, t && t.name].filter(Boolean).join(' / ');
}

function startMs(ev) {
  let ms = ev.estimateStartTime || ev.startTime || ev.beginTime || 0;
  if (ms && ms < 1e12) ms *= 1000;
  return ms;
}

async function checkOne(key, id, words) {
  let res;
  try {
    res = await fetch(`${BASE}/pcEvents`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ sportId: 'sr:sport:1', marketId: '1,18,10,29,11,26,36,14', tournamentId: [[id]] }]),
      signal: AbortSignal.timeout(9000),
    });
  } catch (err) {
    return { key, id, mark: '--', text: `${key} (${id}) | request failed: ${err.name === 'TimeoutError' ? 'timeout' : err.message}` };
  }
  if (!res.ok) return { key, id, mark: '--', text: `${key} (${id}) | HTTP ${res.status}` };

  let json;
  try { json = await res.json(); } catch { return { key, id, mark: '--', text: `${key} (${id}) | response was not JSON` }; }
  const { events, wrapperNames } = unwrap(json);
  const now = Date.now();
  const upcoming = events.filter(ev => { const ms = startMs(ev); return !ms || ms > now - 3 * 3600 * 1000; });
  if (!events.length) return { key, id, mark: '--', text: `${key} (${id}) | no events returned (wrong ID, or no upcoming fixtures)` };

  const labels = new Set(wrapperNames);
  events.slice(0, 40).forEach(ev => { const l = eventLeagueLabel(ev); if (l) labels.add(l); });
  const labelText = [...labels].join(' ; ');
  const haystack = labelText.toLowerCase();
  let mark = '??';
  if (words && words.length && haystack && words.some(w => haystack.includes(w))) mark = 'OK';

  const lines = [`${mark} ${key} (${id}) | SportyBet calls it: ${labelText || '(no league name in response)'} | events ${events.length}, upcoming ${upcoming.length}`];
  for (const ev of upcoming.slice(0, 3)) {
    const ms = startMs(ev);
    const mk = (ev.markets || []).map(m => m.id || m.marketId).filter(Boolean).join(',');
    lines.push(`     ${ev.homeTeamName || '?'} vs ${ev.awayTeamName || '?'} | ${ms ? new Date(ms).toISOString().slice(0, 16) + 'Z' : 'no time'} | markets ${mk || 'none inline'}`);
  }
  if (mark === '??' && !labelText) lines.push('     first event keys: ' + Object.keys(events[0] || {}).slice(0, 14).join(','));
  return { key, id, mark, text: lines.join('\n') };
}

export default async function handler(req, res) {
  const token = process.env.ADMIN_DEBUG_TOKEN;
  if (!token || req.query.token !== token) return res.status(404).json({ error: 'not_found' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const out = [];
    let jobs;
    if (req.query.id) {
      const id = String(req.query.id).trim();
      if (!/^sr:tournament:\d{1,8}$/.test(id)) return res.status(400).json({ error: 'bad_id', hint: 'use e.g. sr:tournament:38' });
      jobs = [['custom', id, []]];
    } else if (req.query.sport) {
      const k = String(req.query.sport);
      if (!LEAGUES[k]) return res.status(400).json({ error: 'unknown_sport', available: Object.keys(LEAGUES) });
      jobs = [[k, LEAGUES[k][0], LEAGUES[k][1]]];
    } else {
      jobs = Object.entries(LEAGUES).map(([k, [id, w]]) => [k, id, w]);
    }

    const results = [];
    for (const [k, id, w] of jobs) {
      results.push(await checkOne(k, id, w));
      if (jobs.length > 1) await sleep(250); // be gentle with SportyBet
    }
    const tally = m => results.filter(r => r.mark === m).length;
    out.push(`SportyBet league check | ${results.length} checked | OK ${tally('OK')} | ?? ${tally('??')} | -- ${tally('--')}`);
    out.push('OK = league name matches | ?? = check the name by eye | -- = no matches returned');
    out.push('');
    results.forEach(r => out.push(r.text));
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(out.join('\n'));
  } catch (err) {
    console.error('[sportybet-leagues] crashed', err);
    return res.status(500).json({ error: 'crashed', message: String(err && err.message ? err.message : err) });
  }
}
