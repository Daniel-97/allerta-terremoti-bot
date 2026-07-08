import type { Context } from "grammy";
import type { Logger } from "@/util/log";
import { STRINGS } from "@/i18n/strings";

export async function handle(ctx: Context, _db: unknown, log: Logger): Promise<void> {
  log.info({
    chatId: ctx.chat?.id,
    userId: ctx.from?.id,
    command: "/credits",
    outcome: "handled",
  }, "command handled");
  await ctx.reply(STRINGS.credits.body, {
    parse_mode: "Markdown",
    link_preview_options: { is_disabled: true },
  });
}
