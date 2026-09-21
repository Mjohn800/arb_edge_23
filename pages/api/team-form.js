// ─── TEAM FORM (results history) ───────────────────────────────────────────
// Feeds index.js's TEAM_FORM structure — chronological points-per-game per
// team, used by getFormDivergence() to flag "good team, bad recent stretch"
// mispricing.
//
// Fetch/normalise logic now lives in lib/teamForm.js, shared with
// /api/analyze so both use the same real results instead of the Analyzer
// duplicating (or worse, inventing) this data.
//
// GET /api/team-form?sport=soccer_epl              -> single league, default season
// GET /api/team-form?sport=soccer_epl&season=2025  -> single league, explicit season
// GET /api/team-form?sport=all                     -> all 5 leagues in one response,
//                                                      shaped to drop straight into
//                                                      index.js's TEAM_FORM constant

import { LEAGUE_IDS, defaultSeason, fetchLeagueForm } from '../../lib/teamForm';

export default async function handler(req, res) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API_FOOTBALL_KEY not set in environment' });
  }

  const { sport, season: seasonParam } = req.query;
  const season = seasonParam ? parseInt(seasonParam, 10) : defaultSeason();

  if (!sport) {
    return res.status(400).json({ error: 'sport query param required (a Top-5 sport key, or "all")' });
  }

  try {
    if (sport === 'all') {
      const sportKeys = Object.keys(LEAGUE_IDS);
      const results = await Promise.allSettled(
        sportKeys.map(k => fetchLeagueForm(k, season, apiKey))
      );

      const TEAM_FORM = {};
      const meta = {};
      results.forEach((r, i) => {
        const key = sportKeys[i];
        if (r.status === 'fulfilled') {
          TEAM_FORM[key] = r.value.teams;
          meta[key] = r.value.meta;
        } else {
          TEAM_FORM[key] = {};
          meta[key] = { error: r.reason?.message || 'unknown error' };
          console.log('[team-form]', key, 'failed:', r.reason?.message);
        }
      });

      return res.status(200).json({ TEAM_FORM, meta, season });
    }

    if (!LEAGUE_IDS[sport]) {
      return res.status(400).json({ error: 'Unknown sport key: ' + sport, known: Object.keys(LEAGUE_IDS) });
    }

    const result = await fetchLeagueForm(sport, season, apiKey);
    console.log('[team-form]', sport, season, '-> teams:', result.meta.teamsFound, 'fixtures:', result.meta.fixturesUsed, result.fromCache ? '(cached)' : '(fresh)');

    return res.status(200).json({
      TEAM_FORM: { [sport]: result.teams },
      meta: { [sport]: result.meta },
      season,
    });
  } catch (err) {
    console.log('[team-form] error:', err.message);
    return res.status(502).json({ error: err.message });
  }
}
