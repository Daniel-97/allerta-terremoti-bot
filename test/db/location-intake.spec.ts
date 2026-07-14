import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { upsertActiveChat } from "@/db/repositories/chats";
import { addLocation, getLocation } from "@/db/repositories/locations";
import { addLocationFlow } from "@/bot/location-intake";

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

const CONFIG = { GEONAMES_USERNAME: "user", maxLocationsPerUser: 10 };

function mockFetchOnce(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status }),
  );
}

describe("addLocationFlow", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;

  beforeEach(async () => {
    db = await freshDb();
    await upsertActiveChat(db, { id: 1, first_name: "U1", last_name: null, username: null });
  });

  afterEach(() => vi.restoreAllMocks());

  it("rejects coordinates outside the allowed area", async () => {
    const outcome = await addLocationFlow(db, CONFIG, 1, 0, 0);
    expect(outcome).toEqual({ kind: "out_of_area" });
  });

  it("rejects when the location cap is reached", async () => {
    await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "Roma" });
    const outcome = await addLocationFlow(db, { ...CONFIG, maxLocationsPerUser: 1 }, 1, 45.46, 9.19);
    expect(outcome).toEqual({ kind: "cap_reached" });
  });

  it("reports geocoding failure when geonames returns no result", async () => {
    mockFetchOnce({ geonames: [] });
    const outcome = await addLocationFlow(db, CONFIG, 1, 41.9, 12.5);
    expect(outcome).toEqual({ kind: "geocoding_failed" });
  });

  it("rejects a duplicate comune for the same chat", async () => {
    await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "Roma" });
    mockFetchOnce({ geonames: [{ toponymName: "Roma" }] });
    const outcome = await addLocationFlow(db, CONFIG, 1, 41.91, 12.51);
    expect(outcome).toEqual({ kind: "duplicate" });
  });

  it("adds a new location and returns its id and name", async () => {
    mockFetchOnce({ geonames: [{ toponymName: "Milano", adminCode2: "MI" }] });
    const outcome = await addLocationFlow(db, CONFIG, 1, 45.46, 9.19);
    expect(outcome.kind).toBe("added");
    if (outcome.kind === "added") {
      expect(outcome.name).toBe("Milano (MI)");
      const row = await getLocation(db, outcome.id);
      expect(row?.name).toBe("Milano (MI)");
    }
  });
});
