/**
 * scrapers/sportybet.js
 *
 * CONFIRMED ENDPOINTS (network capture 2026-06-22/23):
 *
 * Match events with odds:
 *   GET /api/gh/factsCenter/outrightEvents/sports/{sportId}/tournaments/{tournamentId}
 *   → returns upcoming matches with inline odds ✓
 *
 * Broad sport (MMA / no tournament):
 *   GET /api/gh/factsCenter/quickMarketList?block=E&sport={sportId}
 *
 * Odds refresh:
 *   GET /api/gh/factsCenter/stale-odds/results?eventIds={id1,id2,...}
 */

const SPORTYBET_SPORT_MAP = {
  soccer_epl:                   { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:17'   },
  soccer_uefa_champs_league:    { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:7'    },
  soccer_uefa_europa_league:    { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:679'  },
  soccer_spain_la_liga:         { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:8'    },
  soccer_germany_bundesliga:    { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:35'   },
  soccer_italy_serie_a:         { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:23'   },
  soccer_france_ligue_one:      { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:34'   },
  soccer_ghana_premiership:     { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:1436' },
  soccer_africa_cup_of_nations: { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:5765' },
  soccer_fifa_world_cup:        { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:16'   }, // ✓ confirmed
  // -- Added for ArbEdge's 20 scanned leagues (same Sportradar IDs the Betfox scraper uses) --
  // IDs below the 'verified' note were cross-checked between SportyBet and Betfox.
  soccer_netherlands_eredivisie:    { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:37' },
  soccer_portugal_primeira_liga:    { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:238' },
  soccer_norway_eliteserien:        { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:20' },
  soccer_sweden_allsvenskan:        { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:40' },
  soccer_spl:                       { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:36' },
  // UNVERIFIED: check each in SportyBet's network tab. A wrong ID just returns no matches.
  soccer_belgium_first_div:         { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:38' },
  soccer_efl_champ:                 { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:18' },
  soccer_brazil_campeonato:         { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:325' },
  soccer_usa_mls:                   { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:242' },
  soccer_conmebol_copa_libertadores: { type: 'tournament', sportId: 'sr:sport:1',   tournamentId: 'sr:tournament:384' },

  basketball_nba:               { type: 'tournament', sportId: 'sr:sport:2',   tournamentId: 'sr:tournament:132'  },
  tennis_atp_wimbledon:         { type: 'tournament', sportId: 'sr:sport:5',   tournamentId: 'sr:tournament:270'  },
  mma_mixed_martial_arts:       { type: 'sport',      sportId: 'sr:sport:117', tournamentId: null                 },

  // ── Cricket (sr:sport:21) ────────────────────────────────────────────────
  // Using type:'sport' + quickMarketList (same working endpoint as MMA) until
  // tournament IDs are confirmed via DevTools. Returns all cricket on SportyBet.
  cricket_ipl:                  { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_t20_world_cup:        { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_icc_world_cup:        { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_icc_trophy:           { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_international_t20:    { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_odi:                  { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_test_match:           { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_the_hundred:          { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_big_bash:             { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_psl:                  { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_caribbean_premier_league: { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
  cricket_asia_cup:             { type: 'sport', sportId: 'sr:sport:21', tournamentId: null },
};

const BASE = 'https://www.sportybet.com/api/gh/factsCenter';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Origin': 'https://www.sportybet.com',
  'Referer': 'https://www.sportybet.com/gh/m/sport/football',
};

// Asian Handicap is recognised by STRUCTURE, not by market id: exactly two active outcomes described as
// "Home (-0.5)" / "Away (+0.5)" (a signed number, no colon), on the quarter-line grid, with mirrored lines.
// Anything else (3-way handicap "Home (1:0)", draw-no-bet, odd/even...) fails the test and is skipped.
function parseAsianHandicap(market, homeTeam, awayTeam) {
  const outs = (market.outcomes || market.selections || []).filter(o => o.isActive !== false && o.active !== false);
  if (outs.length !== 2) return null;
  const res = [];
  for (const o of outs) {
    const price = parseFloat(o.odds || o.price || o.oddsValue);
    const desc = String(o.desc || o.name || '').trim();
    const m = desc.match(/^(Home|Away)\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*\)$/i);
    if (!m || !(price > 1)) return null;
    const point = parseFloat(m[2]);
    if (!Number.isFinite(point) || Math.abs(point * 4 - Math.round(point * 4)) > 1e-9) return null;
    res.push({ side: m[1].toLowerCase(), point, price, desc });
  }
  const h = res.find(r => r.side === 'home'), a = res.find(r => r.side === 'away');
  if (!h || !a || Math.abs(h.point + a.point) > 1e-9) return null; // the two sides must be mirror lines
  return [{ name: homeTeam, price: h.price, point: h.point, desc: h.desc }, { name: awayTeam, price: a.price, point: a.point, desc: a.desc }];
}

const MARKET_MAP = { '1_1': 'h2h', '1': 'h2h', '18_1': 'totals', '18': 'totals', '10_1': 'handicap_3way', '10': 'handicap_3way', '29_1': 'btts', '29': 'btts' };

// SportyBet market ids 1 / 18 are the 90-minute (regulation) markets: right for soccer, but NOT confirmed to
// match the Odds API's overtime-inclusive h2h/totals for basketball etc. Fail closed: soccer only until each
// other sport is verified in SportyBet DevTools.
async function fetchSportybetOdds(sportKey) {
  if (!String(sportKey).startsWith('soccer_')) {
    return { events: [], status: { ok: true, reason: 'sport_not_verified_for_sportybet', fetchedAt: new Date().toISOString() } };
  }
  const mapping = SPORTYBET_SPORT_MAP[sportKey];
  if (!mapping) return { events: [], status: { ok: true, reason: 'unsupported_sport', fetchedAt: new Date().toISOString() } };

  try {
    let rawEvents = [];

    if (mapping.type === 'tournament') {
      // ✅ CONFIRMED endpoint from DevTools capture (30 Jun 2026):
      // POST /api/gh/factsCenter/pcEvents
      // Body: [{"sportId":"sr:sport:1","marketId":"1,18,10,29,11,26,36,14","tournamentId":[["sr:tournament:16"]]}]
      const body = [{
        sportId: mapping.sportId,
        marketId: '1,18,10,29,11,26,36,14,16', // 16 added for Asian Handicap; confirm the id with /api/sportybet-debug
        tournamentId: [[mapping.tournamentId]],
      }];

      try {
        const res = await fetch(`${BASE}/pcEvents`, {
          method: 'POST',
          headers: { ...HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          console.warn('[SportyBet] pcEvents', res.status, 'for', sportKey, errBody.slice(0, 200));
        } else {
          const json = await res.json();
          const data = json?.data;
          // pcEvents returns category/tournament wrappers with nested events arrays
          // e.g. [{id, name, categoryName, events: [{eventId, homeTeamName, ...}]}]
          // Try flat events first, then unwrap from wrapper objects
          const flat = data?.events || data?.tournamentEvents || data?.matchList || data?.list;
          if (flat && flat.length > 0 && !flat[0]?.events) {
            rawEvents = flat;
          } else {
            // Wrapper shape — flatten the nested events arrays
            const wrappers = flat || (Array.isArray(data) ? data : []);
            rawEvents = wrappers.flatMap(w => w.events || w.matches || w.items || []);
            if (rawEvents.length === 0 && wrappers.length > 0) {
              // Last resort: maybe data itself is the wrapper array
              rawEvents = (Array.isArray(data) ? data : []).flatMap(w => w.events || w.matches || []);
            }
          }
          console.log('[SportyBet] pcEvents →', rawEvents.length, 'events for', sportKey);
        }
      } catch (err) {
        console.warn('[SportyBet] pcEvents error:', err.message);
      }

    } else {
      // Broad sport query for MMA etc.
      const url = `${BASE}/quickMarketList?block=E&sport=${mapping.sportId}`;
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        let body = '';
        try { body = (await res.text()).slice(0, 300); } catch {}
        console.warn('[SportyBet] quickMarketList', res.status, 'for', sportKey, '| body:', body);
        return { events: [], status: { ok: false, reason: 'http_' + res.status, fetchedAt: new Date().toISOString() } };
      }
      const json = await res.json();
      rawEvents = json?.data?.events || json?.data?.tournamentEvents || [];
    }

    const now = Date.now();
    const upcoming = rawEvents.filter(ev => {
      let ms = ev.estimateStartTime || ev.startTime || ev.beginTime || 0;
      // Handle seconds vs milliseconds - Sportradar timestamps are sometimes in seconds
      if (ms && ms < 1e12) ms = ms * 1000;
      if (ms === 0) return true; // no timestamp = include it
      return ms > now - 3 * 60 * 60 * 1000; // allow up to 3hrs in past (live/just started)
    });
    if (rawEvents.length > 0) {
      const sample = rawEvents[0];
      console.log('[SportyBet] sample timestamp:', sample.estimateStartTime, '| markets:', (sample.markets || []).length);
    }

    // Try normalising with inline odds first
    const pulledAtIso = new Date().toISOString(); // time of the raw pull, stamped on every bookmaker
    let normalised = upcoming.map(ev => normaliseEvent(ev, sportKey, pulledAtIso)).filter(Boolean);

    // If no inline odds, fetch via stale-odds
    if (normalised.length === 0 && upcoming.length > 0) {
      const ids = upcoming.map(e => e.eventId || e.id || e.matchId).filter(Boolean).join(',');
      if (ids) {
        try {
          const oddsRes = await fetch(`${BASE}/stale-odds/results?eventIds=${ids}`, {
            headers: HEADERS, signal: AbortSignal.timeout(8000),
          });
          if (oddsRes.ok) {
            const oddsJson = await oddsRes.json();
            const oddsMap = {};
            (oddsJson?.data || []).forEach(item => {
              const id = item.eventId || item.id;
              if (id) oddsMap[id] = item;
            });
            normalised = upcoming.map(ev => {
              const id = ev.eventId || ev.id || ev.matchId;
              return normaliseEvent({ ...ev, ...(oddsMap[id] || {}) }, sportKey, pulledAtIso);
            }).filter(Boolean);
          } else {
            console.warn('[SportyBet] stale-odds', oddsRes.status, 'for', sportKey);
          }
        } catch (err) {
          console.warn('[SportyBet] stale-odds error:', err.message);
        }
      }
    }

    console.log('[SportyBet]', sportKey, '→ raw:', rawEvents.length, '| upcoming:', upcoming.length, '| normalised:', normalised.length);
    return { events: normalised, status: { ok: true, reason: null, fetchedAt: new Date().toISOString() } };

  } catch (err) {
    console.warn('[SportyBet] error for', sportKey, err.message);
    return { events: [], status: { ok: false, reason: err.name === 'TimeoutError' ? 'timeout' : err.message, fetchedAt: new Date().toISOString() } };
  }
}

function normaliseEvent(ev, sportKey, pulledAtIso) {
  try {
    const homeTeam = ev.homeTeamName || ev.home?.name || ev.homeName || ev.homeTeam || 'Home';
    const awayTeam = ev.awayTeamName || ev.away?.name  || ev.awayName || ev.awayTeam || 'Away';
    let startMs = ev.estimateStartTime || ev.startTime || ev.beginTime || ev.matchTime || ev.kickOff || ev.date || ev.startDate || null;
    if (startMs && startMs < 1e12) startMs = startMs * 1000;
    // Log raw event structure for first event to help diagnose field names
    if (!startMs) {
      console.log('[SportyBet] no timestamp found, raw event:', JSON.stringify(ev).slice(0, 500));
      return null;
    }

    const h2hOutcomes = [], totalsOutcomes = [], ahOutcomes = [], bttsOutcomes = [], spreadsOutcomes = [];
    for (const market of (ev.markets || ev.odds || ev.marketList || ev.quickMarkets || [])) {
      const mKey = MARKET_MAP[market.id] || MARKET_MAP[market.marketId] || MARKET_MAP[String(market.marketType)];
      if (!mKey) {
        const ah = parseAsianHandicap(market, homeTeam, awayTeam);
        if (ah) spreadsOutcomes.push(...ah);
        continue;
      }
      for (const o of (market.outcomes || market.selections || market.odds || [])) {
        // A suspended outcome can still carry its last price: never use it.
        if (o.isActive === false || o.active === false) continue;
        const price = parseFloat(o.odds || o.price || o.oddsValue);
        if (!price || price <= 1.0) continue;
        // SportyBet encodes the line in desc e.g. "Over 2.5", "Under 0.5", "Home (2:0)"
        // Never use o.name alone for totals/spreads — always use desc which has the full label
        const desc = o.desc || o.name || '';
        if (mKey === 'h2h') {
          const name = desc === 'Home' ? homeTeam : desc === 'Away' ? awayTeam : desc === 'Draw' ? 'Draw' :
                       o.name === '1' ? homeTeam : o.name === 'X' ? 'Draw' : o.name === '2' ? awayTeam : desc;
          if (name) h2hOutcomes.push({ name, price });
        } else if (mKey === 'totals') {
          // desc is "Over 2.5", "Under 0.5" etc — parse point from it
          const match = desc.match(/^(Over|Under)\s+([\d.]+)$/i);
          if (!match) continue;
          const side = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
          const point = parseFloat(match[2]);
          totalsOutcomes.push({ name: side, price, point, desc });
        } else if (mKey === 'handicap_3way') {
          // NOT Asian Handicap: this market has a Draw outcome, so it's the 3-way
          // (European) handicap — "Home (1:0)" / "Draw (1:0)" / "Away (1:0)" is one
          // shared starting score. A handicap-draw LOSES the home/away legs, unlike
          // AH where a push refunds, so these prices are NOT comparable with any
          // 2-way AH line. `point` here is the shared home-perspective line for all
          // three outcomes (away is NOT sign-flipped). Kept under its own key so
          // findArbs()/findMiddles() (which only read 'spreads') ignore it.
          // desc is "Home (2:0)", "Draw (3:0)", "Away (4:0)" — parse point from it
          const match = desc.match(/^(Home|Draw|Away)\s+\((\d+):(\d+)\)$/i);
          if (!match) continue;
          const side = match[1];
          const point = parseInt(match[2]) - parseInt(match[3]);
          const name = side === 'Home' ? homeTeam : side === 'Away' ? awayTeam : 'Draw';
          ahOutcomes.push({ name, price, point, desc });
        } else if (mKey === 'btts') {
          bttsOutcomes.push({ name: desc === 'Yes' ? 'Yes' : 'No', price });
        }
      }
    }
    const markets = [];
    if (h2hOutcomes.length >= 2)   markets.push({ key: 'h2h',     outcomes: h2hOutcomes });
    if (totalsOutcomes.length >= 2) markets.push({ key: 'totals',  outcomes: totalsOutcomes });
    if (spreadsOutcomes.length >= 2) markets.push({ key: 'spreads', outcomes: spreadsOutcomes });
    if (ahOutcomes.length >= 2)     markets.push({ key: 'handicap_3way', outcomes: ahOutcomes });
    if (bttsOutcomes.length >= 2)   markets.push({ key: 'btts',    outcomes: bttsOutcomes });
    if (markets.length === 0) return null;

    return {
      id: 'sportybet_' + (ev.eventId || ev.id || ev.matchId),
      sport_key: sportKey,
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: new Date(startMs).toISOString(),
      bookmakers: [{ key: 'sportybet', title: 'SportyBet', markets, _wa: true, last_update: pulledAtIso || null,
        // SportyBet's own event id, kept on the bookmaker record so it survives the merge into a global event
        // (same reason as 22bet's eventId) and a per-event refresh can find this exact fixture later.
        eventId: String(ev.eventId || ev.id || ev.matchId || '') || null }],
    };
  } catch { return null; }
}

module.exports = { fetchSportybetOdds, parseAsianHandicap, SPORTYBET_SPORT_MAP, SPORTYBET_BASE: BASE, SPORTYBET_HEADERS: HEADERS };
