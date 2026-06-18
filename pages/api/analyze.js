export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { match, sport, outcomes, margin, marketType, includeNews } = req.body;

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
        model: 'llama-3.3-70b-versatile',
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
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
}
