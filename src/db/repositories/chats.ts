import { eq, sql } from "drizzle-orm";
import { chats } from "../schema";
import { nowIso } from "../../util/time";
import type { Db } from "../types";

export type ChatStatus = "active" | "blocked" | "stopped" | "deleted";

export interface ChatRef {
  id: number;
  first_name: string | null | undefined;
  last_name: string | null | undefined;
  username: string | null | undefined;
}

export async function touchChat(db: Db, chat: ChatRef): Promise<void> {
  const now = nowIso();
  await db
    .insert(chats)
    .values({
      id: chat.id,
      first_name: chat.first_name ?? null,
      last_name: chat.last_name ?? null,
      username: chat.username ?? null,
      status: "active",
      italy_alerts: true,
      world_alerts: false,
      created_at: now,
      last_seen_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: chats.id,
      set: {
        last_seen_at: now,
        first_name: chat.first_name ?? null,
        last_name: chat.last_name ?? null,
        username: chat.username ?? null,
      },
    });
}

export async function upsertActiveChat(db: Db, chat: ChatRef): Promise<void> {
  const now = nowIso();
  await db
    .insert(chats)
    .values({
      id: chat.id,
      first_name: chat.first_name ?? null,
      last_name: chat.last_name ?? null,
      username: chat.username ?? null,
      status: "active",
      italy_alerts: true,
      world_alerts: false,
      created_at: now,
      last_seen_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: chats.id,
      set: {
        status: "active",
        first_name: chat.first_name ?? null,
        last_name: chat.last_name ?? null,
        username: chat.username ?? null,
        last_seen_at: now,
        updated_at: now,
      },
    });
}

export async function getChat(db: Db, id: number) {
  const rows = await db.select().from(chats).where(eq(chats.id, id)).limit(1);
  return rows[0];
}

export async function setChatStatus(
  db: Db,
  id: number,
  status: ChatStatus,
): Promise<void> {
  await db
    .update(chats)
    .set({ status, updated_at: nowIso() })
    .where(eq(chats.id, id));
}

export async function setAlertFlags(
  db: Db,
  id: number,
  flags: { italy_alerts: boolean; world_alerts: boolean },
): Promise<void> {
  await db
    .update(chats)
    .set({ ...flags, updated_at: nowIso() })
    .where(eq(chats.id, id));
}

export async function listActiveChats(db: Db) {
  return db
    .select()
    .from(chats)
    .where(eq(chats.status, "active"));
}

export async function countByStatus(db: Db) {
  return db
    .select({ status: chats.status, count: sql<number>`count(*)` })
    .from(chats)
    .groupBy(chats.status);
}
