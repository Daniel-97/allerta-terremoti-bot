import { Bot } from "grammy";
import type { AppConfig } from "../config";
import { STRINGS } from "../i18n/strings";

export function createBot(config: AppConfig): Bot {
  const bot = new Bot(config.BOT_TOKEN);

  bot.command("start", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    await ctx.reply(STRINGS.start.welcome);
  });

  return bot;
}
