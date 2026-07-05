import { InputFile } from "grammy";
import { createLogger } from "../util/log";
import { listPendingForRetry, updateStatus } from "../db/repositories/deliveries";
import { getEvent } from "../db/repositories/history";
import { setChatStatus } from "../db/repositories/chats";
import { composeMessage } from "../notify/compose";
import { matchChat } from "../notify/match";
import { classifyTelegramError } from "../notify/errors";
import { generateEarthquakeImage } from "../map-renderer";
import { getBaseImage } from "../images";
import { getFonts } from "../fonts";
import type { Db } from "../db/types";
import type { Bot } from "grammy";

const log = createLogger("retry");

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runRetryCron(
  config: { maxAttempts: number; italyAlertThreshold: number; worldAlertThreshold: number },
  db: Db,
  bot: Bot,
): Promise<void> {
  const start = Date.now();
  const pending = await listPendingForRetry(db, config.maxAttempts);

  if (pending.length === 0) {
    return;
  }

  let sent = 0;
  let failedTransient = 0;
  let failedPermanent = 0;
  let skipped = 0;

  for (const delivery of pending) {
    const event = await getEvent(db, delivery.event_id);
    if (!event) {
      await updateStatus(db, delivery.id, "failed_permanent", delivery.attempts + 1);
      failedPermanent++;
      continue;
    }

    const parsedEvent = {
      eventId: event.id,
      time: event.date,
      lat: event.lat,
      lon: event.lon,
      depth: event.depth,
      author: "",
      catalog: "",
      contributor: "",
      contributorId: "",
      magType: event.magnitude_type ?? "",
      magnitude: event.magnitude_value,
      magAuthor: "",
      zone: event.zone,
    };

    const recipient = await matchChat(parsedEvent, delivery.chat, db, config.italyAlertThreshold, config.worldAlertThreshold);
    if (!recipient) {
      skipped++;
      continue;
    }

    const { text, keyboard } = await composeMessage(parsedEvent, recipient, db);

    let imageBytes: Uint8Array | null = null;
    try {
      imageBytes = await generateEarthquakeImage(parsedEvent, getBaseImage, getFonts);
    } catch (imgErr) {
      log.warn({ chatId: delivery.chat, eventId: delivery.event_id, err: String(imgErr) }, "image generation fallback");
    }

    try {
      if (imageBytes) {
        await bot.api.sendPhoto(delivery.chat, new InputFile(imageBytes, "earthquake.png"), {
          caption: text,
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } else {
        await bot.api.sendMessage(delivery.chat, text, {
          reply_markup: keyboard,
          parse_mode: "Markdown",
        });
      }
      await updateStatus(db, delivery.id, "sent", delivery.attempts + 1);
      sent++;
    } catch (err) {
      const cls = classifyTelegramError(err);
      if (cls === "permanent") {
        await setChatStatus(db, delivery.chat, "blocked");
        await updateStatus(db, delivery.id, "failed_permanent", delivery.attempts + 1);
        failedPermanent++;
      } else {
        await updateStatus(db, delivery.id, "failed_transient", delivery.attempts + 1);
        failedTransient++;
      }
    }

    await sleep(33);
  }

  log.info({
    total: pending.length,
    sent,
    failedTransient,
    failedPermanent,
    skipped,
    durationMs: Date.now() - start,
  }, "retry cycle finished");
}
