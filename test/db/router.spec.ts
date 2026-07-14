import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { upsertActiveChat } from "@/db/repositories/chats";
import { addLocation, getLocation } from "@/db/repositories/locations";
import { handleCallbackQuery } from "@/bot/inline/router";
import { encodeDeleteOk, encodeNav } from "@/util/callback-data";
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

function fakeCallbackCtx(chatId: number, data: string) {
  const editMessageText = vi.fn().mockResolvedValue(undefined);
  const answerCallbackQuery = vi.fn().mockResolvedValue(undefined);
  const reply = vi.fn().mockResolvedValue(undefined);
  const ctx = {
    callbackQuery: {
      data,
      message: { chat: { id: chatId } },
      from: { id: chatId, first_name: "Test" },
    },
    editMessageText,
    answerCallbackQuery,
    reply,
  } as unknown as Context;
  return { ctx, editMessageText, answerCallbackQuery, reply };
}

describe("handleCallbackQuery deleteOk", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;

  beforeEach(async () => {
    db = await freshDb();
    await upsertActiveChat(db, { id: 1, first_name: "U1", last_name: null, username: null });
  });

  it("deletes the location and confirms removal when it still exists", async () => {
    const id = await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "Roma" });
    const { ctx, answerCallbackQuery, editMessageText } = fakeCallbackCtx(1, encodeDeleteOk(id));

    await handleCallbackQuery(ctx, db);

    expect(answerCallbackQuery).toHaveBeenCalledWith({ text: 'Posizione "Roma" rimossa' });
    expect(await getLocation(db, id)).toBeUndefined();
    expect(editMessageText).toHaveBeenCalled();
  });

  it("answers with a stale-location message and refreshes the list when already removed", async () => {
    const id = await addLocation(db, { chat: 1, lat: 41.9, lon: 12.5, name: "Roma" });
    await handleCallbackQuery(fakeCallbackCtx(1, encodeDeleteOk(id)).ctx, db);
    const { ctx, answerCallbackQuery, editMessageText } = fakeCallbackCtx(1, encodeDeleteOk(id));

    await handleCallbackQuery(ctx, db);

    expect(answerCallbackQuery).toHaveBeenCalledWith({ text: "Posizione già rimossa" });
    expect(editMessageText).toHaveBeenCalled();
  });
});

describe("handleCallbackQuery nav add", () => {
  it("sends a request_location reply keyboard", async () => {
    const db = await freshDb();
    const { ctx, reply } = fakeCallbackCtx(1, encodeNav("add"));

    await handleCallbackQuery(ctx, db);

    expect(reply).toHaveBeenCalledTimes(1);
    const [, options] = reply.mock.calls[0]!;
    expect(options.reply_markup.keyboard[0][0]).toEqual({
      text: "📍 Invia la mia posizione attuale",
      request_location: true,
    });
  });
});
