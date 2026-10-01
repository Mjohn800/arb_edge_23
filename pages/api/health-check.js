import { getWAOdds } from './odds';
import { notifyOwner } from '../../lib/alerts';

// SCHEDULING NOTE: on Vercel's Hobby plan a cron may run at most once per day (an hourly schedule
// makes the deploy fail), and it fires at some point inside the scheduled hour. Each run also spends
// provider quota (every book on every sport above), so once or twice a day is plenty on free tiers.
// For more frequent checks, call this route from an external scheduler (e.g. cron-job.org) that sends
// the header  Authorization: Bearer <CRON_SECRET>.

// Sports to spot-check — one with broad global coverage, one WA-specific
// league so a WA-only outage (e.g. only OddsPapi down) still gets caught.
const CHECK_SPORTS = ['soccer_epl', 'soccer_ghana_premiership'];

export default async function handler(req, res) {
  // Vercel sets this automatically on scheduled (cron) invocations when
  // CRON_SECRET is configured — blocks anyone else from hitting this route.
  // If CRON_SECRET is not set, refuse everything. Otherwise the comparison below would accept
  // the literal header "Bearer undefined".
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const report = {};
  const failures = [];

  for (const sportKey of CHECK_SPORTS) {
    try {
      const result = await getWAOdds(sportKey);
      report[sportKey] = result.health;
      for (const [book, status] of Object.entries(result.health || {})) {
        if (status.ok === false) {
          failures.push(`${sportKey} -> ${book}: ${status.reason || 'unknown error'}`);
        }
      }
    } catch (err) {
      // A thrown error is itself a failure worth reporting, not a reason for the check to crash.
      report[sportKey] = { error: err.message };
      failures.push(`${sportKey} -> check crashed: ${err.message}`);
    }
  }

  if (failures.length > 0) {
    const message = `Health check — ${failures.length} issue(s) found\n` + failures.join('\n');
    await notifyOwner('scheduled_health_check', message);
  }

  return res.status(200).json({ checked: CHECK_SPORTS, failures: failures.length, report });
}
