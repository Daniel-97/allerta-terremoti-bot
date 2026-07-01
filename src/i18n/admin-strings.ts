export const ADMIN = {
  broadcast: {
    empty: "❌ Message cannot be empty.",
    tooLong: (len: number) => `❌ Message too long (${len} chars). Max 4096.`,
    sent: (sent: number, total: number) =>
      `📨 Broadcast sent to ${sent}/${total} active users.`,
  },
  stats: {
    title: "📊 *Bot Statistics*",
    users: (total: number, active: number, stopped: number, blocked: number, deleted: number) =>
      `👤 *Users*\n` +
      `Total: ${total}\n` +
      `Active: ${active}\n` +
      `Stopped: ${stopped}\n` +
      `Blocked: ${blocked}\n` +
      `Deleted: ${deleted}`,
    locations: (count: number) => `📍 Total locations: ${count}`,
    lastEvent: (id: string | null, zone: string | null, mag: number | null, date: string | null) =>
      id
        ? `📅 Last event: *${mag != null ? `M${mag.toFixed(1)}` : "?"}* — ${zone} (${date})  \`${id}\``
        : "📅 No events yet.",
    lastPoll: (ts: string | null) => `🔄 Last successful poll: ${ts ?? "never"}`,
  },
  events: {
    title: "📋 *Recent Events*",
    none: "No events found.",
    line: (id: string, mag: number, zone: string, date: string) =>
      `• *M${mag.toFixed(1)}* — ${zone}  \`${id}\`  _${date}_`,
  },
  delivery: {
    usage: "Usage: `/delivery <event_id>`",
    notFound: (id: string) => `❌ No deliveries found for event \`${id}\`.`,
    title: (id: string) => `📬 *Delivery status — ${id}*`,
    line: (chat: number, status: string, attempts: number) =>
      `• \`${chat}\`: ${status} (attempts: ${attempts})`,
    summary: (total: number, sent: number, transient: number, permanent: number, pending: number) =>
      `\nTotal: ${total} | ✅ ${sent} | ⏳ ${pending} | ⚠️ ${transient} | ❌ ${permanent}`,
  },
  health: {
    title: "🏥 *System Health*",
    ok: "✅",
    fail: "❌",
    line: (service: string, ok: boolean, detail: string) =>
      `${ok ? "✅" : "❌"} *${service}*: ${detail}`,
  },
  help: {
    body:
      "🛠 *Admin Commands*\n\n" +
      "• /broadcast <message> — Send a message to all active users\n" +
      "• /stats — View bot statistics\n" +
      "• /events — View recent events\n" +
      "• /delivery <event-id> — Check delivery status\n" +
      "• /health — Check system health",
  },
} as const;
