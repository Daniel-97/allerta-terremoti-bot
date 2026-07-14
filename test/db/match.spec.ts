import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { upsertActiveChat } from "@/db/repositories/chats";
import { addLocation } from "@/db/repositories/locations";
import { findRecipients, matchChat } from "@/notify/match";

const DDL = `
CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, username TEXT, status TEXT NOT NULL DEFAULT 'active', italy_alerts INTEGER NOT NULL DEFAULT 1, world_alerts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY, chat INTEGER NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, name TEXT NOT NULL, radius INTEGER NOT NULL DEFAULT 100, magnitude_threshold REAL NOT NULL DEFAULT 2.0, FOREIGN KEY (chat) REFERENCES chats(id));
CREATE INDEX IF NOT EXISTS idx_locations_chat ON locations(chat);
`;

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await client.executeMultiple(DDL);
  const db = drizzle({ client, schema });
  await db.run(sql`PRAGMA foreign_keys = ON`);
  return db;
}

describe("findRecipients", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  beforeEach(async () => {
    db = await freshDb();
    await upsertActiveChat(db, { id: 1, first_name: "A", last_name: null, username: null });
    await upsertActiveChat(db, { id: 2, first_name: "B", last_name: null, username: null });
  });

  it("finds proximity recipient", async () => {
    await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "RM" });
    const ev = {
      eventId: "ev1",
      lat: 41.9,
      lon: 12.5,
      magnitude: 3.0,
      zone: "Roma",
      time: "2026-06-30T12:00:00",
      depth: 10,
      author: "INGV",
      catalog: "INGV",
      contributor: "INGV",
      contributorId: "I1",
      magType: "ML",
      magAuthor: "INGV",
    };
    const r = await findRecipients(ev, db, 5.0, 7.0);
    expect(r).toHaveLength(1);
    expect(r[0]!.chatId).toBe(1);
    expect(r[0]!.reason).toBe("proximity");
  });

  it("excludes chat with status != active", async () => {
    await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "RM" });
    await db
      .update(schema.chats)
      .set({ status: "stopped" })
      .where(sql`id=1`);
    const ev = {
      eventId: "ev1",
      lat: 41.9,
      lon: 12.5,
      magnitude: 3.0,
      zone: "Roma",
      time: "2026-06-30T12:00:00",
      depth: 10,
      author: "INGV",
      catalog: "INGV",
      contributor: "INGV",
      contributorId: "I1",
      magType: "ML",
      magAuthor: "INGV",
    };
    expect(await findRecipients(ev, db, 5.0, 7.0)).toEqual([]);
  });
});

describe("general reason", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  beforeEach(async () => {
    db = await freshDb();
    await upsertActiveChat(db, { id: 1, first_name: "A", last_name: null, username: null });
  });

  const bigItalianEvent = {
    eventId: "ev1",
    lat: 41.9,
    lon: 12.5,
    magnitude: 7.5,
    zone: "Roma",
    time: "2026-06-30T12:00:00",
    depth: 10,
    author: "INGV",
    catalog: "INGV",
    contributor: "INGV",
    contributorId: "I1",
    magType: "ML",
    magAuthor: "INGV",
  };

  it("reason is 'general' for an Italian event above threshold when italy_alerts is on", async () => {
    await db
      .update(schema.chats)
      .set({ world_alerts: true })
      .where(sql`id=1`);
    const r = await matchChat(bigItalianEvent, 1, db, 5.0, 7.0);
    expect(r?.reason).toBe("general");
  });

  it("reason is 'general' for an event above the world threshold when italy_alerts is off", async () => {
    await db
      .update(schema.chats)
      .set({ italy_alerts: false, world_alerts: true })
      .where(sql`id=1`);
    const r = await matchChat(bigItalianEvent, 1, db, 5.0, 7.0);
    expect(r?.reason).toBe("general");
  });

  it("carries over the nearest saved location when the event also qualifies as general", async () => {
    await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "RM" });
    await db
      .update(schema.chats)
      .set({ world_alerts: true })
      .where(sql`id=1`);
    const r = await matchChat(bigItalianEvent, 1, db, 5.0, 7.0);
    expect(r?.reason).toBe("general");
    expect(r?.nearestLocationId).not.toBeNull();
    expect(r?.distanceKm).toBe(0);
  });
});
