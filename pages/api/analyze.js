import { LEAGUE_IDS, defaultSeason, normaliseTeamName, fetchLeagueForm } from '../../lib/teamForm';

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

function analysisCacheKey(match, sport, marketType, outcomes) {
  const oddsKey = (outcomes || [])
    .map(o => `${o.label}:${o.odds}:${o.bookName}`)
    .sort()
    .join('|');
  return `${match}::${sport}::${marketType}::${oddsKey}`;
}

// ─── REAL DATA HELPERS ───────────────────────────────────────────────────────
// Everything below computes numbers directly from fetchLeagueForm()'s match
// records. The model never sees raw fixtures and never invents form/goals —
// it only gets to reason over what's computed here. If a team can't be
// matched (unmapped league, name-normalisation miss), the relevant fields
// come back null and the prompt tells the model plainly that no data exists,
// rather than leaving a gap it might fill in on its own.

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

// Pulls together everything the prompt needs for one match. Returns
// `available: false` when the league isn't one of the Top-5 team-form
// covers, or when either team name didn't normalise-match anything in the
// season's fixtures — both are real, expected gaps, not bugs.
async function buildRealMatchData(sport, match) {
  if (!LEAGUE_IDS[sport]) {
    return { available: false, reason: `No results data for sport key "${sport}" (only Top-5 European leagues are covered)` };
  }
  const teams = splitTeamsFromMatch(match);
  if (!teams) {
    return { available: false, reason: `Could not split "${match}" into two teams (expected "Home vs Away")` };
  }

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return { available: false, reason: 'API_FOOTBALL_KEY not set' };
  }

  const season = defaultSeason();
  let result;
  try {
    result = await fetchLeagueForm(sport, season, apiKey);
  } catch (err) {
    return { available: false, reason: 'team-form fetch failed: ' + err.message };
  }

  const homeKey = normaliseTeamName(teams.home);
  const awayKey = normaliseTeamName(teams.away);
  const homeRecords = result.matches[homeKey];
  const awayRecords = result.matches[awayKey];

  if (!homeRecords && !awayRecords) {
    return { available: false, reason: `Neither "${teams.home}" nor "${teams.away}" matched this season's fixtures (name mismatch or too early in season)` };
  }

  return {
    available: true,
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
    fixturesUsed: result.meta.fixturesUsed,
  };
}

// Code-computed, not LLM-guessed. Reflects how much real data actually
// backed the analysis, so the confidence number can't outrun the sample it's
// built on (see: badges claiming "100%" off 2-3 games).
function assessDataQuality(realData) {
  if (!realData.available) return { level: 'None', note: realData.reason };
  const homeSample = realData.home.goals?.sample || 0;
  const awaySample = realData.away.goals?.sample || 0;
  const hasH2H = !!realData.h2h;
  if (homeSample >= 8 && awaySample >= 8 && hasH2H) return { level: 'High', note: `${realData.fixturesUsed} fixtures this season, H2H found` };
  if (homeSample >= 5 && awaySample >= 5) return { level: 'Medium', note: `${realData.fixturesUsed} fixtures this season, ${hasH2H ? 'H2H found' : 'no H2H this season'}` };
  return { level: 'Low', note: 'Small sample this season — treat form/rate numbers as indicative, not predictive' };
}

