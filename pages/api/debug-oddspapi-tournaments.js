const { listTournaments } = require('../../lib/oddspapi');

// TEMP DEBUG ROUTE — delete once ODDSPAPI_TOURNAMENT_MAP is filled in.
// Burns one OddsPapi call per hit, no auth — don't leave it live long-term.
export default async function handler(req, res) {
  try {
    const all = await listTournaments(10); // 10 = Soccer

    // Names to look for — matches loosely (case-insensitive substring)
    // against tournamentName. Grouped by categoryName in the response so
    // you can pick the right country instead of guessing (OddsPapi has
    // real name collisions: 35 "Premier League"s, 7 "Ligue 1"s, etc).
    const wanted = [
      'world cup', 'premier league', 'ghana', 'africa cup', 'afcon',
      'mls', 'major league soccer', 'copa libertadores',
      'championship', 'eredivisie', 'primeira liga', 'liga portugal',
      'belgium', 'jupiler', 'scottish premiership', 'eliteserien',
      'allsvenskan', 'brasileiro', 'brazil', 'serie a',
    ];

    const matches = all.filter(t =>
      wanted.some(w => (t.tournamentName || '').toLowerCase().includes(w))
    );

    // Group by tournamentName so collisions across countries are obvious
    // at a glance instead of buried in a flat list.
    const grouped = {};
    for (const t of matches) {
      const key = t.tournamentName || 'unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        tournamentId: t.tournamentId,
        categoryName: t.categoryName,
        tournamentSlug: t.tournamentSlug,
        futureFixtures: t.futureFixtures,
      });
    }

    res.status(200).json({ totalTournaments: all.length, grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
