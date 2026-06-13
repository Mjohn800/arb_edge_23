export default async function handler(req, res) {
  const { sport, region, market } = req.query;
  const markets = market || 'h2h,spreads,totals';
  
  const keys = [
    process.env.ODDS_API_KEY,
    process.env.ODDS_API_KEY_2,
    process.env.ODDS_API_KEY_3,
  ].filter(Boolean);

  let lastError = null;

  for (const key of keys) {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${key}&regions=${region}&markets=${markets}&oddsFormat=decimal`;
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        lastError = 'quota';
        continue;
      }
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Odds API error' });
      }
      const data = await response.json();
      const remainingRequests = response.headers.get('x-requests-remaining');
      const usedRequests = response.headers.get('x-requests-used');
      return res.status(200).json({ data, remainingRequests, usedRequests, keyIndex: keys.indexOf(key) + 1 });
    } catch (err) {
      lastError = err.message;
      continue;
    }
  }

  res.status(429).json({ error: 'All API keys exhausted. ' + lastError });
}
