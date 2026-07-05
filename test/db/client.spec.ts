import { describe, it, expect } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";

describe("db client", () => {
  it("enables foreign_keys pragma", async () => {
    const client = createClient({ url: ":memory:" });
    const db = drizzle({ client, schema });
    await db.run(sql`PRAGMA foreign_keys = ON`);
    const res = await client.execute("PRAGMA foreign_keys");
    expect(res.rows[0]).toEqual({ foreign_keys: 1 });
  });
});
