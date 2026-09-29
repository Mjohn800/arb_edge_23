import { LEAGUE_IDS, defaultSeason, normaliseTeamName, fetchLeagueForm } from '../../lib/teamForm';

// ─── HOW THIS ANALYZER WORKS (rewritten 28 Sep 2026) ─────────────────────────
// Everything a bettor should be able to trust is computed IN CODE from real data:
//   - market view: implied probabilities, consensus favourite, edge of the best
//     price vs the consensus of all books, arb margin + stake split
//   - team form / goals / H2H / over-2.5 / BTTS rates: from real results, using the
//     FREE football-data.org tier (needs a free FOOTBALL_DATA_API_KEY) for the 12
//     competitions it covers. Anywhere else the analysis is price-only and says so.
// The LLM (Groq, free tier) is used ONLY to word key insight / tip / reasoning
// from those computed facts. It is never asked to predict, and never given room
// to invent form, injuries or news. If Groq is down or rate-limited, the same
// analysis is still returned with code-written text, so it never comes back empty.
//
// Env vars:  GROQ_API_KEY (required for the AI wording)
//            FOOTBALL_DATA_API_KEY (optional, free: football-data.org/client/register)
//            GROQ_MODEL (optional, default openai/gpt-oss-120b)
//            ENABLE_REAL_FORM_DATA=true (optional: the old paid API-Football path)

const REAL_FORM_DATA_ENABLED = process.env.ENABLE_REAL_FORM_DATA === 'true';

// ─── RATE LIMITING (in-memory, per-IP, 5 requests / 10 min) ─────────────────
const rateLimitLog = {};
const RATE_LIMIT_WINDOW = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const hits = (rateLimitLog[ip] || []).filter(t => now - t < RATE_LIMIT_WINDOW);
  if (hits.length >= RATE_LIMIT_MAX) {
    const retryAfterMs = RATE_LIMIT_WINDOW - (now - hits[0]);
    return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }
  hits.push(now);
  rateLimitLog[ip] = hits;
  return { allowed: true };
}

// ─── RESPONSE CACHE (in-memory, 15 min TTL) ──────────────────────────────────
const analysisCache = {};
const ANALYSIS_CACHE_TTL = 15 * 60 * 1000;

function analysisCacheKey(match, sportKey, marketType, outcomes) {
  const oddsKey = (outcomes || [])
    .map(o => `${o.label}:${o.odds}:${o.bookName}:${o.medianOdds}`)
    .sort()
    .join('|');
  return `${match}::${sportKey}::${marketType}::${oddsKey}`;
}

// ─── FREE REAL FORM DATA: football-data.org ──────────────────────────────────
// Free registered tier: 10 requests/minute, 12 competitions, current season only.
// One call returns a whole competition's finished matches, so it is cached for
// 6 hours per competition (a handful of calls a day at most).
const FD_COMPETITIONS = {
  soccer_epl: 'PL',
  soccer_spain_la_liga: 'PD',
  soccer_italy_serie_a: 'SA',
  soccer_germany_bundesliga: 'BL1',
  soccer_france_ligue_one: 'FL1',
  soccer_netherlands_eredivisie: 'DED',
  soccer_portugal_primeira_liga: 'PPL',
  soccer_efl_champ: 'ELC',
  soccer_uefa_champs_league: 'CL',
  soccer_brazil_campeonato: 'BSA',
};
const FD_CACHE_TTL = 6 * 60 * 60 * 1000;
const fdCache = {};

