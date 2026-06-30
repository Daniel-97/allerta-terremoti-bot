import { Bot } from "grammy";
import type { AppConfig } from "../config";
import type { Db } from "../db/types";
import { touchChat, upsertActiveChat } from "../db/repositories/chats";
import { STRINGS } from "../i18n/strings";

export function createBot(config: AppConfig, db: Db): Bot {
  const bot = new Bot(config.BOT_TOKEN);

  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private") return;
    if (ctx.from) {
      await touchChat(db, {
        id: ctx.chat.id,
        first_name: ctx.from.first_name ?? null,
        last_name: ctx.from.last_name ?? null,
        username: ctx.from.username ?? null,
      });
    }
    return next();
  });

  bot.command("start", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    const from = ctx.from;
    await upsertActiveChat(db, {
      id: ctx.chat.id,
      first_name: from?.first_name ?? null,
      last_name: from?.last_name ?? null,
      username: from?.username ?? null,
    });
    await ctx.reply(STRINGS.start.welcome);
  });

  return bot;
}
