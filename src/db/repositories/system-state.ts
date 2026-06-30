import { eq } from "drizzle-orm";
import { systemState } from "../schema";
import { nowIso } from "../../util/time";
import type { Db } from "../types";

export async function getState(db: Db, key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(systemState)
    .where(eq(systemState.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

export async function setState(db: Db, key: string, value: string): Promise<void> {
  await db
    .insert(systemState)
    .values({ key, value, updated_at: nowIso() })
    .onConflictDoUpdate({
      target: systemState.key,
      set: { value, updated_at: nowIso() },
    });
}

export async function incrementState(db: Db, key: string): Promise<void> {
  const current = await getState(db, key);
  const next = current ? String(Number(current) + 1) : "1";
  await setState(db, key, next);
}
