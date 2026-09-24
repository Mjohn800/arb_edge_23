// pages/api/feed-audit.js
// Admin-only data-quality audit across every bookmaker feed we use (betano,
// 22bet, melbet via OddsPapi; sportybet via its scraper). It does not assume any
// feed is right — it measures internal consistency and how each book's prices
// compare with the other books, and prints concrete examples to check by hand
// against the bookmaker's own page.
//
// Needs env ADMIN_DEBUG_TOKEN (404s without it). Costs OddsPapi calls (cached
// 4 min, so run it right after a scan and most of it is free); 0 Odds API credits.
//
//   ONE league, full detail (+ the sport's market catalogue):
//     /api/feed-audit?token=TOKEN&sport=soccer_france_ligue_one
//   ALL soccer leagues, compact (flags only). Stops after ~7s and tells you
//   where to continue (add &skip=N):
//     /api/feed-audit?token=TOKEN&sports=soccer
//     /api/feed-audit?token=TOKEN&sports=soccer&skip=4
//   List the sport keys:  /api/feed-audit?token=TOKEN&sport=list
import { ODDSPAPI_TOURNAMENT_MAP, fetchBetanoOddsPapi, fetch22BetOddsPapi, fetchMelbetOddsPapi } from '../../lib/oddspapi-wa';
import { catalogueSummary } from '../../lib/oddspapi';
import { fetchSportybetOdds } from './scrapers/sportybet';
import { auditEvents } from '../../lib/auditFeed';

async function runLeague(sport, compact) {
  const m = ODDSPAPI_TOURNAMENT_MAP[sport];
  const fetchers = {
    betano: () => fetchBetanoOddsPapi(sport),
    '22bet': () => fetch22BetOddsPapi(sport),
    melbet: () => fetchMelbetOddsPapi(sport),
    sportybet: () => fetchSportybetOdds(sport),
  };
  const fetched = {}; const eventsByBook = {};
  await Promise.all(Object.entries(fetchers).map(async ([book, fn]) => {
    try {
      const r = await fn();
      eventsByBook[book] = (r && r.events) || [];
      // OddsPapi books: how many fixtures were dropped as duplicates, and how many events have a bookmaker fixture id that differs from the id in their link
      const idMismatch = eventsByBook[book].filter(e => { const id = e.oddspapi && e.oddspapi.bookmakerFixtureId; const url = (e.bookmakers && e.bookmakers[0] && e.bookmakers[0].url) || ''; const mm = url.match(/(\d{6,})\/?$/); return id && mm && mm[1] !== id; }).length;
      fetched[book] = { events: eventsByBook[book].length, ok: !(r && r.status && r.status.ok === false), reason: (r && r.status && r.status.reason) || null, duplicatesDropped: (r && r.status && r.status.duplicatesDropped) || 0, fixtureIdDiffersFromLinkId: idMismatch };
    } catch (err) {
      eventsByBook[book] = [];
      fetched[book] = { events: 0, ok: false, reason: err.message };
    }
  }));
  const audit = auditEvents(eventsByBook);
  for (const [b, f] of Object.entries(fetched)) {
    if (f.duplicatesDropped) audit.flags.push(b + ': ' + f.duplicatesDropped + ' fixtures dropped because OddsPapi lists the same match more than once');
    if (f.fixtureIdDiffersFromLinkId) audit.flags.push(b + ': ' + f.fixtureIdDiffersFromLinkId + ' events whose bookmaker fixture id differs from the id in their link (possible mis-linked match)');
  }
  if (compact) {
    return {
      fetched: Object.fromEntries(Object.entries(fetched).map(([b, f]) => [b, f.ok ? f.events : 'FAILED: ' + f.reason])),
      matchesSeenByTwoPlusBooks: audit.matchesSeenByTwoPlusBooks,
      flags: audit.flags,
      biggestGaps: audit.crossBook.slice(0, 3).map(c => c.book + ' ' + c.type + ' ' + c.side + ' ' + ((c.meanRatioVsOthers - 1) * 100).toFixed(1) + '% (n=' + c.n + ')'),
    };
  }
  let catalogue = null;
  try { catalogue = await catalogueSummary(m.sportId); } catch (err) { catalogue = { error: err.message }; }
  return { sport, sportId: m.sportId, tournamentId: m.tournamentId, fetched, audit, catalogue };
}

export default async function handler(req, res) {
  const token = process.env.ADMIN_DEBUG_TOKEN;
  if (!token || req.query.token !== token) return res.status(404).json({ error: 'not_found' });
  res.setHeader('Cache-Control', 'no-store');

  if (req.query.sport === 'list') return res.status(200).json({ sports: Object.keys(ODDSPAPI_TOURNAMENT_MAP) });

  if (req.query.sports) {
    const all = Object.keys(ODDSPAPI_TOURNAMENT_MAP);
    const list = req.query.sports === 'soccer' ? all.filter(k => k.startsWith('soccer_')) : String(req.query.sports).split(',').filter(k => ODDSPAPI_TOURNAMENT_MAP[k]);
    const skip = parseInt(req.query.skip || '0', 10) || 0;
    const started = Date.now();
    const results = {}; let done = skip;
    for (let i = skip; i < list.length; i++) {
      if (Date.now() - started > 7000) break;   // stay inside the serverless time limit
      try { results[list[i]] = await runLeague(list[i], true); } catch (err) { results[list[i]] = { error: err.message }; }
      done = i + 1;
    }
    return res.status(200).json({ totalLeagues: list.length, leaguesInThisResponse: Object.keys(results).length, continueWith: done < list.length ? '&skip=' + done : 'ALL DONE', results });
  }

  const sport = String(req.query.sport || 'soccer_epl');
  const m = ODDSPAPI_TOURNAMENT_MAP[sport];
  if (!m || !m.tournamentId) return res.status(400).json({ error: 'sport not mapped to an OddsPapi tournament (try sport=list)' });
  return res.status(200).json(await runLeague(sport, false));
}
