import { createLogger } from "@/util/log";
import { deleteOlderThan as deleteDeliveriesOlderThan } from "@/db/repositories/deliveries";
import {
  deleteOlderThan as deleteHistoryOlderThan,
  deleteOrphansOlderThan,
} from "@/db/repositories/history";
import type { Db } from "@/db/types";

const log = createLogger("cleanup");

export async function runCleanupCron(
  db: Db,
  config: {
    lookbackWindowMin: number;
    deliveriesRetentionDays: number;
    eventsRetentionDays: number;
  },
): Promise<void> {
  const start = Date.now();

  const deliveriesDeleted = await deleteDeliveriesOlderThan(db, config.deliveriesRetentionDays);
  const historyDeletedByAge = await deleteHistoryOlderThan(db, config.eventsRetentionDays);
  const historyDeleted = await deleteOrphansOlderThan(db, config.lookbackWindowMin);

  log.info(
    {
      deliveriesDeleted,
      historyDeletedByAge,
      historyDeleted,
      durationMs: Date.now() - start,
    },
    "cleanup cycle finished",
  );
}
