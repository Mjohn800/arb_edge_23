import { getWAOdds, waHealth } from './odds';

// Sports to spot-check — one with broad global coverage, one WA-specific
// league so a WA-only outage (e.g. only OddsPapi down) still gets caught.
const CHECK_SPORTS = ['soccer_epl', 'soccer_ghana_premiership'];

async function postToDiscord(content) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) { console.warn('[health-check] DISCORD_WEBHOOK_URL not set, skipping alert'); return; }
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

export default async function handler(req, res) {
  // Vercel sets this automatically on scheduled (cron) invocations when
  // CRON_SECRET is configured — blocks anyone else from hitting this route.
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const report = {};
  const failures = [];

  for (const sportKey of CHECK_SPORTS) {
    const result = await getWAOdds(sportKey);
    report[sportKey] = result.health;
    for (const [book, status] of Object.entries(result.health)) {
      if (status.ok === false) {
        failures.push(`**${sportKey}** → \`${book}\`: ${status.reason || 'unknown error'}`);
      }
    }
  }

  if (failures.length > 0) {
    const message = `🚨 **ArbEdge health check — ${failures.length} issue(s) found**\n` + failures.join('\n');
    await postToDiscord(message);
  }

  return res.status(200).json({ checked: CHECK_SPORTS, failures: failures.length, report });
}