function describeRealData(realData) {
  if (!realData.available) {
    return `No real results data available for this match (${realData.reason}). Base your analysis ONLY on the odds/market data below — do not state or imply anything about team form, goals, or head-to-head.`;
  }
  const g = (label, goals) => goals ? `${label} goals (last ${goals.sample}): scored ${goals.scored}/game, conceded ${goals.conceded}/game` : `${label} goals: no data`;
  const rate = (label, r) => r ? `${label}: ${r.hits}/${r.sample}` : `${label}: no data`;

  return `
${realData.homeTeam} — this season, verified results:
- Recent form (oldest to most recent): ${realData.home.form || 'no data'}
- ${g('Overall', realData.home.goals)}
- Home record: ${realData.home.homeSplit?.record || 'no data'}${realData.home.homeSplit ? `, scoring ${realData.home.homeSplit.scored}/conceding ${realData.home.homeSplit.conceded} at home` : ''}
- ${rate('Over 2.5 goals rate', realData.home.over25)}
- ${rate('Both teams scored rate', realData.home.btts)}

${realData.awayTeam} — this season, verified results:
- Recent form (oldest to most recent): ${realData.away.form || 'no data'}
- ${g('Overall', realData.away.goals)}
- Away record: ${realData.away.awaySplit?.record || 'no data'}${realData.away.awaySplit ? `, scoring ${realData.away.awaySplit.scored}/conceding ${realData.away.awaySplit.conceded} away` : ''}
- ${rate('Over 2.5 goals rate', realData.away.over25)}
- ${rate('Both teams scored rate', realData.away.btts)}

Head-to-head this season: ${realData.h2h ? realData.h2h.join('; ') : 'no meetings yet this season'}

IMPORTANT: The numbers above are the ONLY facts you have about these teams. Do not mention player injuries, suspensions, transfers, managerial changes, or any other news — you have no live source for that, and guessing has previously produced wrong, outdated answers (e.g. naming a player as injured after he had already transferred out). If a rate above is based on a small sample (under 5 games), say so plainly rather than stating it with confidence.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { match, sport, outcomes, margin, marketType } = req.body;

  if (!match || typeof match !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "match"' });
  }
  if (!sport || typeof sport !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "sport"' });
  }
  if (!Array.isArray(outcomes) || outcomes.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid "outcomes" — expected a non-empty array' });
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return res.status(429).json({
      error: `Too many analysis requests. Please wait ${rl.retryAfterSeconds}s and try again.`,
      retryAfterSeconds: rl.retryAfterSeconds,
    });
  }

  const cacheKey = analysisCacheKey(match, sport, marketType, outcomes);
  const cached = analysisCache[cacheKey];
  if (cached && Date.now() - cached.ts < ANALYSIS_CACHE_TTL) {
    console.log('[analyze] serving', match, 'from cache, age:', Math.round((Date.now() - cached.ts) / 1000) + 's');
    return res.status(200).json(cached.data);
  }

  const realData = await buildRealMatchData(sport, match);
  const dataQuality = assessDataQuality(realData);

  const prompt = `You are a sports betting analyst writing for West African bettors. You are given REAL verified data below (or told plainly when none exists) — you must reason only from it, never from your own general knowledge of these teams, players, or recent news.

Match: ${match}
Sport: ${sport}
Market: ${marketType || 'Match Winner'}
${margin > 0 ? 'Arbitrage margin: ' + margin + '%' : ''}
Odds:
${outcomes.map(o => `- ${o.label}: ${o.odds} on ${o.bookName}`).join('\n')}

${describeRealData(realData)}

Data quality for this match: ${dataQuality.level} (${dataQuality.note})

Respond ONLY with this exact JSON, no markdown, no extra text:
{
  "predictedOutcome": "most likely result based on the data above",
  "confidence": 65,
  "valueLeg": "best value bet given the odds and data above",
  "riskLevel": "Low",
  "form": { "home": "as given above, or null if no data", "away": "as given above, or null if no data" },
  "goalsAvg": { "homeScoredPer90": 1.8, "homeConceededPer90": 0.9, "awayScoredPer90": 1.2, "awayConceededPer90": 1.4 },
  "h2h": "summarise the head-to-head data given above, or state plainly if none exists",
  "keyInsight": "one sentence, grounded only in the data provided",
  "additionalBets": [
    { "market": "Over 2.5 Goals", "recommendation": "Yes or No", "confidence": 60, "reasoning": "cite the Over 2.5 rate given above" },
    { "market": "Both Teams to Score", "recommendation": "Yes or No", "confidence": 60, "reasoning": "cite the BTTS rate given above" }
  ],
  "tip": "one actionable sentence for the bettor",
  "reasoning": "2 sentences explaining your read, citing only the data given above — if data quality is Low or None, say so and hedge accordingly"
}`;

  try {
    const apiKey = process.env.GROQ_API_KEY;
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 1200,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Groq API error' });
    }

    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // dataQuality is computed in code, not by the model — attached
    // separately so it can't be softened or exaggerated by the LLM.
    parsed.dataQuality = dataQuality;

    analysisCache[cacheKey] = { data: parsed, ts: Date.now() };

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
}
