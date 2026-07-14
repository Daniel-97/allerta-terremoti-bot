import type { Context } from "grammy";
import type { Logger } from "@/util/log";
import { ADMIN } from "@/i18n/strings";

export async function handle(ctx: Context, log: Logger): Promise<void> {
  log.info(
    {
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
      command: "/help",
      outcome: "handled",
    },
    "command handled",
  );
  await ctx.reply(ADMIN.help.body, { parse_mode: "HTML" });
}
