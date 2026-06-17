export default async function handler(req, res) {
  const { sport, region, market } = req.query;
  const markets = market || 'h2h,spreads,totals';

  const keys = [
    process.env.ODDS_API_KEY,
    process.env.ODDS_API_KEY_2,
    process.env.ODDS_API_KEY_3,
  ].filter(Boolean);

  console.log('[odds] keys loaded:', keys.map((k, i) => `KEY_${i+1}=${k ? k.slice(0,8)+'...' : 'MISSING'}`));

  let lastError = null;

  for (const key of keys) {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${key}&regions=${region}&markets=${markets}&oddsFormat=decimal`;
    try {
      const response = await fetch(url);
      console.log(`[odds] key ${keys.indexOf(key)+1} → status ${response.status}`);
      if (response.status === 429) {
        lastError = 'quota';
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        // this specific key is invalid/deactivated — try the next one instead of failing outright
        let body = null;
        try { body = await response.json(); } catch {}
        lastError = (body && (body.message || body.error_code)) || `key error (${response.status})`;
        console.log(`[odds] key ${keys.indexOf(key)+1} error body:`, lastError);
        continue;
      }
      if (!response.ok) {
        lastError = response.status;
        continue;
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

  console.log('[odds] all keys failed, lastError:', lastError);
  res.status(429).json({ error: 'All API keys exhausted. ' + lastError });
}
