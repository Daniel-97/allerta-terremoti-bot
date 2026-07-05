import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { insertIfNew as historyInsert } from "@/db/repositories/history";
import {
  insertIfNew as deliveryInsert,
  updateStatus,
  listPendingForRetry,
} from "@/db/repositories/deliveries";
import { upsertActiveChat } from "@/db/repositories/chats";

const DDL = `
CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, username TEXT, status TEXT NOT NULL DEFAULT 'active', italy_alerts INTEGER NOT NULL DEFAULT 1, world_alerts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS history (id TEXT PRIMARY KEY, zone TEXT NOT NULL, date TEXT NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, depth REAL, stations_count INTEGER, magnitude_type TEXT, magnitude_value REAL NOT NULL, magnitude_uncertainty REAL);
CREATE TABLE IF NOT EXISTS deliveries (id INTEGER PRIMARY KEY, event_id TEXT NOT NULL, chat INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, FOREIGN KEY (event_id) REFERENCES history (id), FOREIGN KEY (chat) REFERENCES chats (id));
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_event_chat ON deliveries (event_id, chat);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries (status);
`;

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await client.executeMultiple(DDL);
  const db = drizzle({ client, schema });
  await db.run(sql`PRAGMA foreign_keys = ON`);
  return db;
}

describe("listPendingForRetry", () => {
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

  it("returns failed_transient deliveries below maxAttempts", async () => {
    const d = await db.select().from(schema.deliveries).then((r) => r[0]!);
    await updateStatus(db, d.id, "failed_transient", 1);

    const pending = await listPendingForRetry(db, 3);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.status).toBe("failed_transient");
    expect(pending[0]!.attempts).toBe(1);
  });

  it("excludes deliveries at or above maxAttempts", async () => {
    const d = await db.select().from(schema.deliveries).then((r) => r[0]!);
    await updateStatus(db, d.id, "failed_transient", 3);

    const pending = await listPendingForRetry(db, 3);
    expect(pending).toHaveLength(0);
  });

  it("excludes sent deliveries", async () => {
    const d = await db.select().from(schema.deliveries).then((r) => r[0]!);
    await updateStatus(db, d.id, "sent", 1);

    const pending = await listPendingForRetry(db, 3);
    expect(pending).toHaveLength(0);
  });

  it("excludes failed_permanent deliveries", async () => {
    const d = await db.select().from(schema.deliveries).then((r) => r[0]!);
    await updateStatus(db, d.id, "failed_permanent", 1);

    const pending = await listPendingForRetry(db, 3);
    expect(pending).toHaveLength(0);
  });
});
