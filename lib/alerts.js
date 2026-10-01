// ─── OWNER ALERTS (Telegram) ────────────────────────────────────────────────
// Sends a push notification to your phone via Telegram when something
// server-side needs your attention — currently: API-Football returning an
// error (suspension, quota, etc.), detected in lib/teamForm.js. Also used
// (1 Oct 2026) by sendStructuralAlert below for broader structural issues:
// all odds sources failing for a live request, an uncaught exception in a
// core route, etc. — same channel, same dedup, no second alert system.
//
// One-time setup:
//  1. On Telegram, message @BotFather, send /newbot, follow the prompts.
//     You'll get a bot token that looks like 123456789:ABC-defGhIjk...
//  2. Send your new bot any message (e.g. "hi") so it knows who you are.
//  3. Open this in a browser, with your real token in place of <TOKEN>:
//     https://api.telegram.org/bot<TOKEN>/getUpdates
//     Find "chat":{"id": ...} in the response — that number is your chat ID.
//  4. Add both to Vercel env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
// Nothing set → notifyOwner() silently does nothing. It never throws, so a
// missing/broken alert config can't break the request that triggered it.

// De-dupe: don't resend the same alert key inside COOLDOWN_MS.
// NOTE: this map is in-memory per serverless instance — a cold start clears
// it, so under real traffic you might occasionally get a duplicate alert
// sooner than an hour apart. That's a minor annoyance, not a bug worth
// fixing with a database table for what should be a rare event; better to
// risk an extra ping than silently miss a real suspension again.
const lastSent = {};
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export async function notifyOwner(key, message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // not configured yet — no-op

  const now = Date.now();
  if (lastSent[key] && now - lastSent[key] < COOLDOWN_MS) return;

  // Never let a slow Telegram call hold up the request that triggered the alert.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
      signal: ctrl.signal,
    });
    // Start the cooldown only once Telegram accepted the message; a failed send
    // shouldn't silence the same alert for an hour.
    if (r.ok) lastSent[key] = now;
    else console.log('[alerts] telegram rejected message:', r.status);
  } catch (err) {
    console.log('[alerts] failed to notify owner:', err.message);
  } finally {
    clearTimeout(timer);
  }
}

// ─── STRUCTURAL ALERTS ───────────────────────────────────────────────────────
// Thin wrapper over notifyOwner for structural/infra issues (distinct from
// the hourly per-bookmaker health-check): the shared cache being unreachable,
// every odds source failing at once for a live user, or an uncaught
// exception in a core route. Reuses the same Telegram channel and the same
// per-key hourly cooldown as everything else in this file — title doubles as
// the dedup key, so e.g. "All odds sources down" only re-pings once an hour
// even if it keeps happening on every request in between.
export async function sendStructuralAlert(title, details) {
  const message = `🚨 ${title}\n${String(details).slice(0, 1500)}`;
  await notifyOwner(title, message);
}
