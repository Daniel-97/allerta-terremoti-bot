import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import {
  addLocation,
  listLocations,
  getLocation,
  countLocations,
  findByName,
  updateRadius,
  updateMagnitude,
  deleteLocation,
} from "../../src/db/repositories/locations";
import { upsertActiveChat } from "../../src/db/repositories/chats";

const DDL = `
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','stopped','deleted')),
  italy_alerts INTEGER NOT NULL DEFAULT 1 CHECK (italy_alerts IN (0,1)),
  world_alerts INTEGER NOT NULL DEFAULT 0 CHECK (world_alerts IN (0,1)),
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY,
  chat INTEGER NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  name TEXT NOT NULL,
  radius INTEGER NOT NULL DEFAULT 100 CHECK (radius >= 1 AND radius <= 300),
  magnitude_threshold REAL NOT NULL DEFAULT 2.0 CHECK (magnitude_threshold >= 2.0),
  FOREIGN KEY (chat) REFERENCES chats (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_chat_name ON locations (chat, name);
CREATE INDEX IF NOT EXISTS idx_locations_chat ON locations (chat);
`;

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await client.executeMultiple(DDL);
  const db = drizzle({ client, schema });
  await db.run(sql`PRAGMA foreign_keys = ON`);
  return db;
}

describe("locations repository", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;

  beforeEach(async () => {
    db = await freshDb();
    await upsertActiveChat(db, { id: 1, first_name: "U1", last_name: null, username: null });
    await upsertActiveChat(db, { id: 2, first_name: "U2", last_name: null, username: null });
  });

  it("addLocation inserts with defaults and returns id", async () => {
    const id = await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "Roma" });
    const row = await getLocation(db, id);
    expect(row?.name).toBe("Roma");
    expect(row?.radius).toBe(100);
    expect(row?.magnitude_threshold).toBe(2.0);
  });

  it("listLocations returns user locations ordered by id", async () => {
    await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "Roma" });
    await addLocation(db, { chat: 1, lat: 45.46, lon: 9.19, name: "Milano" });
    const locs = await listLocations(db, 1);
    expect(locs).toHaveLength(2);
    expect(locs[0]!.name).toBe("Roma");
    expect(locs[1]!.name).toBe("Milano");
  });

  it("listLocations returns empty for user with no locations", async () => {
    expect(await listLocations(db, 1)).toEqual([]);
  });

  it("countLocations returns correct count", async () => {
    expect(await countLocations(db, 1)).toBe(0);
    await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "Roma" });
    expect(await countLocations(db, 1)).toBe(1);
    await addLocation(db, { chat: 1, lat: 45.46, lon: 9.19, name: "Milano" });
    expect(await countLocations(db, 1)).toBe(2);
  });

  it("findByName returns location if exists", async () => {
    await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "Roma" });
    const found = await findByName(db, 1, "Roma");
    expect(found?.name).toBe("Roma");
    expect(await findByName(db, 1, "Milano")).toBeUndefined();
  });

  it("findByName checks per-chat uniqueness", async () => {
    await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "Roma" });
    expect(await findByName(db, 2, "Roma")).toBeUndefined();
  });

  it("updateRadius changes radius", async () => {
    const id = await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "Roma" });
    await updateRadius(db, id, 200);
    expect((await getLocation(db, id))?.radius).toBe(200);
  });

  it("updateMagnitude changes threshold", async () => {
    const id = await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "Roma" });
    await updateMagnitude(db, id, 3.5);
    expect((await getLocation(db, id))?.magnitude_threshold).toBe(3.5);
  });

  it("deleteLocation removes a location", async () => {
    const id = await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "Roma" });
    await deleteLocation(db, id);
    expect(await getLocation(db, id)).toBeUndefined();
  });

  it("deleting a chat cascades to locations", async () => {
    await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "Roma" });
    await db.delete(schema.chats).where(sql`id = 1`);
    expect(await listLocations(db, 1)).toEqual([]);
  });
});
