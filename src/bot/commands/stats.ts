import type { Context } from "grammy";
import type { Logger } from "@/util/log";
import { ADMIN } from "@/i18n/strings";
import { sql } from "drizzle-orm";
import type { Db } from "@/db/types";

export async function handle(ctx: Context, db: Db, log: Logger): Promise<void> {
  log.info({ chatId: ctx.chat?.id, command: "/stats", outcome: "handled" }, "command handled");

  const { chats, history, locations, systemState } = await import("../../db/schema");

  const userRows = await db
    .select({ status: chats.status, count: sql<number>`count(*)` })
    .from(chats)
    .groupBy(chats.status);

  const userCounts: Record<string, number> = {};
  for (const r of userRows) userCounts[r.status] = r.count;

  const total = userRows.reduce((s, r) => s + r.count, 0);
  const active = userCounts["active"] ?? 0;
  const stopped = userCounts["stopped"] ?? 0;
  const blocked = userCounts["blocked"] ?? 0;
  const deleted = userCounts["deleted"] ?? 0;

  const locRows = await db.select({ c: sql<number>`count(*)` }).from(locations);
  const locationsCount = locRows[0]!.c;

  const lastEventRow = await db
    .select({
      id: history.id,
      zone: history.zone,
      mag: history.magnitude_value,
      date: history.date,
    })
    .from(history)
    .orderBy(sql`${history.date} desc`)
    .limit(1);

  const lastEvent = lastEventRow[0] ?? null;

  const pollRow = await db
    .select({ value: systemState.value })
    .from(systemState)
    .where(sql`${systemState.key} = 'last_successful_sync_at'`)
    .limit(1);

  const lines = [
    ADMIN.stats.users(total, active, stopped, blocked, deleted),
    ADMIN.stats.locations(locationsCount),
    ADMIN.stats.lastEvent(
      lastEvent?.id ?? null,
      lastEvent?.zone ?? null,
      lastEvent?.mag ?? null,
      lastEvent?.date ?? null,
    ),
    ADMIN.stats.lastPoll(pollRow[0]?.value ?? null),
  ];

  await ctx.reply(lines.join("\n\n"), { parse_mode: "HTML" });
}
