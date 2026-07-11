import { InputFile } from "grammy";
import { createLogger } from "@/util/log";
import { captureError, captureWarning } from "@/util/error-handler";
import { classifyTelegramError } from "@/notify/errors";
import { insertIfNew as insertDelivery, updateStatus, getDelivery } from "@/db/repositories/deliveries";
import { setChatStatus } from "@/db/repositories/chats";
import { composeMessage } from "@/notify/compose";
import { generateEarthquakeImage } from "@/rendering/map-renderer";
import { getBaseImage } from "@/rendering/images";
import { getFonts } from "@/rendering/fonts";
import type { Recipient } from "@/notify/match";
import type { ParsedEvent } from "@/services/ingv/types";
import type { Db } from "@/db/types";
import type { Bot } from "grammy";

const log = createLogger("deliver");

export interface DeliveryOutcome {
  sent: number;
  failedTransient: number;
  failedPermanent: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function deliverFirstWave(
  bot: Bot,
  event: ParsedEvent,
  recipients: Recipient[],
  db: Db,
): Promise<DeliveryOutcome> {
  const outcome: DeliveryOutcome = { sent: 0, failedTransient: 0, failedPermanent: 0 };

  for (const rec of recipients) {
    // Idempotency check
    const existing = await getDelivery(db, event.eventId, rec.chatId);
    if (existing && existing.status === "sent") continue;

    const { text, keyboard } = await composeMessage(event, rec, db);

    // Register delivery (idempotent)
    const isNew = await insertDelivery(db, { event_id: event.eventId, chat: rec.chatId });

    if (!isNew && existing) {
      // Was inserted before but not sent — could be pending/transient from a previous failed run
      await updateStatus(db, existing.id, "pending", existing.attempts + 1);
    }

    const deliveryId = await getDeliveryId(db, event.eventId, rec.chatId);

    let imageBytes: Uint8Array | null = null;
    try {
      imageBytes = await generateEarthquakeImage(event, getBaseImage, getFonts);
    } catch (imgErr) {
      captureWarning(log, imgErr, { chatId: rec.chatId, eventId: event.eventId, action: "image generation fallback" });
    }

    try {
      if (imageBytes) {
        const caption = `${text}\n\n_La posizione sulla mappa è indicativa e potrebbe non essere precisa._`;
        await bot.api.sendPhoto(rec.chatId, new InputFile(imageBytes, "earthquake.png"), {
          caption,
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await bot.api.sendMessage(rec.chatId, text, {
          reply_markup: keyboard,
          parse_mode: "Markdown",
        });
      }
      if (deliveryId) await updateStatus(db, deliveryId, "sent", existing?.attempts ?? 1);
      outcome.sent++;
    } catch (err) {
      const cls = classifyTelegramError(err);
      if (cls === "permanent") {
        await setChatStatus(db, rec.chatId, "blocked");
        if (deliveryId) await updateStatus(db, deliveryId, "failed_permanent", existing?.attempts ?? 1);
        outcome.failedPermanent++;
        captureError(log, err, { chatId: rec.chatId, eventId: event.eventId, action: "delivery permanent" });
      } else {
        if (deliveryId) await updateStatus(db, deliveryId, "failed_transient", existing?.attempts ?? 1);
        outcome.failedTransient++;
        captureWarning(log, err, { chatId: rec.chatId, eventId: event.eventId, action: "delivery transient" });
      }
    }

    await sleep(33); // ~30 messages/second rate limit
  }

  return outcome;
}

async function getDeliveryId(db: Db, eventId: string, chat: number): Promise<number | null> {
  const d = await getDelivery(db, eventId, chat);
  return d?.id ?? null;
}
