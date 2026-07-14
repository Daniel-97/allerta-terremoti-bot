import type { Context } from "grammy";
import type { Logger } from "@/util/log";
import * as panels from "@/bot/inline/panels";

export async function handle(ctx: Context, _db: unknown, log: Logger): Promise<void> {
  log.info(
    {
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
      command: "/aiuto",
      outcome: "handled",
    },
    "command handled",
  );
  const panel = panels.renderAiuto();
  await ctx.reply(panel.text, { reply_markup: panel.keyboard, parse_mode: "HTML" });
}
