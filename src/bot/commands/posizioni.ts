import type { Context } from "grammy";
import type { Logger } from "@/util/log";
import * as panels from "@/bot/inline/panels";
import { listLocations } from "@/db/repositories/locations";
import { requestLocationKeyboard } from "@/bot/location-intake";
import type { Db } from "@/db/types";

export async function handle(ctx: Context, db: Db, log: Logger): Promise<void> {
  const chatId = ctx.chat!.id;
  log.info({
    chatId,
    userId: ctx.from?.id,
    command: "/posizioni",
    outcome: "handled",
  }, "command handled");

  const locs = await listLocations(db, chatId);
  const panel = panels.renderLocationsList(locs);

  if (locs.length === 0) {
    await ctx.reply(panel.text, {
      reply_markup: requestLocationKeyboard(),
      parse_mode: "Markdown",
    });
    return;
  }

  await ctx.reply(panel.text, {
    reply_markup: panel.keyboard,
    parse_mode: "Markdown",
  });
}
