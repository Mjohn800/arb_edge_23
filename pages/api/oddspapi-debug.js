// pages/api/oddspapi-debug.js
// Admin-only diagnostic: prints every 1x2 / totals / spreads market OddsPapi
// returns for ONE match, with exact marketName, line and prices, so the names
// can be checked against the bookmaker's own page before being whitelisted in
// lib/oddspapi.js (CONFIRMED_MARKET_NAMES).
//
// Usage (needs env ADMIN_DEBUG_TOKEN set on Vercel; without it this route 404s):
//   /api/oddspapi-debug?token=YOURTOKEN&book=betano&sport=soccer_epl&team=tottenham
import { debugFixtureMarkets } from '../../lib/oddspapi';
import { ODDSPAPI_TOURNAMENT_MAP } from '../../lib/oddspapi-wa';

export default async function handler(req, res) {
  const token = process.env.ADMIN_DEBUG_TOKEN;
  if (!token || req.query.token !== token) return res.status(404).json({ error: 'not_found' });

  const book = String(req.query.book || 'betano');
  const sport = String(req.query.sport || 'soccer_epl');
  const team = String(req.query.team || '');
  if (!['betano', '22bet', 'melbet'].includes(book)) return res.status(400).json({ error: 'book must be betano, 22bet or melbet' });
  if (!team) return res.status(400).json({ error: 'team query param required, e.g. team=tottenham' });
  const m = ODDSPAPI_TOURNAMENT_MAP[sport];
  if (!m || !m.tournamentId) return res.status(400).json({ error: 'sport not mapped to an OddsPapi tournament' });

  try {
    const out = await debugFixtureMarkets(book, m.tournamentId, m.sportId, team);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(out);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
