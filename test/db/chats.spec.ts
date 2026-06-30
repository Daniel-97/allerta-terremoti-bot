import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import {
  touchChat,
  upsertActiveChat,
  getChat,
  setChatStatus,
} from "../../src/db/repositories/chats";

const DDL = `
CREATE TABLE chats (
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

describe("chats repository", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  beforeEach(async () => {
    db = await freshDb();
  });

  it("touch inserts a new chat as active", async () => {
    await touchChat(db, {
      id: 100,
      first_name: "Ada",
      last_name: "L",
      username: "ada",
    });
    const row = await getChat(db, 100);
    expect(row?.status).toBe("active");
    expect(row?.first_name).toBe("Ada");
    expect(row?.created_at).toBe(row?.last_seen_at);
    expect(row?.updated_at).toBe(row?.created_at);
  });

  it("touch does not change status or updated_at on existing chat", async () => {
    await upsertActiveChat(db, { id: 200, first_name: "Bo" });
    await setChatStatus(db, 200, "stopped");
    const before = await getChat(db, 200);
    await touchChat(db, { id: 200, first_name: "Bo2" });
    const after = await getChat(db, 200);
    expect(after?.status).toBe("stopped");
    expect(after?.updated_at).toBe(before?.updated_at);
    expect(after?.last_seen_at).not.toBe(before?.last_seen_at);
    expect(after?.first_name).toBe("Bo2");
  });

  it("upsertActiveChat reactivates from stopped/blocked/deleted", async () => {
    for (const s of ["stopped", "blocked", "deleted"] as const) {
      await upsertActiveChat(db, { id: 300, first_name: "C" });
      await setChatStatus(db, 300, s);
      const beforeStatusUpdate = (await getChat(db, 300))!.updated_at;
      await upsertActiveChat(db, { id: 300, first_name: "C" });
      const after = await getChat(db, 300);
      expect(after?.status).toBe("active");
      expect(after?.updated_at).not.toBe(beforeStatusUpdate);
    }
  });

  it("setChatStatus transitions status", async () => {
    await upsertActiveChat(db, { id: 400, first_name: "D" });
    await setChatStatus(db, 400, "blocked");
    expect((await getChat(db, 400))?.status).toBe("blocked");
  });

  it("getChat returns undefined for non-existent id", async () => {
    expect(await getChat(db, 999)).toBeUndefined();
  });
});
