import { Bot } from "grammy";
import type { RuntimeConfig } from "../config";
import type { Db } from "../db/types";
import { captureError } from "../util/error-handler";
import { getChat, touchChat } from "../db/repositories/chats";
import { createLogger } from "../util/log";
import { handleCallbackQuery } from "./inline/router";
import { handleLocation } from "./location-intake";
import * as start from "./commands/start";
import * as aiuto from "./commands/aiuto";
import * as posizioni from "./commands/posizioni";
import * as impostazioni from "./commands/impostazioni";
import * as stopCmd from "./commands/stop";
import * as credits from "./commands/credits";
import * as broadcast from "./commands/broadcast";
import * as stats from "./commands/stats";
import * as events from "./commands/events";
import * as delivery from "./commands/delivery";
import * as health from "./commands/health";
import * as help from "./commands/help";
import { notifyNewUser, notifyUserStop } from "../notify/admin";
import { STRINGS } from "../i18n/strings";

const log = createLogger("bot");

export function createBot(config: RuntimeConfig, db: Db): Bot {
  const bot = new Bot(config.BOT_TOKEN);

  bot.catch((error) => {
    const updateId = error.ctx?.update?.update_id;
    captureError(log, error.error, { updateId, handler: "bot.catch" });
  });

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
      const existing = await getChat(db, ctx.chat!.id);
      const isNew = !existing;
      await touchChat(db, {
        id: ctx.chat!.id,
        first_name: ctx.from.first_name ?? null,
        last_name: ctx.from.last_name ?? null,
        username: ctx.from.username ?? null,
      });
      if (isNew) {
        void notifyNewUser(bot, config.adminChatIds, {
          id: ctx.chat!.id,
          first_name: ctx.from.first_name ?? null,
          last_name: ctx.from.last_name ?? null,
          username: ctx.from.username ?? null,
        });
      }
    }
    return next();
  });

  // user slash commands
  bot.command("start", (ctx) => start.handle(ctx, db, log));
  bot.command("aiuto", (ctx) => aiuto.handle(ctx, db, log));
  bot.command("posizioni", (ctx) => posizioni.handle(ctx, db, log));
  bot.command("impostazioni", (ctx) => impostazioni.handle(ctx, db, log));
  bot.command("stop", async (ctx) => {
    await stopCmd.handle(ctx, db, log);
    void notifyUserStop(bot, config.adminChatIds, ctx.chat!.id);
  });
  bot.command("credits", (ctx) => credits.handle(ctx, db, log));

  // admin commands (gated, hidden from public menu)
  bot.command("broadcast", async (ctx) => {
    if (!ctx.chat || !config.adminChatIds.includes(ctx.chat.id)) return;
    const args = (ctx.match as string) ?? "";
    await broadcast.handle(ctx, db, log, args);
  });
  bot.command("stats", async (ctx) => {
    if (!ctx.chat || !config.adminChatIds.includes(ctx.chat.id)) return;
    await stats.handle(ctx, db, log);
  });
  bot.command("events", async (ctx) => {
    if (!ctx.chat || !config.adminChatIds.includes(ctx.chat.id)) return;
    await events.handle(ctx, db, log);
  });
  bot.command("delivery", async (ctx) => {
    if (!ctx.chat || !config.adminChatIds.includes(ctx.chat.id)) return;
    const args = (ctx.match as string) ?? "";
    await delivery.handle(ctx, db, log, args);
  });
  bot.command("health", async (ctx) => {
    if (!ctx.chat || !config.adminChatIds.includes(ctx.chat.id)) return;
    await health.handle(ctx, db, log, "", config, bot);
  });
  bot.command("help", async (ctx) => {
    if (!ctx.chat || !config.adminChatIds.includes(ctx.chat.id)) {
      await ctx.reply(STRINGS.unknownCommand.hint);
      return;
    }
    await help.handle(ctx, log);
  });

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
