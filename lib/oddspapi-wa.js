// pages/api/oddspapi-debug.js
// Admin-only diagnostic: prints every 1x2 / totals / spreads market OddsPapi
// returns for ONE match, with exact marketName, line and prices, so the names
// can be checked against the bookmaker's own page before being whitelisted in
// lib/oddspapi.js (CONFIRMED_MARKET_NAMES).
//
// Usage (needs env ADMIN_DEBUG_TOKEN set on Vercel; without it this route 404s):
//   /api/oddspapi-debug?token=YOURTOKEN&book=betano&sport=soccer_epl&team=tottenham   (omit team, or team=first, to use the first fixture with odds)
// Narrow the output: &type=totals&lines=2.75,3,3.5,4  (add &raw=1 to include the untouched OddsPapi entries)
// Optional &line=3.5 also returns the raw, untouched OddsPapi entries (all fields) for markets on that line.
import { debugFixtureMarkets } from '../../lib/oddspapi';
import { ODDSPAPI_TOURNAMENT_MAP } from '../../lib/oddspapi-wa';
import { fetchSportybetOdds } from './scrapers/sportybet';

export default async function handler(req, res) {
  const token = process.env.ADMIN_DEBUG_TOKEN;
  if (!token || req.query.token !== token) return res.status(404).json({ error: 'not_found' });

  const book = String(req.query.book || 'betano');
  const sport = String(req.query.sport || 'soccer_epl');
  const team = String(req.query.team || 'first');   // 'first' = the first fixture that has odds
  if (!['betano', '22bet', 'melbet', 'sportybet'].includes(book)) return res.status(400).json({ error: 'book must be betano, 22bet, melbet or sportybet' });
  const m = ODDSPAPI_TOURNAMENT_MAP[sport];
  if (!m || !m.tournamentId) return res.status(400).json({ error: 'sport not mapped to an OddsPapi tournament' });

  // SportyBet is not an OddsPapi book: show what the scraper hands the app for one match, so it can be checked against SportyBet's own page.
  if (book === 'sportybet') {
    try {
      const r = await fetchSportybetOdds(sport);
      const q = team.toLowerCase();
      const ev = (r.events || []).find(e => q === 'first' || (e.home_team + ' ' + e.away_team).toLowerCase().includes(q));
      if (!ev) return res.status(200).json({ error: 'fixture_not_found', available: (r.events || []).slice(0, 20).map(e => e.home_team + ' vs ' + e.away_team) });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ match: ev.home_team + ' vs ' + ev.away_team, startTime: ev.commence_time, bookmaker: 'sportybet', markets: ((ev.bookmakers || [])[0]?.markets || []).map(mk => ({ key: mk.key, outcomes: (mk.outcomes || []).map(o => o.name + (o.point != null ? ' (' + o.point + ')' : '') + ': ' + o.price).join(' | ') })) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  try {
    const out = await debugFixtureMarkets(book, m.tournamentId, m.sportId, team, req.query.line, {
      type: req.query.type ? String(req.query.type) : undefined,
      lines: req.query.lines ? String(req.query.lines).split(',').map(Number).filter(n => !Number.isNaN(n)) : undefined,
      raw: req.query.raw === '1',
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(out);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
