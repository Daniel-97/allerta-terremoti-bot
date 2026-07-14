import { eq, and, sql } from "drizzle-orm";
import { locations } from "@/db/schema";
import type { Db } from "@/db/types";

export interface NewLocation {
  chat: number;
  lat: number;
  lon: number;
  name: string;
}

export async function addLocation(db: Db, loc: NewLocation): Promise<number> {
  const result = await db
    .insert(locations)
    .values({
      chat: loc.chat,
      lat: loc.lat,
      lon: loc.lon,
      name: loc.name,
      radius: 100,
      magnitude_threshold: 2.0,
    })
    .returning({ id: locations.id });
  return result[0]!.id;
}

export async function listLocations(db: Db, chat: number) {
  return db.select().from(locations).where(eq(locations.chat, chat)).orderBy(locations.id);
}

export async function getLocation(db: Db, id: number) {
  const rows = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
  return rows[0];
}

export async function countLocations(db: Db, chat: number): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(locations)
    .where(eq(locations.chat, chat));
  return rows[0]!.c;
}

export async function findByName(db: Db, chat: number, name: string) {
  const rows = await db
    .select()
    .from(locations)
    .where(and(eq(locations.chat, chat), eq(locations.name, name)))
    .limit(1);
  return rows[0];
}

export async function updateRadius(db: Db, id: number, radius: number): Promise<void> {
  await db.update(locations).set({ radius }).where(eq(locations.id, id));
}

export async function updateMagnitude(db: Db, id: number, magnitude: number): Promise<void> {
  await db.update(locations).set({ magnitude_threshold: magnitude }).where(eq(locations.id, id));
}

export async function deleteLocation(db: Db, id: number): Promise<void> {
  await db.delete(locations).where(eq(locations.id, id));
}

export async function countAll(db: Db): Promise<number> {
  const rows = await db.select({ c: sql<number>`count(*)` }).from(locations);
  return rows[0]!.c;
}