// Team-name normaliser for matching the odds feed's names to football-data's.
function fdNorm(name) {
  return String(name || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(fc|afc|cf|sc|ac|as|ss|ssc|sv|fk|rc|rcd|cd|ud|ca|us|fsv|tsg|vfb|vfl|bsc|sk|ogc|hsc|sm|club|de|the)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
const FD_ALIASES = {
  'wolves': 'wolverhampton wanderers', 'spurs': 'tottenham hotspur',
  'man city': 'manchester city', 'man utd': 'manchester united', 'man united': 'manchester united',
  'internazionale milano': 'inter', 'inter milan': 'inter', 'internazionale': 'inter',
  'psg': 'paris saint germain', 'bayern munchen': 'bayern munich', 'sporting cp': 'sporting',
};
function fdKeyFor(name) {
  const n = fdNorm(name);
  return FD_ALIASES[n] || n;
}

// Finds the team key inside a competition's byTeam map. Exact match first, then a
// token-subset match ("atletico madrid" inside "atletico de madrid") that only
// succeeds when EXACTLY ONE team fits — an ambiguous name returns null, never a guess.
function resolveFdTeam(byTeam, name) {
  const want = fdKeyFor(name);
  if (!want) return null;
  if (byTeam[want]) return want;
  const wantTokens = want.split(' ');
  const candidates = Object.keys(byTeam).filter(k => {
    const kt = k.split(' ');
    const [small, big] = wantTokens.length <= kt.length ? [wantTokens, kt] : [kt, wantTokens];
    return small.join('').length >= 4 && small.every(t => big.includes(t));
  });
  return candidates.length === 1 ? candidates[0] : null;
}

async function fetchFootballDataSeason(code, apiKey) {
  const hit = fdCache[code];
  if (hit && Date.now() - hit.ts < FD_CACHE_TTL) return hit.data;

  const res = await fetch(`https://api.football-data.org/v4/competitions/${code}/matches?status=FINISHED`, {
    headers: { 'X-Auth-Token': apiKey },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error('football-data.org HTTP ' + res.status);
  const json = await res.json();

  const finished = (json.matches || []).slice().sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  const byTeam = {};
  const push = (k, rec) => { (byTeam[k] = byTeam[k] || []).push(rec); };
  for (const m of finished) {
    const hg = m.score?.fullTime?.home, ag = m.score?.fullTime?.away;
    if (typeof hg !== 'number' || typeof ag !== 'number') continue;
    const hk = fdKeyFor(m.homeTeam?.name || m.homeTeam?.shortName);
    const ak = fdKeyFor(m.awayTeam?.name || m.awayTeam?.shortName);
    if (!hk || !ak) continue;
    push(hk, { points: hg > ag ? 3 : hg === ag ? 1 : 0, goalsFor: hg, goalsAgainst: ag, venue: 'home', opponent: ak });
    push(ak, { points: ag > hg ? 3 : ag === hg ? 1 : 0, goalsFor: ag, goalsAgainst: hg, venue: 'away', opponent: hk });
  }
  const data = { byTeam, fixturesUsed: finished.length };
  fdCache[code] = { data, ts: Date.now() };
  return data;
}

// ─── REAL DATA HELPERS ───────────────────────────────────────────────────────
function splitTeamsFromMatch(match) {
  const parts = match.split(/\s+vs\.?\s+/i);
  if (parts.length !== 2) return null;
  return { home: parts[0].trim(), away: parts[1].trim() };
}

function formString(records, n = 5) {
  if (!records || records.length === 0) return null;
  return records.slice(-n).map(r => (r.points === 3 ? 'W' : r.points === 1 ? 'D' : 'L')).join(' ');
}

function avgGoals(records, n = 10) {
  const recent = (records || []).slice(-n);
  if (recent.length === 0) return null;
  const scored = recent.reduce((s, r) => s + r.goalsFor, 0) / recent.length;
  const conceded = recent.reduce((s, r) => s + r.goalsAgainst, 0) / recent.length;
  return { scored: +scored.toFixed(2), conceded: +conceded.toFixed(2), sample: recent.length };
}

function venueSplit(records, venue, n = 5) {
  const filtered = (records || []).filter(r => r.venue === venue).slice(-n);
  if (filtered.length === 0) return null;
  const wins = filtered.filter(r => r.points === 3).length;
  const goals = avgGoals(filtered, n);
  return { record: `${wins}W in last ${filtered.length} ${venue} games`, ...goals };
}

function rateOver(records, thresholdGoals, n = 10) {
  const recent = (records || []).slice(-n);
  if (recent.length === 0) return null;
  const hits = recent.filter(r => r.goalsFor + r.goalsAgainst > thresholdGoals).length;
  return { hits, sample: recent.length };
}

function bttsRate(records, n = 10) {
  const recent = (records || []).slice(-n);
  if (recent.length === 0) return null;
  const hits = recent.filter(r => r.goalsFor > 0 && r.goalsAgainst > 0).length;
  return { hits, sample: recent.length };
}

function headToHead(homeRecords, awayKey, n = 5) {
  if (!homeRecords) return null;
  const meetings = homeRecords.filter(r => r.opponent === awayKey).slice(-n);
  if (meetings.length === 0) return null;
  return meetings.map(m =>
    `${m.venue === 'home' ? 'home' : 'away'} ${m.goalsFor}-${m.goalsAgainst} (${m.points === 3 ? 'W' : m.points === 1 ? 'D' : 'L'})`
  );
}

function assembleRealData({ season, teams, homeRecords, awayRecords, awayKey, fixturesUsed, source }) {
  return {
    available: true,
    source,
    season,
    homeTeam: teams.home,
    awayTeam: teams.away,
    home: {
      form: formString(homeRecords),
      goals: avgGoals(homeRecords),
      homeSplit: venueSplit(homeRecords, 'home'),
      over25: rateOver(homeRecords, 2.5),
      btts: bttsRate(homeRecords),
    },
    away: {
      form: formString(awayRecords),
      goals: avgGoals(awayRecords),
      awaySplit: venueSplit(awayRecords, 'away'),
      over25: rateOver(awayRecords, 2.5),
      btts: bttsRate(awayRecords),
    },
    h2h: headToHead(homeRecords, awayKey),
    fixturesUsed,
  };
}

// Free path first (football-data.org), then the old paid API-Football path if it was
// switched on. Returns available:false with a plain reason when neither can cover the match.
async function buildRealMatchData(sportKey, match) {
  const teams = splitTeamsFromMatch(match);
  if (!teams) return { available: false, reason: `Could not split "${match}" into two teams` };

  const fdCode = FD_COMPETITIONS[sportKey];
  const fdKey = process.env.FOOTBALL_DATA_API_KEY;
  let fdReason = null;
  if (fdCode && fdKey) {
    try {
      const { byTeam, fixturesUsed } = await fetchFootballDataSeason(fdCode, fdKey);
      const hKey = resolveFdTeam(byTeam, teams.home);
      const aKey = resolveFdTeam(byTeam, teams.away);
      if (hKey || aKey) {
        return assembleRealData({
          season: 'current', teams, homeRecords: hKey ? byTeam[hKey] : null,
          awayRecords: aKey ? byTeam[aKey] : null, awayKey: aKey, fixturesUsed, source: 'football-data.org',
        });
      }
      fdReason = `Neither "${teams.home}" nor "${teams.away}" matched football-data.org team names`;
    } catch (err) {
      fdReason = 'football-data.org fetch failed: ' + err.message;
    }
  } else if (fdCode && !fdKey) {
    fdReason = 'FOOTBALL_DATA_API_KEY not set (free key: football-data.org/client/register)';
  }

  if (REAL_FORM_DATA_ENABLED && LEAGUE_IDS[sportKey] && process.env.API_FOOTBALL_KEY) {
    try {
      const season = defaultSeason();
      const result = await fetchLeagueForm(sportKey, season, process.env.API_FOOTBALL_KEY);
      const homeKey = normaliseTeamName(teams.home);
      const awayKey = normaliseTeamName(teams.away);
      const homeRecords = result.matches[homeKey];
      const awayRecords = result.matches[awayKey];
      if (homeRecords || awayRecords) {
        return assembleRealData({ season, teams, homeRecords, awayRecords, awayKey, fixturesUsed: result.meta.fixturesUsed, source: 'api-football' });
      }
    } catch (err) {
      fdReason = (fdReason ? fdReason + '; ' : '') + 'api-football failed: ' + err.message;
    }
  }

  return {
    available: false,
    reason: fdReason || `No free results source covers this competition (${sportKey || 'unknown'}); football-data.org covers PL, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga, Championship, Champions League and Brazil Serie A`,
  };
}

// ─── MARKET MATH (all in code) ───────────────────────────────────────────────
// outcomes: [{ label, odds (best price), bookName, medianOdds?, bookCount? }]
// Returns null when there aren't enough real prices to say anything.
function buildMarketView(outcomes, sportKey, marketType) {
  const list = Array.isArray(outcomes) ? outcomes : [];
  const priced = list.filter(o => typeof o.odds === 'number' && o.odds > 1);
  if (priced.length < 2 || priced.length !== list.length) return null;

  // A soccer 1X2 needs all three sides, otherwise implied probabilities would be wrong.
  const isSoccerWinner = String(sportKey || '').startsWith('soccer_') && /match winner|1x2|full time result/i.test(marketType || 'Match Winner');
  if (isSoccerWinner && priced.length !== 3) return null;

  const invSum = priced.reduce((s, o) => s + 1 / o.odds, 0);
  const isArb = invSum < 1;
  const arbMargin = isArb ? +((1 / invSum - 1) * 100).toFixed(2) : 0;

  // Consensus: median price per outcome, if the caller supplied it for every outcome.
  const haveMedians = priced.every(o => typeof o.medianOdds === 'number' && o.medianOdds > 1);
  let fair = null;
  if (haveMedians) {
    const medSum = priced.reduce((s, o) => s + 1 / o.medianOdds, 0);
    fair = priced.map(o => (1 / o.medianOdds) / medSum);
  }
  const minBooks = priced.reduce((m, o) => Math.min(m, typeof o.bookCount === 'number' ? o.bookCount : 99), 99);

  const rows = priced.map((o, i) => {
    const fairProb = fair ? fair[i] : null;
    const edge = fairProb != null ? +((o.odds * fairProb - 1) * 100).toFixed(2) : null;
    return { label: o.label, odds: o.odds, bookName: o.bookName, medianOdds: o.medianOdds ?? null, bookCount: o.bookCount ?? null, fairProbPct: fairProb != null ? +(fairProb * 100).toFixed(1) : null, edgePct: edge };
  });

  let favourite = null;
  if (fair) favourite = rows.reduce((a, b) => (b.fairProbPct > a.fairProbPct ? b : a));
  const bestEdge = fair ? rows.reduce((a, b) => (b.edgePct > a.edgePct ? b : a)) : null;

  // Arb stake split (per 100 staked), only meaningful when it is an arb.
  const stakes = isArb ? priced.map(o => ({ label: o.label, pct: +(((1 / o.odds) / invSum) * 100).toFixed(1) })) : null;

  return { rows, isArb, arbMargin, stakes, favourite, bestEdge, minBooks: minBooks === 99 ? null : minBooks, overroundPct: +((invSum - 1) * 100).toFixed(2) };
}

function riskFor(view) {
  if (view.isArb) return view.arbMargin >= 5 ? 'High' : view.arbMargin >= 2 ? 'Medium' : 'Low';
  let level = 1; // 0 low, 1 medium, 2 high
  if (view.favourite) {
    if (view.favourite.fairProbPct >= 60) level = 0;
    else if (view.favourite.fairProbPct < 42) level = 2;
  }
  if (view.minBooks != null && view.minBooks < 3) level = Math.min(2, level + 1);
  return ['Low', 'Medium', 'High'][level];
}

// ─── DATA QUALITY / FORM SUMMARIES (code-computed) ───────────────────────────
function assessDataQuality(realData, view) {
  if (!realData.available) {
    return { level: 'None', note: (view ? 'Price analysis only. ' : '') + realData.reason };
  }
  const homeSample = realData.home.goals?.sample || 0;
  const awaySample = realData.away.goals?.sample || 0;
  const hasH2H = !!realData.h2h;
  const src = realData.source === 'football-data.org' ? 'football-data.org, current season' : 'current season';
  if (homeSample >= 8 && awaySample >= 8 && hasH2H) return { level: 'High', note: `${realData.fixturesUsed} finished fixtures (${src}), H2H found` };
  if (homeSample >= 5 && awaySample >= 5) return { level: 'Medium', note: `${realData.fixturesUsed} finished fixtures (${src}), ${hasH2H ? 'H2H found' : 'no H2H this season'}` };
  return { level: 'Low', note: 'Small sample so far this season, so treat form and rate numbers as indicative, not predictive' };
}

function describeRealData(realData) {
  if (!realData.available) {
    return `No results data is available for this match (${realData.reason}). Do not state or imply anything about form, goals or head-to-head.`;
  }
  const g = (label, goals) => goals ? `${label} goals (last ${goals.sample}): scored ${goals.scored}/game, conceded ${goals.conceded}/game` : `${label} goals: no data`;
  const rate = (label, r) => r ? `${label}: ${r.hits}/${r.sample}` : `${label}: no data`;
  return `
${realData.homeTeam} (verified results this season):
- Form, oldest to most recent: ${realData.home.form || 'no data'}
- ${g('Overall', realData.home.goals)}
- Home record: ${realData.home.homeSplit?.record || 'no data'}
- ${rate('Over 2.5 goals', realData.home.over25)}; ${rate('Both teams scored', realData.home.btts)}

${realData.awayTeam} (verified results this season):
- Form, oldest to most recent: ${realData.away.form || 'no data'}
- ${g('Overall', realData.away.goals)}
- Away record: ${realData.away.awaySplit?.record || 'no data'}
- ${rate('Over 2.5 goals', realData.away.over25)}; ${rate('Both teams scored', realData.away.btts)}

Head-to-head this season: ${realData.h2h ? realData.h2h.join('; ') : 'no meetings yet'}`;
}

// Fields the UI already knows how to render, filled only from real computed data.
function realDataToUiFields(realData) {
  if (!realData.available) return {};
  const out = {};
  if (realData.home.form || realData.away.form) out.form = { home: realData.home.form || 'n/a', away: realData.away.form || 'n/a' };
  if (realData.home.goals || realData.away.goals) {
    out.goalsAvg = {
      homeScoredPer90: realData.home.goals?.scored ?? '—',
      homeConceededPer90: realData.home.goals?.conceded ?? '—',
      awayScoredPer90: realData.away.goals?.scored ?? '—',
      awayConceededPer90: realData.away.goals?.conceded ?? '—',
    };
  }
  if (realData.h2h) out.h2h = realData.h2h.join(' · ');

  const bets = [];
  const both = (a, b) => a && b && a.sample >= 5 && b.sample >= 5;
  if (both(realData.home.over25, realData.away.over25)) {
    const rateAvg = ((realData.home.over25.hits / realData.home.over25.sample) + (realData.away.over25.hits / realData.away.over25.sample)) / 2 * 100;
    const txt = `${realData.homeTeam} ${realData.home.over25.hits}/${realData.home.over25.sample}, ${realData.awayTeam} ${realData.away.over25.hits}/${realData.away.over25.sample} recent games went over 2.5 goals (hit rate, not a probability)`;
    if (rateAvg >= 60) bets.push({ market: 'Over 2.5 goals', recommendation: 'Lean Over', confidence: Math.round(rateAvg), reasoning: txt });
    else if (rateAvg <= 40) bets.push({ market: 'Over 2.5 goals', recommendation: 'Lean Under', confidence: Math.round(100 - rateAvg), reasoning: txt });
  }
  if (both(realData.home.btts, realData.away.btts)) {
    const rateAvg = ((realData.home.btts.hits / realData.home.btts.sample) + (realData.away.btts.hits / realData.away.btts.sample)) / 2 * 100;
    const txt = `${realData.homeTeam} ${realData.home.btts.hits}/${realData.home.btts.sample}, ${realData.awayTeam} ${realData.away.btts.hits}/${realData.away.btts.sample} recent games had both teams scoring (hit rate, not a probability)`;
    if (rateAvg >= 60) bets.push({ market: 'Both teams to score', recommendation: 'Lean Yes', confidence: Math.round(rateAvg), reasoning: txt });
    else if (rateAvg <= 40) bets.push({ market: 'Both teams to score', recommendation: 'Lean No', confidence: Math.round(100 - rateAvg), reasoning: txt });
  }
  if (bets.length) out.additionalBets = bets;
  return out;
}

// ─── PROMPT + GROQ ───────────────────────────────────────────────────────────
function describeMarketView(view) {
  if (!view) return 'No price data is available for this match.';
  const lines = view.rows.map(r =>
    `- ${r.label}: best ${r.odds} on ${r.bookName}` +
    (r.medianOdds ? `, consensus ${r.medianOdds}${r.bookCount ? ' across ' + r.bookCount + ' books' : ''}` : '') +
    (r.fairProbPct != null ? `, market-implied ${r.fairProbPct}%` : '') +
    (r.edgePct != null ? `, best price vs consensus ${r.edgePct >= 0 ? '+' : ''}${r.edgePct}%` : ''));
  let extra = '';
  if (view.isArb) extra = `\nThis is an arbitrage: backing every outcome at these best prices locks in about ${view.arbMargin}% profit. Stake split per 100: ${view.stakes.map(s => `${s.label} ${s.pct}`).join(', ')}.`;
  else extra = `\nCombined implied probability at best prices: ${(100 + view.overroundPct).toFixed(1)}% (over 100% means no arbitrage).`;
  return lines.join('\n') + extra;
}

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const body = {
    model,
    messages: [
      { role: 'system', content: 'You write short, plain-English betting notes for West African bettors. You only use the facts you are given. You never predict match results, never mention injuries, suspensions, transfers or news, and never invent numbers. You reply with a single JSON object and nothing else.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 900,
  };
  if (/gpt-oss/.test(model)) body.reasoning_effort = 'low'; // keeps the reasoning model from spending the whole token budget thinking

  const send = () => fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });

  let response = await send();
  let data = await response.json();
  if (!response.ok && body.reasoning_effort) { // model/param mismatch: retry once without it
    delete body.reasoning_effort;
    response = await send();
    data = await response.json();
  }
  if (!response.ok) throw new Error(data.error?.message || 'Groq API error ' + response.status);
  return data.choices?.[0]?.message?.content || '';
}

function extractJson(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('model reply had no JSON');
  return JSON.parse(text.slice(a, b + 1));
}

// Code-written key insight for form-only matches: states the counts, never judges them.
function formOnlyInsight(rd) {
  const parts = [];
  const o = (a, b) => a && b ? `${rd.homeTeam} ${a.hits}/${a.sample}, ${rd.awayTeam} ${b.hits}/${b.sample}` : null;
  const over = o(rd.home.over25, rd.away.over25);
  const btts = o(rd.home.btts, rd.away.btts);
  if (over) parts.push(`over 2.5 goals in recent games: ${over}`);
  if (btts) parts.push(`both teams scored: ${btts}`);
  return parts.length ? `Recent hit rates, ${parts.join('; ')}. No price data for this match.` : 'Form and goals numbers are shown below; no price data was available for this match.';
}

// Judgement words the AI must not attach to raw counts (it once called Arsenal's 3/5 "low").
const JUDGEMENT_WORDS = /\b(low|high|strong|weak|poor|good|impressive|dominant|indicat\w*)\b/i;

// Code-written text used when Groq is unavailable, so the card is never empty.
function fallbackText(view, realData, match) {
  if (view && view.isArb) {
    return {
      keyInsight: `Best prices across books add up to a ${view.arbMargin}% arbitrage on ${match}.`,
      tip: 'Prices move fast: place the longest-odds leg first, and re-check every price on the book before staking.',
      reasoning: `Backing every outcome at these best prices locks in about ${view.arbMargin}% whatever the result, if all legs are still available at these odds.`,
    };
  }
  if (view && view.favourite) {
    const f = view.favourite, be = view.bestEdge;
    return {
      keyInsight: `The market makes ${f.label} the favourite at about ${f.fairProbPct}% (consensus of the books scanned).`,
      tip: be && be.edgePct >= 2 ? `The best price on ${be.label} (${be.odds} on ${be.bookName}) is ${be.edgePct}% above consensus: check it is still on offer before staking.` : 'No book is meaningfully above consensus here, so there is no price edge: line-shop for the best odds if you bet.',
      reasoning: `Implied probabilities come from the median price across ${view.minBooks || 'several'}+ books with the bookmaker margin removed.`,
    };
  }
  return {
    keyInsight: realData.available ? formOnlyInsight(realData) : 'No price data or results data was available for this match.',
    tip: 'Scan this sport first to get prices, then analyze again.',
    reasoning: 'This analysis only reports what could be verified.',
  };
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { match, sport, sportKey: sportKeyIn, outcomes, margin, marketType, oddsAvailable } = req.body || {};

  if (!match || typeof match !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "match"' });
  }
  if (!sport || typeof sport !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "sport"' });
  }
  if (!Array.isArray(outcomes) || outcomes.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid "outcomes": expected a non-empty array' });
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return res.status(429).json({
      error: `Too many analysis requests. Please wait ${rl.retryAfterSeconds}s and try again.`,
      retryAfterSeconds: rl.retryAfterSeconds,
    });
  }

  // The client sends the real sport key as sportKey. Older callers only sent `sport`
  // (a display label), which never matched a league key, so form data silently failed.
  const sportKey = typeof sportKeyIn === 'string' && sportKeyIn ? sportKeyIn : sport;

  const cacheKey = analysisCacheKey(match, sportKey, marketType, outcomes);
  const cached = analysisCache[cacheKey];
  if (cached && Date.now() - cached.ts < ANALYSIS_CACHE_TTL) {
    console.log('[analyze] serving', match, 'from cache, age:', Math.round((Date.now() - cached.ts) / 1000) + 's');
    return res.status(200).json(cached.data);
  }

  const view = oddsAvailable === false ? null : buildMarketView(outcomes, sportKey, marketType);
  const realData = await buildRealMatchData(sportKey, match);
  const dataQuality = assessDataQuality(realData, view);

  // Code-computed fields (never LLM-guessed)
  const result = {
    dataQuality,
    priced: !!view,
    ...realDataToUiFields(realData),
  };
  if (view) {
    result.riskLevel = riskFor(view);
    if (view.isArb) {
      result.valueLeg = null;
      result.arbMargin = view.arbMargin;
      result.stakeSplit = view.stakes;
    } else if (view.favourite) {
      result.predictedOutcome = view.favourite.label + ' (market favourite)';
      result.confidence = Math.round(view.favourite.fairProbPct);
      result.confidenceLabel = 'Market-implied probability';
      const be = view.bestEdge;
      result.valueLeg = be && be.edgePct >= 2
        ? `${be.label} @ ${be.odds} (${be.bookName}), ${be.edgePct}% above consensus`
        : 'No clear price edge';
    }
  } else {
    result.riskLevel = 'High';
    result.noPriceNote = 'No price data for this match: form and context only.';
  }

  const prompt = `Match: ${match}
Sport: ${sport}
Market: ${marketType || 'Match Winner'}

PRICE FACTS (computed, exact):
${describeMarketView(view)}

RESULTS FACTS (computed, exact):
${describeRealData(realData)}

Write the notes using ONLY the facts above. Do not predict the match result. Do not mention injuries, suspensions, transfers or news. If a sample is small (under 5 games), say so. Keep every field to what is asked.
Quote numbers exactly as given (e.g. "3/5") and NEVER describe them with judgement words such as low, high, strong, weak, poor, good, impressive or dominant. Let the numbers speak; do not say what they "indicate".

Reply with exactly this JSON and nothing else:
{
  "keyInsight": "one sentence: the single most useful thing in the facts above for a bettor",
  "tip": "one actionable sentence about placing the bet (price movement, checking the price is still live, line shopping, stake discipline). Not a prediction",
  "reasoning": "two sentences explaining the read, citing only the numbers above"
}`;

  let llmOk = false;
  try {
    const text = await callGroq(prompt);
    const parsed = extractJson(text);
    const fb = fallbackText(view, realData, match);
    // On form-only matches (no prices) the AI must not editorialise the raw counts:
    // if it used a judgement word, swap in the code-written line for that field.
    const guard = (aiText, codeText) => (!view && JUDGEMENT_WORDS.test(aiText)) ? codeText : aiText;
    if (parsed.keyInsight) result.keyInsight = guard(String(parsed.keyInsight), fb.keyInsight);
    if (parsed.tip) result.tip = String(parsed.tip);
    if (parsed.reasoning) result.reasoning = guard(String(parsed.reasoning), fb.reasoning);
    llmOk = !!(result.keyInsight && result.tip);
  } catch (err) {
    console.warn('[analyze] Groq unavailable, using code-written text:', err.message);
  }
  if (!llmOk) {
    Object.assign(result, fallbackText(view, realData, match));
    result.textSource = 'code';
  } else {
    result.textSource = 'ai';
  }

  // Only cache full AI results, so a Groq outage doesn't pin the plain fallback for 15 minutes.
  if (llmOk) analysisCache[cacheKey] = { data: result, ts: Date.now() };

  return res.status(200).json(result);
}
