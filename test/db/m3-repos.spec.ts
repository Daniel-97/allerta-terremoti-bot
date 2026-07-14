import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { insertIfNew as historyInsert, getEvent } from "@/db/repositories/history";
import {
  insertIfNew as deliveryInsert,
  updateStatus,
  getDelivery,
} from "@/db/repositories/deliveries";
import { getState, setState, incrementState } from "@/db/repositories/system-state";
import { upsertActiveChat } from "@/db/repositories/chats";

const DDL = `
CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, username TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','stopped','deleted')), italy_alerts INTEGER NOT NULL DEFAULT 1 CHECK (italy_alerts IN (0,1)), world_alerts INTEGER NOT NULL DEFAULT 0 CHECK (world_alerts IN (0,1)), created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, zone TEXT NOT NULL, date TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, depth REAL, stations_count INTEGER, magnitude_type TEXT, magnitude_value REAL NOT NULL, magnitude_uncertainty REAL);
CREATE TABLE IF NOT EXISTS deliveries (id INTEGER PRIMARY KEY, event_id TEXT NOT NULL, chat INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed_transient','failed_permanent')), attempts INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, FOREIGN KEY (event_id) REFERENCES history (id), FOREIGN KEY (chat) REFERENCES chats (id));
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

describe("history repo", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  beforeEach(async () => {
    db = await freshDb();
  });

  it("insertIfNew returns true for new event", async () => {
    const newEvent = await historyInsert(db, {
      id: "ev1",
      zone: "Roma",
      date: "2026-06-30T12:00:00Z",
      lat: 41.9,
      lon: 12.5,
      depth: 10,
      stations_count: 5,
      magnitude_type: "ML",
      magnitude_value: 4.2,
      magnitude_uncertainty: 0.3,
    });
    expect(newEvent).toBe(true);
  });

  it("insertIfNew returns false for duplicate event", async () => {
    const ev = {
      id: "ev1",
      zone: "Roma",
      date: "2026-06-30T12:00:00Z",
      lat: 41.9,
      lon: 12.5,
      depth: 10,
      stations_count: 5,
      magnitude_type: "ML",
      magnitude_value: 4.2,
      magnitude_uncertainty: 0.3,
    };
    await historyInsert(db, ev);
    const dup = await historyInsert(db, ev);
    expect(dup).toBe(false);
  });

  it("getEvent returns the event", async () => {
    await historyInsert(db, {
      id: "ev1",
      zone: "Roma",
      date: "2026-06-30T12:00:00Z",
      lat: 41.9,
      lon: 12.5,
      depth: 10,
      stations_count: 5,
      magnitude_type: "ML",
      magnitude_value: 4.2,
      magnitude_uncertainty: 0.3,
    });
    const e = await getEvent(db, "ev1");
    expect(e?.zone).toBe("Roma");
    expect(e?.magnitude_value).toBe(4.2);
  });
});

describe("deliveries repo", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  beforeEach(async () => {
    db = await freshDb();
    await historyInsert(db, {
      id: "ev1",
      zone: "Roma",
      date: "2026-06-30T12:00:00Z",
      lat: 41.9,
      lon: 12.5,
      depth: null,
      stations_count: null,
      magnitude_type: null,
      magnitude_value: 4.2,
      magnitude_uncertainty: null,
    });
    await upsertActiveChat(db, { id: 100, first_name: "U", last_name: null, username: null });
  });

  it("insertIfNew creates a pending delivery", async () => {
    const r = await deliveryInsert(db, { event_id: "ev1", chat: 100 });
    expect(r).toBe(true);
    const d = await getDelivery(db, "ev1", 100);
    expect(d?.status).toBe("pending");
  });

  it("insertIfNew does not duplicate", async () => {
    await deliveryInsert(db, { event_id: "ev1", chat: 100 });
    const dup = await deliveryInsert(db, { event_id: "ev1", chat: 100 });
    expect(dup).toBe(false);
  });

  it("updateStatus changes status", async () => {
    await deliveryInsert(db, { event_id: "ev1", chat: 100 });
    const d = await getDelivery(db, "ev1", 100);
    await updateStatus(db, d!.id, "sent", 1);
    const updated = await getDelivery(db, "ev1", 100);
    expect(updated?.status).toBe("sent");
  });
});

describe("system_state repo", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  beforeEach(async () => {
    db = await freshDb();
  });

  it("getState returns null for missing key", async () => {
    expect(await getState(db, "nonexistent")).toBeNull();
  });

  it("setState and getState round-trip", async () => {
    await setState(db, "test_key", "hello");
    expect(await getState(db, "test_key")).toBe("hello");
  });

  it("incrementState works from zero", async () => {
    await incrementState(db, "counter");
    expect(await getState(db, "counter")).toBe("1");
    await incrementState(db, "counter");
    expect(await getState(db, "counter")).toBe("2");
  });
});
