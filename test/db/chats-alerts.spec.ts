import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import {
  upsertActiveChat,
  setAlertFlags,
  getChat,
} from "../../src/db/repositories/chats";

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
`;

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await client.executeMultiple(DDL);
  const db = drizzle({ client, schema });
  await db.run(sql`PRAGMA foreign_keys = ON`);
  return db;
}

describe("setAlertFlags", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;

  beforeEach(async () => {
    db = await freshDb();
    await upsertActiveChat(db, { id: 1, first_name: "T", last_name: null, username: null });
  });

  it("sets italy_alerts to false", async () => {
    await setAlertFlags(db, 1, { italy_alerts: false, world_alerts: false });
    const chat = await getChat(db, 1);
    expect(chat?.italy_alerts).toBe(false);
    expect(chat?.world_alerts).toBe(false);
  });

  it("sets world_alerts to true", async () => {
    await setAlertFlags(db, 1, { italy_alerts: true, world_alerts: true });
    const chat = await getChat(db, 1);
    expect(chat?.world_alerts).toBe(true);
  });

  it("updates updated_at timestamp", async () => {
    const before = (await getChat(db, 1))!.updated_at;
    await setAlertFlags(db, 1, { italy_alerts: false, world_alerts: false });
    const after = (await getChat(db, 1))!.updated_at;
    expect(after).not.toBe(before);
  });
});
