import { loadConfig } from "@/config";
import { createDb } from "@/db/client";
import { fetchItalyEvents, fetchWorldEvents } from "@/services/ingv/client";
import { insertIfNew } from "@/db/repositories/history";
import { createLogger } from "@/util/log";

const log = createLogger("sync-ingv");

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const { db, ready } = createDb(config);
  await ready;

  log.info({}, "fetching INGV events...");

  const [italyEvents, worldEvents] = await Promise.all([
    fetchItalyEvents(config.lookbackWindowMin),
    fetchWorldEvents(config.lookbackWindowMin),
  ]);

  const allEvents = [...italyEvents, ...worldEvents];
  if (allEvents.length > 0) {
    log.info({ italy: italyEvents.length, world: worldEvents.length }, "events fetched");
  }
  let newCount = 0;
  for (const event of allEvents) {
    const isNew = await insertIfNew(db, {
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
    if (isNew) newCount++;
  }

  log.info({
    total: allEvents.length,
    new: newCount,
    existing: allEvents.length - newCount,
  }, "sync complete");

  // @ts-expect-error drizzle client has an underlying libsql client with close()
  await db.$client?.close?.();
}

main().catch((err) => {
  log.error({ err: String(err) }, "sync failed");
  process.exit(1);
});
