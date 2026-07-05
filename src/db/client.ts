import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppConfig } from "@/config";

export function createDb(config: AppConfig) {
  const client = createClient({
    url: config.TURSO_DATABASE_URL,
    authToken: config.TURSO_AUTH_TOKEN!,
  });
  const db = drizzle({ client, schema });
  const ready = db.run(sql`PRAGMA foreign_keys = ON`);
  return { db, ready };
}

export type DbClient = ReturnType<typeof createDb>;
