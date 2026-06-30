import type { Context } from "grammy";
import type { Logger } from "../../util/log";
import { STRINGS } from "../../i18n/strings";

export async function handle(ctx: Context, _db: unknown, log: Logger): Promise<void> {
  log.info({
    chatId: ctx.chat?.id,
    userId: ctx.from?.id,
    first_name: ctx.from?.first_name,
    command: "/start",
    outcome: "handled",
  }, "command handled");
  await ctx.reply(STRINGS.start.welcome, { parse_mode: "Markdown" });
}
