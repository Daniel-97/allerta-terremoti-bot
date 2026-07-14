import type { Context } from "grammy";
import type { Logger } from "@/util/log";
import { STRINGS } from "@/i18n/strings";
import * as panels from "@/bot/inline/panels";
import { getChat } from "@/db/repositories/chats";
import type { Db } from "@/db/types";

export async function handle(ctx: Context, db: Db, log: Logger): Promise<void> {
  const chatId = ctx.chat!.id;
  log.info(
    {
      chatId,
      userId: ctx.from?.id,
      command: "/impostazioni",
      outcome: "handled",
    },
    "command handled",
  );

  const chat = await getChat(db, chatId);
  if (!chat) {
    await ctx.reply(STRINGS.errors.generic);
    return;
  }
  const panel = panels.renderSettings(chat.italy_alerts, chat.world_alerts);
  await ctx.reply(panel.text, {
    reply_markup: panel.keyboard,
    parse_mode: "HTML",
  });
}
