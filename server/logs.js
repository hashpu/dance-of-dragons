// Posts an audit-trail message to the "logs" Discord channel (WEBHOOK_LOGS)
// for admin/Lord actions on a house. Fire-and-forget — a missing or failing
// webhook never blocks the action being logged.
async function postLog(title, description, color = 0x5865f2) {
  const webhookUrl = process.env.WEBHOOK_LOGS;
  if (!webhookUrl) return;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{ title, description, color, timestamp: new Date().toISOString() }]
      })
    });
    if (!res.ok) console.warn("Logs webhook responded " + res.status);
  } catch (e) {
    console.warn("Logs webhook failed:", e.message);
  }
}

module.exports = { postLog };
