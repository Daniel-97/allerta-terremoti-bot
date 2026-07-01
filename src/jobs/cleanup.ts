import { createLogger } from "../util/log";
import { deleteOlderThan as deleteDeliveriesOlderThan } from "../db/repositories/deliveries";
import { deleteOrphansOlderThan } from "../db/repositories/history";
import { LOOKBACK_WINDOW_MIN, DELIVERIES_RETENTION_DAYS } from "../util/constants";
import type { Db } from "../db/types";

const log = createLogger("cleanup");

export async function runCleanupCron(db: Db): Promise<void> {
  const start = Date.now();

  const deliveriesDeleted = await deleteDeliveriesOlderThan(db, DELIVERIES_RETENTION_DAYS);
  const historyDeleted = await deleteOrphansOlderThan(db, LOOKBACK_WINDOW_MIN);

  log.info({
    deliveriesDeleted,
    historyDeleted,
    durationMs: Date.now() - start,
  }, "cleanup cycle finished");
}
