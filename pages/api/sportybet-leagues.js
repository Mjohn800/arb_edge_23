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
//   One match as the scraper READS it (prices to compare with SportyBet's page):
//                                    /api/sportybet-leagues?token=TOKEN&sport=soccer_epl&team=arsenal
//   Test EVERY fixture in every league for impossible numbers (needs no eyeballing):
//                                    /api/sportybet-leagues?token=TOKEN&sweep=1      (add &sport=KEY for one league)
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

import { SPORTYBET_SPORT_MAP, SPORTYBET_BASE as BASE, SPORTYBET_HEADERS as HEADERS, fetchSportybetOdds } from './scrapers/sportybet';

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


const r2 = n => Math.round(n * 1000) / 1000;
const near = (a, b) => Math.abs(a - b) < 1e-9;

// What the scraper actually produces for one fixture (after its own parsing), so the numbers can be put side by
// side with SportyBet's page: 1X2, every totals line, every Asian-handicap line (home perspective).
async function showMatch(sport, team) {
  const { events, status } = await fetchSportybetOdds(sport);
  const t = String(team).toLowerCase();
  const ev = (events || []).find(e => `${e.home_team} ${e.away_team}`.toLowerCase().includes(t));
  if (!ev) {
    return `No "${team}" fixture in the scraper output for ${sport} (${(events || []).length} events read${status && status.reason ? ', reason ' + status.reason : ''}).\n` +
      (events || []).slice(0, 12).map(e => `  ${e.home_team} vs ${e.away_team}`).join('\n');
  }
  const bm = (ev.bookmakers || [])[0] || {};
  const mk = key => ((bm.markets || []).find(m => m.key === key) || { outcomes: [] }).outcomes;
  const out = [`SportyBet as the scraper reads it | ${sport} | ${ev.home_team} vs ${ev.away_team} | ${ev.commence_time.slice(0, 16)}Z`];

  const h2h = mk('h2h');
  out.push('1X2: ' + (h2h.length ? h2h.map(o => `${o.name} ${r2(o.price)}`).join(' | ') : 'not read'));

  const tot = new Map();
  for (const o of mk('totals')) { const l = tot.get(o.point) || {}; l[String(o.name).toLowerCase()] = o.price; tot.set(o.point, l); }
  out.push('totals (line: over / under):' + (tot.size ? '' : ' none read'));
  [...tot.entries()].sort((a, b) => a[0] - b[0]).forEach(([line, v]) => out.push(`  ${line}: ${v.over != null ? r2(v.over) : '-'} / ${v.under != null ? r2(v.under) : '-'}`));

  const sp = mk('spreads');
  const homes = sp.filter(o => o.name === ev.home_team);
  out.push('Asian handicap (home line: home price / away price):' + (homes.length ? '' : ' none read'));
  homes.sort((a, b) => a.point - b.point).forEach(h => {
    const a = sp.find(o => o.name === ev.away_team && near(o.point, -h.point));
    out.push(`  ${h.point > 0 ? '+' : ''}${h.point}: ${r2(h.price)} / ${a ? r2(a.price) : '-'}`);
  });
  if (mk('handicap_3way').length) out.push('(3-way handicap is also read, but is not used for arbs)');
  out.push('Compare these with the same fixture on SportyBet. Every line should match exactly.');
  return out.join('\n');
}


