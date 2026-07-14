import { describe, it, expect, beforeEach, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { upsertActiveChat, setChatStatus, getChat } from "@/db/repositories/chats";
import { handle as startHandle } from "@/bot/commands/start";
import { createLogger } from "@/util/log";
import type { Context } from "grammy";

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

function fakeCtx(chatId: number): Context {
  return {
    chat: { id: chatId, type: "private" },
    from: { id: chatId, first_name: "Test", is_bot: false },
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as Context;
}

const CONFIG = { italyAlertThreshold: 5.0, worldAlertThreshold: 7.0 };
const log = createLogger("test");

describe("start.handle reactivation", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;

  beforeEach(async () => {
    db = await freshDb();
  });

  it.each(["stopped", "blocked", "deleted"] as const)(
    "reactivates a chat with status %s back to active",
    async (status) => {
      await upsertActiveChat(db, { id: 1, first_name: "Ada", last_name: null, username: null });
      await setChatStatus(db, 1, status);

      await startHandle(fakeCtx(1), db, log, CONFIG);

      expect((await getChat(db, 1))?.status).toBe("active");
    },
  );

  it("sends exactly one welcome reply", async () => {
    await upsertActiveChat(db, { id: 2, first_name: "Bo", last_name: null, username: null });
    const ctx = fakeCtx(2);

    await startHandle(ctx, db, log, CONFIG);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });
});
