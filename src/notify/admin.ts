import { createLogger } from "@/util/log";
import { captureWarning } from "@/util/error-handler";
import { escapeHtml } from "@/util/html";
import type { Bot } from "grammy";

const log = createLogger("admin");

function formatTime(): string {
  return new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
}

export interface ChatRef {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}

export function formatNewUserMessage(chatRef: ChatRef, timestamp: string): string {
  const name = escapeHtml([chatRef.first_name, chatRef.last_name].filter(Boolean).join(" ") || "?");
  const user = chatRef.username ? `@${escapeHtml(chatRef.username)}` : "no username";
  return `🆕 <b>New user</b>\nID: <code>${chatRef.id}</code>\nName: ${name}\nUser: ${user}\nTime: ${timestamp}`;
}

export function formatUserStopMessage(chatId: number, timestamp: string): string {
  return `🚫 <b>User left</b>\nID: <code>${chatId}</code>\nTime: ${timestamp}`;
}

export async function notifyNewUser(
  bot: Bot,
  adminChatIds: number[],
  chatRef: ChatRef,
): Promise<void> {
  const message = formatNewUserMessage(chatRef, formatTime());
  for (const id of adminChatIds) {
    try {
      await bot.api.sendMessage(id, message, { parse_mode: "HTML" });
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
  const message = formatUserStopMessage(chatId, formatTime());
  for (const id of adminChatIds) {
    try {
      await bot.api.sendMessage(id, message, { parse_mode: "HTML" });
    } catch (err) {
      captureWarning(log, err, { adminChatId: id, action: "user-stop notification" });
    }
  }
}
