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
// The league list is read straight from SPORTYBET_SPORT_MAP in scrapers/sportybet.js, so a changed ID there is
// checked here automatically (needs the scraper to export SPORTYBET_SPORT_MAP, SPORTYBET_BASE and
// SPORTYBET_HEADERS, which your current version does). Request body = the scraper's own (markets 1,16,18,29).

import { SPORTYBET_SPORT_MAP, SPORTYBET_BASE as BASE, SPORTYBET_HEADERS as HEADERS } from './scrapers/sportybet';

export const config = { maxDuration: 60 };

// What the league name SportyBet returns must contain (any one of these words, lower-case) for each key.
// A key that is in the scraper's map but not listed here is still checked, but can only get "??" (look by eye).
const EXPECT = {
  soccer_epl: ['premier league'], soccer_uefa_champs_league: ['champions league'], soccer_uefa_europa_league: ['europa league'],
  soccer_spain_la_liga: ['laliga', 'la liga'], soccer_germany_bundesliga: ['bundesliga'], soccer_italy_serie_a: ['serie a'],
  soccer_france_ligue_one: ['ligue 1'], soccer_ghana_premiership: ['ghana'], soccer_africa_cup_of_nations: ['africa cup', 'afcon'],
  soccer_fifa_world_cup: ['world cup'], soccer_netherlands_eredivisie: ['eredivisie'], soccer_portugal_primeira_liga: ['primeira', 'liga portugal'],
  soccer_norway_eliteserien: ['eliteserien'], soccer_sweden_allsvenskan: ['allsvenskan'], soccer_spl: ['scotland', 'premiership'],
  soccer_belgium_first_div: ['belgi', 'pro league', 'jupiler'], soccer_efl_champ: ['championship'],
  soccer_brazil_campeonato: ['brasil', 'brazil'], soccer_usa_mls: ['mls', 'major league'], soccer_conmebol_copa_libertadores: ['libertadores'],
};
// The scraper's tournament-type soccer leagues, live from its own map.
const soccerLeagues = () => Object.entries(SPORTYBET_SPORT_MAP || {})
  .filter(([k, m]) => k.startsWith('soccer_') && m && m.type === 'tournament' && m.tournamentId)
  .map(([k, m]) => [k, m.tournamentId, EXPECT[k] || []]);

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
      body: JSON.stringify([{ sportId: 'sr:sport:1', marketId: '1,16,18,29', tournamentId: [[id]] }]),
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
    const ids = new Set((ev.markets || []).map(m => String(m.id || m.marketId)).filter(Boolean));
    lines.push(`     ${ev.homeTeamName || '?'} vs ${ev.awayTeamName || '?'} | ${ms ? new Date(ms).toISOString().slice(0, 16) + 'Z' : 'no time'} | 1X2 ${ids.has('1') ? 'y' : 'n'} | totals ${ids.has('18') ? 'y' : 'n'} | AH ${ids.has('16') ? 'y' : 'n'}${ids.size ? '' : ' (no markets inline)'}`);
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
      const hit = soccerLeagues().find(j => j[0] === k);
      if (!hit) return res.status(400).json({ error: 'unknown_sport', available: soccerLeagues().map(j => j[0]) });
      jobs = [hit];
    } else {
      jobs = soccerLeagues();
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
