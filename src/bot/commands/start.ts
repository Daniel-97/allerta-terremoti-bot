import type { Context } from "grammy";
import type { Logger } from "@/util/log";
import type { Db } from "@/db/types";
import { STRINGS } from "@/i18n/strings";
import { setChatStatus } from "@/db/repositories/chats";

export async function handle(
  ctx: Context,
  db: Db,
  log: Logger,
  config: { italyAlertThreshold: number; worldAlertThreshold: number },
): Promise<void> {
  const chatId = ctx.chat!.id;
  await setChatStatus(db, chatId, "active");
  log.info({
    chatId,
    userId: ctx.from?.id,
    first_name: ctx.from?.first_name,
    command: "/start",
    outcome: "handled",
  }, "command handled");
  await ctx.reply(
    STRINGS.start.welcome(config.italyAlertThreshold, config.worldAlertThreshold),
    { parse_mode: "Markdown" },
  );
}
