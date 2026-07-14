import { eq, lt, and, notExists, sql } from "drizzle-orm";
import { history, deliveries } from "@/db/schema";
import type { Db } from "@/db/types";

export async function insertIfNew(
  db: Db,
  event: {
    id: string;
    zone: string;
    date: string;
    lat: number;
    lon: number;
    depth: number | null;
    stations_count: number | null;
    magnitude_type: string | null;
    magnitude_value: number;
    magnitude_uncertainty: number | null;
  },
): Promise<boolean> {
  const result = await db
    .insert(history)
    .values({
      ...event,
      stations_count: event.stations_count,
      magnitude_type: event.magnitude_type,
      magnitude_uncertainty: event.magnitude_uncertainty,
    })
    .onConflictDoNothing({ target: history.id })
    .returning({ id: history.id });
  return result.length > 0;
}

export async function getEvent(db: Db, id: string) {
  const rows = await db.select().from(history).where(eq(history.id, id)).limit(1);
  return rows[0];
}

export async function deleteOlderThan(db: Db, days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const result = await db
    .delete(history)
    .where(lt(history.date, cutoff))
    .returning({ id: history.id });
  return result.length;
}

export async function deleteOrphansOlderThan(db: Db, minutes: number): Promise<number> {
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  const sub = db.select().from(deliveries).where(eq(deliveries.event_id, history.id));
  const result = await db
    .delete(history)
    .where(and(lt(history.date, cutoff), notExists(sub)))
    .returning({ id: history.id });
  return result.length;
}

export async function listRecentEvents(db: Db, limit: number) {
  return db
    .select({
      id: history.id,
      zone: history.zone,
      mag: history.magnitude_value,
      date: history.date,
    })
    .from(history)
    .orderBy(sql`${history.date} desc`)
    .limit(limit);
}
