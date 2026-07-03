import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import { insertIfNew as historyInsert } from "../../src/db/repositories/history";
import {
  insertIfNew as deliveryInsert,
  deleteOlderThan,
} from "../../src/db/repositories/deliveries";
import { deleteOrphansOlderThan, deleteOlderThan as deleteHistoryOlderThan } from "../../src/db/repositories/history";
import { upsertActiveChat } from "../../src/db/repositories/chats";

const DDL = `
CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, username TEXT, status TEXT NOT NULL DEFAULT 'active', italy_alerts INTEGER NOT NULL DEFAULT 1, world_alerts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, zone TEXT NOT NULL, date TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, depth REAL, stations_count INTEGER, magnitude_type TEXT, magnitude_value REAL NOT NULL, magnitude_uncertainty REAL);
CREATE TABLE IF NOT EXISTS deliveries (id INTEGER PRIMARY KEY, event_id TEXT NOT NULL, chat INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, FOREIGN KEY (event_id) REFERENCES history (id) ON DELETE CASCADE, FOREIGN KEY (chat) REFERENCES chats (id) ON DELETE CASCADE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_event_chat ON deliveries (event_id, chat);
CREATE TABLE IF NOT EXISTS system_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
`;

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await client.executeMultiple(DDL);
  const db = drizzle({ client, schema });
  await db.run(sql`PRAGMA foreign_keys = ON`);
  return db;
}

describe("deliveries cleanup", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;

  beforeEach(async () => {
    db = await freshDb();
    await historyInsert(db, {
      id: "ev1", zone: "Roma", date: "2026-06-30T12:00:00Z",
      lat: 41.9, lon: 12.5, depth: 10, stations_count: 5,
      magnitude_type: "ML", magnitude_value: 4.2, magnitude_uncertainty: 0.3,
    });
    await upsertActiveChat(db, { id: 100, first_name: "U", last_name: null, username: null });
    await deliveryInsert(db, { event_id: "ev1", chat: 100 });
  });

  it("deletes deliveries older than cutoff", async () => {
    const d = await db.select().from(schema.deliveries).then((r) => r[0]!);
    await db.update(schema.deliveries)
      .set({ updated_at: "2020-01-01T00:00:00Z" })
      .where(sql`id = ${d.id}`);

    const deleted = await deleteOlderThan(db, 30);
    expect(deleted).toBe(1);
    const remaining = await db.select().from(schema.deliveries);
    expect(remaining).toHaveLength(0);
  });

  it("preserves deliveries within cutoff", async () => {
    const deleted = await deleteOlderThan(db, 36500);
    expect(deleted).toBe(0);
    const remaining = await db.select().from(schema.deliveries);
    expect(remaining).toHaveLength(1);
  });
});

describe("history retention cleanup", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;

  beforeEach(async () => {
    db = await freshDb();
    await historyInsert(db, {
      id: "ev-ret-1", zone: "Roma", date: "2020-01-01T00:00:00Z",
      lat: 41.9, lon: 12.5, depth: 10, stations_count: 5,
      magnitude_type: "ML", magnitude_value: 4.2, magnitude_uncertainty: 0.3,
    });
    await historyInsert(db, {
      id: "ev-ret-2", zone: "Milano", date: new Date().toISOString(),
      lat: 45.46, lon: 9.19, depth: 8, stations_count: 3,
      magnitude_type: "ML", magnitude_value: 3.5, magnitude_uncertainty: 0.2,
    });
  });

  it("deletes events older than cutoff", async () => {
    const deleted = await deleteHistoryOlderThan(db, 30);
    expect(deleted).toBe(1);
    const remaining = await db.select().from(schema.history);
    expect(remaining.map((r: { id: string }) => r.id)).toEqual(["ev-ret-2"]);
  });

  it("preserves events within cutoff", async () => {
    const deleted = await deleteHistoryOlderThan(db, 36500);
    expect(deleted).toBe(0);
    const remaining = await db.select().from(schema.history);
    expect(remaining).toHaveLength(2);
  });

  it("cascades to deliveries when event is deleted", async () => {
    await upsertActiveChat(db, { id: 100, first_name: "U", last_name: null, username: null });
    await deliveryInsert(db, { event_id: "ev-ret-1", chat: 100 });

    const deleted = await deleteHistoryOlderThan(db, 30);
    expect(deleted).toBe(1);

    const remainingDeliveries = await db.select().from(schema.deliveries);
    expect(remainingDeliveries).toHaveLength(0);
  });
});

describe("history cleanup", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;

  beforeEach(async () => {
    db = await freshDb();
    await historyInsert(db, {
      id: "ev1", zone: "Roma", date: "2020-01-01T00:00:00Z",
      lat: 41.9, lon: 12.5, depth: 10, stations_count: 5,
      magnitude_type: "ML", magnitude_value: 4.2, magnitude_uncertainty: 0.3,
    });
    await upsertActiveChat(db, { id: 100, first_name: "U", last_name: null, username: null });
    await deliveryInsert(db, { event_id: "ev1", chat: 100 });

    await historyInsert(db, {
      id: "ev2", zone: "Milano", date: "2020-01-02T00:00:00Z",
      lat: 45.46, lon: 9.19, depth: 8, stations_count: 3,
      magnitude_type: "ML", magnitude_value: 3.5, magnitude_uncertainty: 0.2,
    });

    await historyInsert(db, {
      id: "ev3", zone: "Napoli", date: new Date().toISOString(),
      lat: 40.85, lon: 14.27, depth: 5, stations_count: 2,
      magnitude_type: "ML", magnitude_value: 2.8, magnitude_uncertainty: 0.1,
    });
  });

  it("deletes old history without deliveries", async () => {
    const deleted = await deleteOrphansOlderThan(db, 100000);
    expect(deleted).toBe(1);
    const remaining = await db.select().from(schema.history);
    expect(remaining.map((r: { id: string }) => r.id).sort()).toEqual(["ev1", "ev3"]);
  });

  it("preserves old history with deliveries", async () => {
    await deleteOrphansOlderThan(db, 10000);
    const remaining = await db.select().from(schema.history);
    expect(remaining.map((r: { id: string }) => r.id)).toContain("ev1");
  });

  it("preserves recent history even without deliveries", async () => {
    await deleteOrphansOlderThan(db, 1);
    const remaining = await db.select().from(schema.history);
    expect(remaining.map((r: { id: string }) => r.id)).toContain("ev3");
  });
});
