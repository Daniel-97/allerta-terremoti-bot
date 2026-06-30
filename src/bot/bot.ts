import { Bot } from "grammy";
import type { AppConfig } from "../config";
import type { Db } from "../db/types";
import { touchChat, upsertActiveChat } from "../db/repositories/chats";
import { STRINGS } from "../i18n/strings";
import { createLogger } from "../util/log";

const log = createLogger("bot");

export function createBot(config: AppConfig, db: Db): Bot {
  const bot = new Bot(config.BOT_TOKEN);

  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private") {
      log.info(
        { chatId: ctx.chat?.id, type: ctx.chat?.type },
        "ignored: non-private chat",
      );
      return;
    }
    if (ctx.from) {
      await touchChat(db, {
        id: ctx.chat!.id,
        first_name: ctx.from.first_name ?? null,
        last_name: ctx.from.last_name ?? null,
        username: ctx.from.username ?? null,
      });
      log.info(
        {
          chatId: ctx.chat!.id,
          userId: ctx.from.id,
          first_name: ctx.from.first_name,
          username: ctx.from.username,
        },
        "chat touched",
      );
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
    log.info(
      {
        chatId: ctx.chat.id,
        userId: from?.id,
        first_name: from?.first_name,
        username: from?.username,
        command: "/start",
        outcome: "reactivated",
      },
      "command handled",
    );
    await ctx.reply(STRINGS.start.welcome);
  });

  return bot;
}
