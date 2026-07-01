import type { Context } from "grammy";
import type { Logger } from "../../util/log";
import { ADMIN } from "../../i18n/admin-strings";
import { setChatStatus } from "../../db/repositories/chats";
import type { Db } from "../../db/types";

const MAX_LENGTH = 4096;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function handle(
  ctx: Context,
  db: Db,
  log: Logger,
  args: string,
): Promise<void> {
  if (!args) {
    await ctx.reply(ADMIN.broadcast.empty);
    return;
  }
  if (args.length > MAX_LENGTH) {
    await ctx.reply(ADMIN.broadcast.tooLong(args.length));
    return;
  }

  const { chats } = await import("../../db/schema");
  const { eq } = await import("drizzle-orm");
  const activeChats = await db
    .select()
    .from(chats)
    .where(eq(chats.status, "active"));

  let sent = 0;
  for (const chat of activeChats) {
    try {
      await ctx.api.sendMessage(chat.id, args, { parse_mode: "Markdown" });
      sent++;
    } catch (err) {
      log.warn({ chatId: chat.id, err: String(err) }, "broadcast: send failed");
      await setChatStatus(db, chat.id, "blocked");
    }
    await sleep(33);
  }

  log.info({
    adminChatId: ctx.chat?.id,
    adminUsername: ctx.from?.username,
    recipientCount: activeChats.length,
    sent,
    argsLength: args.length,
  }, "broadcast completed");

  await ctx.reply(ADMIN.broadcast.sent(sent, activeChats.length));
}
