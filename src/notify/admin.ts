import { createLogger } from "@/util/log";
import { captureWarning } from "@/util/error-handler";
import type { Bot } from "grammy";

const log = createLogger("admin");

function formatTime(): string {
  return new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
}

export async function notifyNewUser(
  bot: Bot,
  adminChatIds: number[],
  chatRef: { id: number; first_name?: string | null; last_name?: string | null; username?: string | null },
): Promise<void> {
  for (const id of adminChatIds) {
    try {
      const name = [chatRef.first_name, chatRef.last_name].filter(Boolean).join(" ") || "?";
      const user = chatRef.username ? `@${chatRef.username}` : "no username";
      await bot.api.sendMessage(
        id,
        `🆕 *New user*\nID: \`${chatRef.id}\`\nName: ${name}\nUser: ${user}\nTime: ${formatTime()}`,
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      captureWarning(log, err, { adminChatId: id, action: "new-user notification" });
    }
  }
}

export async function notifyUserStop(
  bot: Bot,
  adminChatIds: number[],
  chatId: number,
): Promise<void> {
  for (const id of adminChatIds) {
    try {
      await bot.api.sendMessage(
        id,
        `🚫 *User left*\nID: \`${chatId}\`\nTime: ${formatTime()}`,
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      captureWarning(log, err, { adminChatId: id, action: "user-stop notification" });
    }
  }
}
