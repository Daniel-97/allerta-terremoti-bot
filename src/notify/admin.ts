import { createLogger } from "../util/log";
import type { Bot } from "grammy";
import type { ParsedEvent } from "../ingv/types";
import type { DeliveryOutcome } from "./deliver";

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
      log.warn({ adminChatId: id, err: String(err) }, "new-user notification failed");
    }
  }
}

export async function notifyEventSummary(
  bot: Bot,
  adminChatIds: number[],
  event: ParsedEvent,
  recipientCount: number,
  outcome: DeliveryOutcome,
): Promise<void> {
  for (const id of adminChatIds) {
    try {
      await bot.api.sendMessage(
        id,
        `📢 *Event summary*\nM ${event.magnitude.toFixed(1)} — ${event.zone}\n\`${event.eventId}\`\nRecipients: ${recipientCount}\n✅ ${outcome.sent}  ⚠️ ${outcome.failedTransient}  ❌ ${outcome.failedPermanent}`,
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      log.warn({ adminChatId: id, err: String(err) }, "event-summary notification failed");
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
      log.warn({ adminChatId: id, err: String(err) }, "user-stop notification failed");
    }
  }
}

export async function notifyIngvFailure(
  bot: Bot,
  adminChatIds: number[],
  err: unknown,
  scope: string,
): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err);
  for (const id of adminChatIds) {
    try {
      await bot.api.sendMessage(
        id,
        `⚠️ *INGV unreachable* (${scope})\n${msg}\nTime: ${formatTime()}`,
        { parse_mode: "Markdown" },
      );
    } catch (notifyErr) {
      log.warn({ adminChatId: id, err: String(notifyErr) }, "ingv-failure notification failed");
    }
  }
}
