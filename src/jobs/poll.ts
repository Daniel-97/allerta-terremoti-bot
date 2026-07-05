import { createLogger } from "@/util/log";
import { fetchItalyEvents, fetchWorldEvents } from "@/services/ingv/client";
import { insertIfNew as insertHistory } from "@/db/repositories/history";
import { setState } from "@/db/repositories/system-state";
import { findRecipients } from "@/notify/match";
import { deliverFirstWave } from "@/notify/deliver";
import { notifyEventSummary } from "@/notify/admin";
import type { Db } from "@/db/types";
import type { Bot } from "grammy";

const log = createLogger("poll");

export async function runMainCron(
  config: { HEALTHCHECKS_URL: string | undefined; adminChatIds: number[]; italyAlertThreshold: number; worldAlertThreshold: number; lookbackWindowMin: number },
  db: Db,
  bot: Bot,
): Promise<void> {
  // 1. Dead-man's-switch ping (fire-and-forget)
  if (config.HEALTHCHECKS_URL) {
    void fetch(config.HEALTHCHECKS_URL, { method: "GET" }).catch(() => {});
  }

  // 2. Fetch INGV
  const allEvents: ParsedEventFromClient[] = [];
  try {
    const [italy, world] = await Promise.all([
      fetchItalyEvents(config.lookbackWindowMin),
      fetchWorldEvents(config.lookbackWindowMin),
    ]);
    allEvents.push(...italy, ...world);
    if (allEvents.length > 0) {
      log.info({ italy: italy.length, world: world.length, total: allEvents.length }, "events fetched");
    }
  } catch (err) {
    log.error({ err: String(err) }, "ingv fetch failed");
    return;
  }

  // 3. Process each event
  for (const event of allEvents) {
    const isNew = await insertHistory(db, {
      id: event.eventId,
      zone: event.zone,
      date: event.time,
      lat: event.lat,
      lon: event.lon,
      depth: event.depth,
      stations_count: null,
      magnitude_type: event.magType ?? null,
      magnitude_value: event.magnitude,
      magnitude_uncertainty: null,
    });

    if (!isNew) continue; // already processed

    // 4. Match + deliver
    const recipients = await findRecipients(event, db, config.italyAlertThreshold, config.worldAlertThreshold);
    if (recipients.length > 0) {
      const outcome = await deliverFirstWave(bot, event, recipients, db);
      log.info({
        eventId: event.eventId,
        recipients: recipients.length,
        sent: outcome.sent,
        failedTransient: outcome.failedTransient,
        failedPermanent: outcome.failedPermanent,
      }, "delivery wave completed");
      await notifyEventSummary(bot, config.adminChatIds, event, recipients.length, outcome);
    }
  }

  // 5. Update system_state
  await setState(db, "last_successful_sync_at", new Date().toISOString());
}

type ParsedEventFromClient = Awaited<ReturnType<typeof fetchItalyEvents>>[number];
