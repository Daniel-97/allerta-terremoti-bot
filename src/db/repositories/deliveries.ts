import { eq, and, lt, lte, inArray } from "drizzle-orm";
import { deliveries } from "@/db/schema";
import { nowIso } from "@/util/time";
import type { Db } from "@/db/types";

export type DeliveryStatus = "pending" | "sent" | "failed_transient" | "failed_permanent";

export interface NewDelivery {
  event_id: string;
  chat: number;
}

export async function insertIfNew(db: Db, d: NewDelivery): Promise<boolean> {
  const result = await db
    .insert(deliveries)
    .values({
      event_id: d.event_id,
      chat: d.chat,
      status: "pending",
      attempts: 0,
      updated_at: nowIso(),
    })
    .onConflictDoNothing({ target: [deliveries.event_id, deliveries.chat] })
    .returning({ id: deliveries.id });
  return result.length > 0;
}

export async function updateStatus(
  db: Db,
  id: number,
  status: DeliveryStatus,
  attempts: number,
): Promise<void> {
  await db
    .update(deliveries)
    .set({ status, attempts, updated_at: nowIso() })
    .where(eq(deliveries.id, id));
}

export async function listPendingForRetry(db: Db, maxAttempts: number) {
  return db
    .select()
    .from(deliveries)
    .where(
      and(
        inArray(deliveries.status, ["failed_transient", "pending"]),
        lt(deliveries.attempts, maxAttempts),
      ),
    );
}

export async function getDelivery(db: Db, eventId: string, chat: number) {
  const rows = await db
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.event_id, eventId), eq(deliveries.chat, chat)))
    .limit(1);
  return rows[0];
}

export async function listByEvent(db: Db, eventId: string) {
  return db.select().from(deliveries).where(eq(deliveries.event_id, eventId));
}

export async function deleteOlderThan(db: Db, days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const result = await db
    .delete(deliveries)
    .where(lte(deliveries.updated_at, cutoff))
    .returning({ id: deliveries.id });
  return result.length;
}
