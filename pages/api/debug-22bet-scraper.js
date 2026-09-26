// pages/api/debug-22bet-scraper.js
//
// TEMP DIAGNOSTIC (25 Sep 2026) — delete once totals/AH market-type field is
// confirmed and normalise22BetEvent() in scrapers/22bet.js is updated.
//
// get22BetOdds() in odds.js only calls the direct scraper as a FALLBACK, when
// OddsPapi has already failed for 22bet. As long as OddsPapi keeps working
// (which it currently is), that fallback path never runs, so the diagnostic
// logging added inside scrapers/22bet.js never fires either.
//
// This route bypasses that entirely: it calls the direct scraper's own
// building blocks straight, regardless of OddsPapi's status, and returns the
// raw market data directly in the response — no Vercel log digging needed.
//
// Usage: GET /api/debug-22bet-scraper?sport=soccer_epl
//   optional: &all=1  → dump every match's markets, not just the first
//   optional: &team=arsenal → pick a specific match by team-name fragment
//     instead of just the first upcoming one (useful once you know which
//     match actually has visible totals/AH lines on 22bet's own site)

const { fetch22BetEventDetail, TWENTYTWOBET_SPORT_MAP, TYPE_HOME, TYPE_DRAW, TYPE_AWAY, fetchViaScraperApi } = require('./scrapers/22bet');

const BASE = 'https://platform.22bet.com.gh';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Content-Type': 'application/json',
  'Client-Timezone': 'Africa/Accra',
  'Origin': 'https://22bet.com.gh',
  'Referer': 'https://22bet.com.gh/',
  'X-Requested-With': 'XMLHttpRequest',
  'Cookie': 'ubc-code=f37e211c-d4a8-490a-825c-64a9042763db; sid=80ad0e3d8021f22e77cb534252ffcbd',
};

function summariseMarket(m) {
  const outcomeTypes = (m.outcomes || []).map(o => o.type);
  const looksLike1x2 = outcomeTypes.length === 3 &&
    [TYPE_HOME, TYPE_DRAW, TYPE_AWAY].every(t => outcomeTypes.includes(t));
  const { outcomes, ...topLevel } = m;
  return { topLevel, outcomeCount: (m.outcomes || []).length, outcomeTypes, looksLike1x2 };
}

export default async function handler(req, res) {
  const sport = req.query.sport || 'soccer_epl';
  const wantAll = req.query.all === '1';
  const teamFilter = (req.query.team || '').toLowerCase();

  const mapping = TWENTYTWOBET_SPORT_MAP[sport];
  if (!mapping || !mapping.leagueId) {
    return res.status(400).json({ error: 'no_league_id_for_sport', sport, mapping: mapping || null });
  }

  // ---- STEP 1: list events (same as fetch22BetOdds does) ----
  const listUrl = `${BASE}/api/event/list?period=0&status_in=0&limit=150&main=1` +
    `&leagueId_in=${mapping.leagueId}&oddsExists_eq=1&lang=en&_trlang=en_gh`;

  let listJson;
  let listRes;
  try {
    listRes = await fetch(listUrl, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  } catch (err) {
    listRes = null; // matches fetch22BetOdds's own behavior: a thrown fetch means try the proxy next
  }

  if (listRes && !listRes.ok) listRes = null;

  if (!listRes) {
    const proxied = await fetchViaScraperApi(listUrl, { timeoutMs: 20000, label: 'debug-list' });
    if (!proxied.res) return res.status(502).json({ error: 'list_fetch_failed_via_proxy', detail: proxied.error, lastBody: proxied.lastBody });
    listRes = proxied.res;
  }

  try {
    listJson = await listRes.json();
  } catch (err) {
    return res.status(502).json({ error: 'list_json_parse_error', message: err.message });
  }

  const listItems = listJson?.data?.items;
  if (!Array.isArray(listItems)) {
    return res.status(502).json({ error: 'unexpected_list_shape', topKeys: Object.keys(listJson || {}) });
  }

  const now = Date.now();
  const upcomingStubs = listItems.filter(ev => {
    if (!ev.time) return true;
    const ms = new Date(ev.time).getTime();
    return ms > now - 3 * 60 * 60 * 1000;
  });

  if (upcomingStubs.length === 0) {
    return res.status(200).json({ error: 'no_upcoming_events', sport, rawListCount: listItems.length });
  }

  // ---- STEP 2: pull full detail for one or more events ----
  const stubsToFetch = wantAll ? upcomingStubs.slice(0, 10) : upcomingStubs.slice(0, 1);

  const results = [];
  for (const stub of stubsToFetch) {
    const detail = await fetch22BetEventDetail(stub.id);
    if (!detail) { results.push({ eventId: stub.id, error: 'detail_fetch_failed_or_relations_stripped' }); continue; }

    const competitors = detail.competitors || [];
    const homeComp = competitors.find(c => c.isHome === true || c.isHome === 1) || competitors[0];
    const awayComp = competitors.find(c => c.isHome === false || c.isHome === 0) || competitors[1];
    const homeTeam = homeComp?.name || 'Home';
    const awayTeam = awayComp?.name || 'Away';

    if (teamFilter && !((homeTeam + ' ' + awayTeam).toLowerCase().includes(teamFilter))) continue;

    const markets = detail.odds || [];
    const nonH2H = markets.filter(m => !summariseMarket(m).looksLike1x2);

    results.push({
      eventId: stub.id,
      match: `${homeTeam} vs ${awayTeam}`,
      time: detail.time,
      marketCount: markets.length,
      marketSummaries: markets.map(summariseMarket), // top-level fields only, every market
      nonH2HFullDump: nonH2H.slice(0, 8), // FULL objects (incl. outcomes) for totals/AH candidates
    });
  }

  return res.status(200).json({
    sport,
    leagueId: mapping.leagueId,
    rawListCount: listItems.length,
    upcomingCount: upcomingStubs.length,
    eventsReturned: results.length,
    results,
  });
}
