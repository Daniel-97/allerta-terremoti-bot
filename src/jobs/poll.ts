import { createLogger } from "../util/log";
import { inBbox, ITALY_BBOX } from "../util/geo-bbox";
import { ITALY_ALERT_THRESHOLD, WORLD_ALERT_THRESHOLD } from "../util/constants";
import { fetchItalyEvents, fetchWorldEvents } from "../ingv/client";
import { insertIfNew as insertHistory, getEvent } from "../db/repositories/history";
import { incrementState, setState, getState } from "../db/repositories/system-state";
import { findRecipients } from "../notify/match";
import { deliverFirstWave } from "../notify/deliver";
import type { ParsedEvent } from "../ingv/types";
import type { Db } from "../db/types";
import type { Bot } from "grammy";

const log = createLogger("poll");

export async function runMainCron(
  config: { HEALTHCHECKS_URL: string | undefined; GEONAMES_USERNAME: string },
  db: Db,
  bot: Bot,
): Promise<void> {
  const start = Date.now();
  log.info({}, "main cron cycle started");

  // 1. Dead-man's-switch ping (fire-and-forget)
  if (config.HEALTHCHECKS_URL) {
    void fetch(config.HEALTHCHECKS_URL, { method: "GET" }).catch(() => {});
  }

  // 2. Fetch INGV
  const [italyEvents, worldEvents] = await Promise.all([
    fetchItalyEvents(config.GEONAMES_USERNAME).catch(() => []),
    fetchWorldEvents(config.GEONAMES_USERNAME).catch(() => []),
  ]);

  const allEvents = [...italyEvents, ...worldEvents];
  log.info({ italy: italyEvents.length, world: worldEvents.length, total: allEvents.length }, "events fetched");

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
    const recipients = await findRecipients(event, db);
    if (recipients.length > 0) {
      const outcome = await deliverFirstWave(bot, event, recipients, db);
      log.info({
        eventId: event.eventId,
        recipients: recipients.length,
        sent: outcome.sent,
        failedTransient: outcome.failedTransient,
        failedPermanent: outcome.failedPermanent,
      }, "delivery wave completed");
    } else {
      log.info({ eventId: event.eventId }, "no recipients for event");
    }
  }

  // 5. Update system_state
  await setState(db, "last_successful_sync_at", new Date().toISOString());
  await setState(db, "ingv_consecutive_failures", "0");

  log.info({ durationMs: Date.now() - start }, "main cron cycle finished");
}
