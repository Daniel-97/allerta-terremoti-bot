import type { Context } from "grammy";
import type { Logger } from "../../util/log";
import { STRINGS } from "../../i18n/strings";
import { setChatStatus } from "../../db/repositories/chats";
import type { Db } from "../../db/types";

export async function handle(ctx: Context, db: Db, log: Logger): Promise<void> {
  const chatId = ctx.chat!.id;
  await setChatStatus(db, chatId, "stopped");
  log.info({
    chatId,
    userId: ctx.from?.id,
    first_name: ctx.from?.first_name,
    command: "/stop",
    outcome: "deactivated",
  }, "command handled");
  log.warn({ chatId }, "TODO M4: notify admin of /stop");
  await ctx.reply(STRINGS.stop.done);
}
