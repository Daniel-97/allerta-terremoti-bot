import { Bot } from "grammy";
import type { AppConfig } from "../config";
import type { Db } from "../db/types";
import { touchChat } from "../db/repositories/chats";
import { createLogger } from "../util/log";
import { handleCallbackQuery } from "./inline/router";
import { handleLocation } from "./location-intake";
import * as start from "./commands/start";
import * as aiuto from "./commands/aiuto";
import * as posizioni from "./commands/posizioni";
import * as impostazioni from "./commands/impostazioni";
import * as stopCmd from "./commands/stop";
import * as credits from "./commands/credits";
import { STRINGS } from "../i18n/strings";

const log = createLogger("bot");

export function createBot(config: AppConfig, db: Db): Bot {
  const bot = new Bot(config.BOT_TOKEN);

  // private-only middleware + touch on every private message
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
    }
    return next();
  });

  // slash commands
  bot.command("start", (ctx) => start.handle(ctx, db, log));
  bot.command("aiuto", (ctx) => aiuto.handle(ctx, db, log));
  bot.command("posizioni", (ctx) => posizioni.handle(ctx, db, log));
  bot.command("impostazioni", (ctx) => impostazioni.handle(ctx, db, log));
  bot.command("stop", (ctx) => stopCmd.handle(ctx, db, log));
  bot.command("credits", (ctx) => credits.handle(ctx, db, log));

  // callback queries (inline button presses)
  bot.on("callback_query:data", (ctx) => handleCallbackQuery(ctx, db));

  // location / venue messages
  bot.on("message:location", (ctx) => handleLocation(ctx, db, config));
  bot.on("message:venue", (ctx) => handleLocation(ctx, db, config));

  // unrecognized text messages
  bot.on("message:text", async (ctx) => {
    log.info(
      {
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
        text: ctx.message?.text,
      },
      "unrecognized text",
    );
    await ctx.reply(STRINGS.unknownCommand.hint);
  });

  return bot;
}
