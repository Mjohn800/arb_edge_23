// pages/api/sportybet-debug.js
// Admin-only. Shows what SportyBet really returns for a league: every market id it sends, each market's
// raw keys, and its outcomes (ids, descriptions, prices, active flags), so market ids and field names can be
// confirmed instead of guessed. Costs no OddsPapi or Odds API quota.
//   /api/sportybet-debug?token=TOKEN&sport=soccer_epl
//   /api/sportybet-debug?token=TOKEN&sport=soccer_epl&markets=1,16,18,10,14,11,29
import { SPORTYBET_SPORT_MAP, SPORTYBET_BASE, SPORTYBET_HEADERS } from './scrapers/sportybet';

export default async function handler(req, res) {
  const token = process.env.ADMIN_DEBUG_TOKEN;
  if (!token || req.query.token !== token) return res.status(404).json({ error: 'not_found' });
  res.setHeader('Cache-Control', 'no-store');
  const sport = String(req.query.sport || 'soccer_epl');
  const m = SPORTYBET_SPORT_MAP[sport];
  if (!m || m.type !== 'tournament') return res.status(400).json({ error: 'sport not a tournament-type SportyBet sport' });
  const markets = String(req.query.markets || '1,16,18,10,14,11,29,26,36').replace(/[^0-9,]/g, '');
  try {
    const r = await fetch(SPORTYBET_BASE + '/pcEvents', {
      method: 'POST',
      headers: { ...SPORTYBET_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ sportId: m.sportId, marketId: markets, tournamentId: [[m.tournamentId]] }]),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return res.status(502).json({ error: 'http_' + r.status });
    const data = (await r.json())?.data;
    const flat = data?.events || data?.tournamentEvents || data?.matchList || data?.list || (Array.isArray(data) ? data : []);
    const events = flat.length && !flat[0]?.events ? flat : flat.flatMap(w => w.events || w.matches || w.items || []);
    const seen = {};
    for (const ev of events) for (const mk of (ev.markets || [])) {
      const k = String(mk.id ?? mk.marketId);
      const s = seen[k] = seen[k] || { marketId: k, name: mk.name || mk.desc || null, events: 0, sampleOutcomeDescs: [], specifiers: new Set() };
      s.events++; if (mk.specifier != null) s.specifiers.add(String(mk.specifier));
      if (s.sampleOutcomeDescs.length < 6) (mk.outcomes || []).forEach(o => { if (s.sampleOutcomeDescs.length < 6) s.sampleOutcomeDescs.push(o.desc || o.name); });
    }
    const summary = Object.values(seen).map(s => ({ ...s, specifiers: [...s.specifiers].slice(0, 12) }));
    const sample = events.slice(0, 2).map(ev => ({
      eventLevelKeys: Object.keys(ev).filter(k => k !== 'markets'),
      eventId: ev.eventId ?? ev.id ?? ev.matchId, home: ev.homeTeamName, away: ev.awayTeamName, start: ev.estimateStartTime,
      markets: (ev.markets || []).slice(0, 14),   // raw market objects, untouched
    }));
    return res.status(200).json({ sport, requestedMarkets: markets, eventsReturned: events.length, marketIdsSeen: summary, sample });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
