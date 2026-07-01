import type { Context } from "grammy";
import type { Logger } from "../../util/log";
import { ADMIN } from "../../i18n/admin-strings";
import { listByEvent } from "../../db/repositories/deliveries";
import type { Db } from "../../db/types";

export async function handle(
  ctx: Context,
  db: Db,
  log: Logger,
  args: string,
): Promise<void> {
  log.info({ chatId: ctx.chat?.id, command: "/delivery", outcome: "handled" }, "command handled");

  const eventId = args.trim();
  if (!eventId) {
    await ctx.reply(ADMIN.delivery.usage, { parse_mode: "Markdown" });
    return;
  }

  const rows = await listByEvent(db, eventId);
  if (rows.length === 0) {
    await ctx.reply(ADMIN.delivery.notFound(eventId), { parse_mode: "Markdown" });
    return;
  }

  const lines = rows.map((r) => ADMIN.delivery.line(r.chat, r.status, r.attempts));

  const total = rows.length;
  const sent = rows.filter((r) => r.status === "sent").length;
  const transient = rows.filter((r) => r.status === "failed_transient").length;
  const permanent = rows.filter((r) => r.status === "failed_permanent").length;
  const pending = rows.filter((r) => r.status === "pending").length;

  lines.push(ADMIN.delivery.summary(total, sent, transient, permanent, pending));

  const header = ADMIN.delivery.title(eventId);
  await ctx.reply([header, ...lines].join("\n"), { parse_mode: "Markdown" });
}