// ── Sweep: structural sanity checks on what the scraper reads, for every fixture ───────────────────────────
// These cannot prove a price equals SportyBet's page, but they catch the mistakes a parser makes: swapped
// sides, a line read under the wrong number, a market that is not what we think it is.
//   1X2 margin 0-15%  |  totals: Over price rises (Under falls) as the line goes up, margin 0-20% per line
//   Asian handicap: every line has both sides, home price falls (away price rises) as the line goes up,
//   margin 0-20% per line  |  AH -0.5 (home) and away -0.5 must be within 25% of the 1X2 home / away price.
function checkEvent(ev) {
  const bm = (ev.bookmakers || [])[0] || {};
  const mk = key => ((bm.markets || []).find(m => m.key === key) || { outcomes: [] }).outcomes;
  const issues = [];
  const pct = m => ((m - 1) * 100).toFixed(1) + '%';

  let ph = null, pd = null, pa = null;
  for (const o of mk('h2h')) {
    if (o.name === ev.home_team) ph = o.price; else if (o.name === ev.away_team) pa = o.price; else if (/draw/i.test(o.name)) pd = o.price;
  }
  const has1x2 = !!(ph && pd && pa);
  if (has1x2) { const m = 1 / ph + 1 / pd + 1 / pa; if (m < 1 || m > 1.15) issues.push(`1X2 margin ${pct(m)}`); }
  else issues.push('1X2 not fully read');

  const tot = new Map();
  for (const o of mk('totals')) { const l = tot.get(o.point) || {}; l[String(o.name).toLowerCase()] = o.price; tot.set(o.point, l); }
  const tLines = [...tot.entries()].sort((a, b) => a[0] - b[0]);
  let prevO = 0, prevU = Infinity;
  for (const [line, v] of tLines) {
    if (v.over && v.under) { const m = 1 / v.over + 1 / v.under; if (m < 1 || m > 1.2) issues.push(`totals ${line} margin ${pct(m)}`); }
    if (v.over) { if (v.over < prevO - 1e-9) issues.push(`totals Over falls at ${line}`); prevO = v.over; }
    if (v.under) { if (v.under > prevU + 1e-9) issues.push(`totals Under rises at ${line}`); prevU = v.under; }
  }

  const sp = mk('spreads');
  const homes = sp.filter(o => o.name === ev.home_team).sort((a, b) => a.point - b.point);
  let prevH = Infinity, prevA = 0;
  for (const h of homes) {
    const a = sp.find(o => o.name === ev.away_team && near(o.point, -h.point));
    if (!a) { issues.push(`AH ${h.point} has no away side`); continue; }
    const m = 1 / h.price + 1 / a.price;
    if (m < 1 || m > 1.2) issues.push(`AH ${h.point} margin ${pct(m)}`);
    if (h.price > prevH + 1e-9) issues.push(`AH home price rises at ${h.point}`);
    if (a.price < prevA - 1e-9) issues.push(`AH away price falls at ${h.point}`);
    prevH = h.price; prevA = a.price;
  }
  const h05 = homes.find(h => near(h.point, -0.5));
  if (h05 && ph && Math.abs(h05.price / ph - 1) > 0.25) issues.push(`AH -0.5 home ${h05.price} vs 1X2 home ${ph}`);
  const a05 = sp.find(o => o.name === ev.away_team && near(o.point, -0.5));
  if (a05 && pa && Math.abs(a05.price / pa - 1) > 0.25) issues.push(`AH away -0.5 ${a05.price} vs 1X2 away ${pa}`);

  return { issues, has1x2, hasTotals: tLines.length > 0, hasAH: homes.length > 0 };
}

async function sweepLeague(sport) {
  const { events } = await fetchSportybetOdds(sport);
  if (!events || !events.length) return { sport, mark: '--', text: `-- ${sport} | no fixtures returned` };
  let flagged = 0, ah = 0, tot = 0;
  const examples = [];
  for (const ev of events) {
    const r = checkEvent(ev);
    if (r.hasAH) ah++;
    if (r.hasTotals) tot++;
    if (r.issues.length) { flagged++; if (examples.length < 3) examples.push(`     ${ev.home_team} vs ${ev.away_team}: ${r.issues.slice(0, 3).join('; ')}`); }
  }
  const mark = flagged === 0 ? 'OK' : '!!';
  return { sport, mark, text: [`${mark} ${sport} | ${events.length} fixtures | ${events.length - flagged} clean | ${flagged} flagged | totals ${tot}/${events.length} | AH ${ah}/${events.length}`, ...examples].join('\n') };
}

export default async function handler(req, res) {
  const token = process.env.ADMIN_DEBUG_TOKEN;
  if (!token || req.query.token !== token) return res.status(404).json({ error: 'not_found' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const out = [];
    if (req.query.sweep) {
      const only = req.query.sport ? String(req.query.sport) : null;
      const list = soccerLeagues().filter(j => !only || j[0] === only);
      if (!list.length) return res.status(400).json({ error: 'unknown_sport', available: soccerLeagues().map(j => j[0]) });
      const res2 = [];
      for (const [k] of list) { res2.push(await sweepLeague(k)); if (list.length > 1) await sleep(200); }
      const n = m => res2.filter(r => r.mark === m).length;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send([`SportyBet sweep | ${res2.length} leagues | all clean ${n('OK')} | flagged ${n('!!')} | no fixtures ${n('--')}`,
        'Checks structure only (margins, ladders, AH vs 1X2). It cannot prove a price equals the site.', '', ...res2.map(r => r.text)].join('\n'));
    }
    if (req.query.team && req.query.sport) {
      const k = String(req.query.sport);
      if (!soccerLeagues().some(j => j[0] === k)) return res.status(400).json({ error: 'unknown_sport', available: soccerLeagues().map(j => j[0]) });
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(await showMatch(k, String(req.query.team).slice(0, 40)));
    }
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
