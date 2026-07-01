import type { Context } from "grammy";
import type { Logger } from "../../util/log";
import { ADMIN } from "../../i18n/admin-strings";
import { sql } from "drizzle-orm";
import type { Db } from "../../db/types";

export async function handle(
  ctx: Context,
  db: Db,
  log: Logger,
): Promise<void> {
  log.info({ chatId: ctx.chat?.id, command: "/events", outcome: "handled" }, "command handled");

  const { history } = await import("../../db/schema");

  const rows = await db
    .select({ id: history.id, mag: history.magnitude_value, zone: history.zone, date: history.date })
    .from(history)
    .orderBy(sql`${history.date} desc`)
    .limit(10);

  if (rows.length === 0) {
    await ctx.reply(ADMIN.events.none);
    return;
  }

  const lines = rows.map((r) =>
    ADMIN.events.line(r.id, r.mag, r.zone, r.date.slice(0, 19).replace("T", " ")),
  );

  await ctx.reply([ADMIN.events.title, ...lines].join("\n"), { parse_mode: "Markdown" });
}
