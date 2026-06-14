const prompt = `You are an expert sports analyst with deep knowledge of team statistics. Analyze this betting opportunity for West African bettors.

Match: ${match}
Sport: ${sport}
Market: ${marketType || 'Match Winner'}
Arbitrage margin: ${margin}%
Odds breakdown:
${outcomes.map(o => `- ${o.label}: ${o.odds} on ${o.bookName}`).join('\n')}

Using your knowledge of these teams, provide a detailed analysis including:
1. Recent form (last 5 games) for each team
2. Goals scored and conceded trends
3. Head to head record (last 5 meetings)
4. Key injuries or suspensions if known
5. Home/away performance

Then give betting recommendations beyond just the winner.

Respond ONLY with this exact JSON, no markdown, no extra text:
{
  "predictedOutcome": "most likely result e.g. Arsenal Win or Draw",
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
  "additionalBets": [
    { "market": "Over 2.5 Goals", "recommendation": "Yes", "confidence": 72, "reasoning": "Both teams average over 1.5 goals per game" },
    { "market": "Both Teams to Score", "recommendation": "Yes", "confidence": 68, "reasoning": "Chelsea scored in 4 of last 5 away games" },
    { "market": "Correct Score", "recommendation": "2-1", "confidence": 18, "reasoning": "Most common scoreline in H2H" }
  ],
  "tip": "One actionable sentence for the bettor.",
  "reasoning": "2 sentences explaining your overall analysis."
}`;
