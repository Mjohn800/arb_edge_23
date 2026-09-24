// pages/api/feed-audit.js
// Admin-only data-quality audit for ONE league across every bookmaker feed we
// use (betano, 22bet, melbet via OddsPapi; sportybet via its scraper). It does
// not assume any feed is right — it measures internal consistency and how each
// book's prices compare with the other books, and prints concrete examples to
// check by hand against the bookmaker's own page. Also lists the sport's market
// catalogue and which markets are whitelisted.
//
// Needs env ADMIN_DEBUG_TOKEN (404s without it). Cost: up to 3 OddsPapi calls
// per league (cached 4 min), 0 Odds API credits.
//   /api/feed-audit?token=YOURTOKEN&sport=soccer_france_ligue_one
//   /api/feed-audit?token=YOURTOKEN&sport=list        -> the sport keys you can audit
import { ODDSPAPI_TOURNAMENT_MAP, fetchBetanoOddsPapi, fetch22BetOddsPapi, fetchMelbetOddsPapi } from '../../lib/oddspapi-wa';
import { catalogueSummary } from '../../lib/oddspapi';
import { fetchSportybetOdds } from './scrapers/sportybet';
import { auditEvents } from '../../lib/auditFeed';

export default async function handler(req, res) {
  const token = process.env.ADMIN_DEBUG_TOKEN;
  if (!token || req.query.token !== token) return res.status(404).json({ error: 'not_found' });
  const sport = String(req.query.sport || 'soccer_epl');
  if (sport === 'list') return res.status(200).json({ sports: Object.keys(ODDSPAPI_TOURNAMENT_MAP) });
  const m = ODDSPAPI_TOURNAMENT_MAP[sport];
  if (!m || !m.tournamentId) return res.status(400).json({ error: 'sport not mapped to an OddsPapi tournament (try sport=list)' });

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
      fetched[book] = { events: eventsByBook[book].length, ok: !(r && r.status && r.status.ok === false), reason: (r && r.status && r.status.reason) || null };
    } catch (err) {
      eventsByBook[book] = [];
      fetched[book] = { events: 0, ok: false, reason: err.message };
    }
  }));

  let catalogue = null;
  try { catalogue = await catalogueSummary(m.sportId); } catch (err) { catalogue = { error: err.message }; }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ sport, sportId: m.sportId, tournamentId: m.tournamentId, fetched, audit: auditEvents(eventsByBook), catalogue });
}
