// ─── RATE LIMITING (in-memory, per-IP, 5 requests / 10 min) ─────────────────
// This endpoint has real per-call cost (a Groq inference every hit) and,
// unlike /api/odds, had NO protection at all before this — anyone with the
// URL could script a loop and burn quota fast. Same best-effort caveat as
// odds.js's caches: resets on cold start, not shared across serverless
// instances, but stops casual/scripted abuse from a single source.
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
// Multiple bettors often ask about the same headline match around the same
// time (e.g. everyone looking at Arsenal vs Chelsea right after kickoff
// announcements). Without this, that's N separate Groq calls for identical
// output. With it, they share one.
const analysisCache = {};
const ANALYSIS_CACHE_TTL = 15 * 60 * 1000;

function analysisCacheKey(match, sport, marketType, outcomes) {
  const oddsKey = (outcomes || [])
    .map(o => `${o.label}:${o.odds}:${o.bookName}`)
    .sort()
    .join('|');
  return `${match}::${sport}::${marketType}::${oddsKey}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { match, sport, outcomes, margin, marketType, includeNews } = req.body;

  // ── Basic input validation — previously a missing/malformed body threw an
  // unhandled exception (500) instead of a clean error ──────────────────────
  if (!match || typeof match !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "match"' });
  }
  if (!sport || typeof sport !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "sport"' });
  }
  if (!Array.isArray(outcomes) || outcomes.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid "outcomes" — expected a non-empty array' });
  }

  // ── Rate limit ──────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return res.status(429).json({
      error: `Too many analysis requests. Please wait ${rl.retryAfterSeconds}s and try again.`,
      retryAfterSeconds: rl.retryAfterSeconds,
    });
  }

  // ── Cache check ─────────────────────────────────────────────────────────
  const cacheKey = analysisCacheKey(match, sport, marketType, outcomes);
  const cached = analysisCache[cacheKey];
  if (cached && Date.now() - cached.ts < ANALYSIS_CACHE_TTL) {
    console.log('[analyze] serving', match, 'from cache, age:', Math.round((Date.now() - cached.ts) / 1000) + 's');
    return res.status(200).json(cached.data);
  }

  const prompt = `You are an expert sports analyst with deep knowledge of team statistics, current form, and recent news. Analyze this match for West African bettors.

Match: ${match}
Sport: ${sport}
Market: ${marketType || 'Match Winner'}
${margin > 0 ? 'Arbitrage margin: ' + margin + '%' : ''}
Odds:
${outcomes.map(o => `- ${o.label}: ${o.odds} on ${o.bookName}`).join('\n')}

Provide a comprehensive analysis including:
1. Recent form (last 5 games) for each team — W/D/L results
2. Goals scored and conceded per 90 minutes
3. Head to head record (last 5 meetings)
4. Key injuries, suspensions, or unavailable players (especially star players)
5. Current news affecting this match (managerial changes, morale, fixture congestion)
6. Home/away performance context
7. Betting recommendations across multiple markets

Respond ONLY with this exact JSON, no markdown, no extra text:
{
  "predictedOutcome": "most likely result e.g. Arsenal Win",
  "confidence": 65,
  "valueLeg": "best value bet e.g. Arsenal Win",
  "riskLevel": "Low",
  "form": {
    "home": "W W D L W",
    "away": "L W W D L"
  },
  "goalsAvg": {
    "homeScoredPer90": 1.8,
    "homeConceededPer90": 0.9,
    "awayScoredPer90": 1.2,
    "awayConceededPer90": 1.4
  },
  "h2h": "Arsenal won 3 of last 5 meetings. Avg 2.4 goals per game.",
  "playerNews": "Saka is doubtful with a hamstring issue. Chelsea missing Reece James (long-term injury).",
  "keyInsight": "Arsenal are unbeaten in 8 home games. Chelsea have lost 3 of their last 4 away fixtures.",
  "additionalBets": [
    { "market": "Over 2.5 Goals", "recommendation": "Yes", "confidence": 72, "reasoning": "Both teams average over 1.5 goals per game" },
    { "market": "Both Teams to Score", "recommendation": "Yes", "confidence": 68, "reasoning": "Chelsea scored in 4 of last 5 away games" },
    { "market": "Correct Score", "recommendation": "2-1", "confidence": 18, "reasoning": "Most common scoreline in H2H" },
    { "market": "Asian Handicap", "recommendation": "Arsenal -0.5", "confidence": 62, "reasoning": "Arsenal win rate at home is 70% this season" }
  ],
  "tip": "One actionable sentence for the bettor.",
  "reasoning": "2 sentences explaining your overall analysis based on form, news and H2H."
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

    analysisCache[cacheKey] = { data: parsed, ts: Date.now() };

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
}
