export default async function handler(req, res) {
  const { sport, region, market } = req.query;
  const markets = market || 'h2h,spreads,totals';
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=${region}&markets=${markets}&oddsFormat=decimal`;

  try {
    const response = await fetch(url);
    const remainingRequests = response.headers.get('x-requests-remaining');
    const usedRequests = response.headers.get('x-requests-used');
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Odds API error' });
    }
    const data = await response.json();
    res.status(200).json({ data, remainingRequests, usedRequests });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}
