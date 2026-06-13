export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { match, sport, outcomes, margin, marketType } = req.body;

  const prompt = `You are a sports betting analyst for West African bettors (mainly Ghana). Analyze this betting opportunity:

Match: ${match}
Sport: ${sport}
Market: ${marketType || 'Match Winner'}
Arbitrage margin: ${margin}%
Odds breakdown:
${outcomes.map(o => `- ${o.label}: ${o.odds} on ${o.bookName}`).join('\n')}

Provide a brief analysis in this exact JSON format:
{
  "predictedOutcome": "most likely result in 5 words or less",
  "confidence": 65,
  "valueLeg": "which outcome has best value e.g. Arsenal Win",
  "riskLevel": "Low",
  "tip": "one actionable sentence for the bettor",
  "reasoning": "2 sentences explaining your analysis"
}

Only respond with the JSON. No extra text. No markdown.`;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + process.env.GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(clean);
    res.status(200).json(analysis);
  } catch (err) {
    res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
}
