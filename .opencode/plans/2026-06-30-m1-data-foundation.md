# M1 — Data foundation & config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Turso database and a data-access layer exist; `/start` creates/reactivates a chat (`status='active'`); non-private messages are ignored; tests for the chats repository and status transitions pass.

**Architecture:** `src/db/client.ts` builds a Drizzle instance (libSQL `web` variant for Workers) from `config` and runs `PRAGMA foreign_keys = ON`. `src/db/schema.ts` defines all five Drizzle tables kept in sync with `schema.sql` (the source of truth, now under `src/db/`). `src/db/repositories/chats.ts` exposes `touchChat`, `upsertActiveChat`, `getChat`, `setChatStatus`. The bot receives `db` and registers a private-only middleware plus a `/start` handler that upserts with `status='active'`. Repository tests run in a **separate Node pool** (`vitest.db.config.ts`) against libSQL `:memory:` (the `web` client variant cannot use `:memory:`; AGENTS forbids hitting real endpoints).

**Tech Stack:** `@libsql/client` (+ `/web`), `drizzle-orm` (+ `/libsql/web` for prod, `/libsql` native for tests), Vitest (Workers pool for `src`-level tests, Node pool for `test/db`), zod (config tightened).

**Refs:** MILESTONES M1; SRS 3.6 (FR-6), 6.1, 6.6, NFR-5.1/5.2; AGENTS (database, invariants 11–12).

---

## File structure for M1

```
src/
  db/
    schema.sql          # MOVED from db/schema.sql (source of truth, per AGENTS)
    schema.ts           # Drizzle table defs (all 5 tables, in sync with schema.sql)
    client.ts           # createDb(config) -> web drizzle; PRAGMA foreign_keys=ON
    types.ts            # shared Db type (web + native)
    repositories/
      chats.ts          # touchChat, upsertActiveChat, getChat, setChatStatus
  util/
    time.ts             # nowIso() -> ISO 8601 UTC
  bot/
    bot.ts              # createBot(config, db): private-only middleware + touch + /start
  i18n/strings.ts        # existing; unchanged in M1
  config.ts             # TURSO_DATABASE_URL + TURSO_AUTH_TOKEN now required
  index.ts              # create db from config, pass to createBot
test/
  db/
    chats.spec.ts       # repository tests (Node pool + libSQL :memory:)
    client.spec.ts      # minimal createDb smoke (Node pool)
  smoke.spec.ts          # existing (workers pool)
  config.spec.ts        # updated: TURSO now required
  webhook.spec.ts        # existing
vitest.config.ts         # workers pool, excludes test/db
vitest.db.config.ts      # node pool for test/db
```

**New dependencies:** `@libsql/client`, `drizzle-orm`.

**Decisions baked in:**
- `schema.sql` moved to `src/db/schema.sql` (AGENTS location); empty `db/` folder removed.
- `schema.ts` defines **all five tables now** (keeps the "in sync" invariant; typing only, no premature logic).
- Repository style is **functional** (`touchChat(db, …)`), not classes.
- Middleware: for every private-chat message, `touchChat` runs (insert if new with `status='active'`, else update `last_seen_at` + profile; does **not** touch `status` or `updated_at`). `/start` forces `status='active'` (reactivation from `blocked`/`stopped`/`deleted`) and refreshes `updated_at`.
- Timestamps are ISO 8601 UTC via `nowIso()`; `created_at`/`last_seen_at`/`updated_at` set on insert; on touch only `last_seen_at` (+ profile); on `/start` also `updated_at`.
- `createDb` is **async-aware**: returns `{ db, ready }` where `ready` is the PRAGMA promise; the fetch handler awaits it before creating the bot.
- **Test strategy:** `test/db/**` runs in the Node pool with `@libsql/client` (native, `:memory:`) + `drizzle-orm/libsql`; `npm test` runs `vitest run` (workers pool, excludes `test/db/`) **then** `vitest run --config vitest.db.config.ts` (node pool).
- Non-private messages are ignored both in middleware (short-circuit) and in `/start` (defense in depth).
- No `/stop` in M1 (scope M2); `setChatStatus` is implemented and tested now (used by M2/M3).

---

## Task 1: Install `@libsql/client` + `drizzle-orm`; move `schema.sql`; create `src/db/schema.ts`

**Files:** `package.json`, `package-lock.json`; move `db/schema.sql`→`src/db/schema.sql`; create `src/db/schema.ts`, `src/db/types.ts`; remove `db/`.

- [ ] **Step 1:** install dependencies

```bash
npm install @libsql/client drizzle-orm
```

- [ ] **Step 2:** move the schema (AGENTS wants it at `src/db/schema.sql`)

```bash
git mv db/schema.sql src/db/schema.sql
rmdir db
```

- [ ] **Step 3:** create `src/db/schema.ts` — Drizzle definitions for **all five tables**, in sync with `schema.sql` (columns, `CHECK` constraints as enums / `int({ mode: "boolean" })`, unique indexes):

```ts
import { sqliteTable, integer, text, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const chats = sqliteTable(
  "chats",
  {
    id: integer().primaryKey(),
    first_name: text("first_name"),
    last_name: text("last_name"),
    username: text("username"),
    status: text("status", { enum: ["active", "blocked", "stopped", "deleted"] })
      .notNull()
      .default("active"),
    italy_alerts: integer("italy_alerts", { mode: "boolean" }).notNull().default(true),
    world_alerts: integer("world_alerts", { mode: "boolean" }).notNull().default(false),
    created_at: text("created_at").notNull(),
    last_seen_at: text("last_seen_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
);

export const locations = sqliteTable(
  "locations",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    chat: integer("chat").notNull(),
    lat: real("lat").notNull(),
    lon: real("lon").notNull(),
    name: text("name").notNull(),
    radius: integer("radius").notNull().default(100),
    magnitude_threshold: real("magnitude_threshold").notNull().default(2.0),
  },
  (t) => ({
    chatNameUniq: uniqueIndex("idx_locations_chat_name").on(t.chat, t.name),
    chatIdx: index("idx_locations_chat").on(t.chat),
  }),
);

export const history = sqliteTable("history", {
  id: text("id").primaryKey(),
  zone: text("zone").notNull(),
  date: text("date").notNull(),
  lat: real("lat").notNull(),
  lon: real("lon").notNull(),
  depth: real("depth"),
  stations_count: integer("stations_count"),
  magnitude_type: text("magnitude_type"),
  magnitude_value: real("magnitude_value").notNull(),
  magnitude_uncertainty: real("magnitude_uncertainty"),
});

export const deliveries = sqliteTable(
  "deliveries",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    event_id: text("event_id").notNull(),
    chat: integer("chat").notNull(),
    status: text("status", {
      enum: ["pending", "sent", "failed_transient", "failed_permanent"],
    })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    updated_at: text("updated_at").notNull(),
  },
  (t) => ({
    eventChatUniq: uniqueIndex("idx_deliveries_event_chat").on(t.event_id, t.chat),
    eventStatusIdx: index("idx_deliveries_event_status").on(t.event_id, t.status),
    statusIdx: index("idx_deliveries_status").on(t.status),
    updatedAtIdx: index("idx_deliveries_updated_at").on(t.updated_at),
  }),
);

export const systemState = sqliteTable("system_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updated_at: text("updated_at").notNull(),
});
```

> Note: `chats.id` is the Telegram chat id (no autoIncrement — the app supplies it). `locations.id`, `deliveries.id` are surrogate auto-increment rowids (short ids fit `callback_data`).

- [ ] **Step 4:** typecheck

```bash
npm run typecheck
```
Expected: PASS

- [ ] **Step 5:** commit

```bash
git add -A
git commit -m "feat(db): move schema.sql to src/db, add drizzle schema for all tables"
```

---

## Task 2: `src/db/client.ts` (createDb web + PRAGMA) — with minimal test

**Files:** `src/db/client.ts`, `src/db/types.ts`, `test/db/client.spec.ts` (Node pool, runs in Task 6).

- [ ] **Step 1:** `src/db/client.ts`:

```ts
import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql/web";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import type { AppConfig } from "../config";

export function createDb(config: AppConfig) {
  const client = createClient({
    url: config.TURSO_DATABASE_URL,
    authToken: config.TURSO_AUTH_TOKEN,
  });
  const db = drizzle({ client, schema });
  // PRAGMA must run on every connection; callers must await `ready` before using `db`.
  const ready = db.run(sql`PRAGMA foreign_keys = ON`);
  return { db, ready };
}

export type DbClient = ReturnType<typeof createDb>;
```

> `createDb` returns `{ db, ready }`. The caller awaits `ready` before issuing queries so `ON DELETE CASCADE` is enforced.

- [ ] **Step 2:** `src/db/types.ts`:

```ts
import type { DbClient } from "./client";

export type Db = DbClient["db"];
```

- [ ] **Step 3:** `test/db/client.spec.ts` (Node pool; pool config arrives in Task 6, but the test is written now per TDD):

```ts
import { describe, it, expect } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

describe("db client", () => {
  it("enables foreign_keys pragma", async () => {
    const client = createClient({ url: ":memory:" });
    const db = drizzle({ client, schema });
    await db.run(sql`PRAGMA foreign_keys = ON`);
    const res = await client.execute("PRAGMA foreign_keys");
    expect(res.rows[0]).toEqual({ foreign_keys: 1 });
  });
});
```

- [ ] **Step 4:** typecheck

```bash
npm run typecheck
```
Expected: PASS (the test file is not part of `tsconfig.json` `include`; it's only typechecked through `tsconfig.test.json` — not strictly needed, but OK).

- [ ] **Step 5:** commit

```bash
git add src/db/client.ts src/db/types.ts test/db/client.spec.ts
git commit -m "feat(db): libsql client factory with foreign_keys pragma"
```

---

## Task 3: `src/util/time.ts` + `src/db/repositories/chats.ts` (TDD)

**Files:** `src/util/time.ts`, `src/db/repositories/chats.ts`, `test/db/chats.spec.ts`.

- [ ] **Step 1:** `src/util/time.ts`:

```ts
export function nowIso(): string {
  return new Date().toISOString();
}
```

- [ ] **Step 2 (failing test first):** `test/db/chats.spec.ts` (Node pool, `:memory:`, apply `src/db/schema.sql` DDL for the `chats` table via `client.executeMultiple`). Cases:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { touchChat, upsertActiveChat, getChat, setChatStatus } from "../src/db/repositories/chats";

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
  beforeEach(async () => { db = await freshDb(); });

  it("touch inserts a new chat as active", async () => {
    await touchChat(db, { id: 100, first_name: "Ada", last_name: "L", username: "ada" });
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
    expect(after?.status).toBe("stopped");       // untouched
    expect(after?.updated_at).toBe(before?.updated_at); // untouched
    expect(after?.last_seen_at).not.toBe(before?.last_seen_at); // refreshed
    expect(after?.first_name).toBe("Bo2");       // profile updated
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
```

- [ ] **Step 3:** run to see it fail

```bash
npx vitest run --config vitest.db.config.ts test/db/chats.spec.ts
```
Expected: FAIL (`Cannot find module '../src/db/repositories/chats'`)

- [ ] **Step 4:** `src/db/repositories/chats.ts` — functional implementation with Drizzle:

```ts
import { eq, sql } from "drizzle-orm";
import { chats } from "../schema";
import { nowIso } from "../../util/time";
import type { Db } from "../types";

export type ChatStatus = "active" | "blocked" | "stopped" | "deleted";

export interface ChatRef {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
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
        // status and updated_at are intentionally NOT updated by touch.
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

export async function setChatStatus(db: Db, id: number, status: ChatStatus): Promise<void> {
  await db
    .update(chats)
    .set({ status, updated_at: nowIso() })
    .where(eq(chats.id, id));
}
```

- [ ] **Step 5:** run to verify it passes

```bash
npx vitest run --config vitest.db.config.ts test/db/chats.spec.ts
```
Expected: PASS

- [ ] **Step 6:** commit

```bash
git add src/util/time.ts src/db/repositories/chats.ts test/db/chats.spec.ts
git commit -m "feat(db): chats repository with touch/upsert/get/setStatus"
```

---

## Task 4: Tighten `src/config.ts` (TURSO required) + update test

**Files:** `src/config.ts`, `test/config.spec.ts`.

- [ ] **Step 1:** in `src/config.ts` make TURSO credentials required:

```ts
TURSO_DATABASE_URL: z.string().url(),
TURSO_AUTH_TOKEN: z.string().min(1),
```

- [ ] **Step 2:** update `test/config.spec.ts` — valid case now includes `TURSO_*`; new cases reject env missing `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`:

```ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config";

const valid = {
  BOT_TOKEN: "123:abc",
  WEBHOOK_SECRET: "s3cr3t",
  TURSO_DATABASE_URL: "libsql://example.turso.io",
  TURSO_AUTH_TOKEN: "token",
};

describe("loadConfig", () => {
  it("parses a valid env with turso", () => {
    const cfg = loadConfig(valid);
    expect(cfg.BOT_TOKEN).toBe("123:abc");
    expect(cfg.TURSO_DATABASE_URL).toBe("libsql://example.turso.io");
    expect(cfg.GEONAMES_USERNAME).toBeUndefined();
  });

  it("rejects missing BOT_TOKEN", () => {
    expect(() => loadConfig({ ...valid, BOT_TOKEN: undefined })).toThrow();
  });

  it("rejects missing WEBHOOK_SECRET", () => {
    expect(() => loadConfig({ ...valid, WEBHOOK_SECRET: undefined })).toThrow();
  });

  it("rejects missing TURSO_DATABASE_URL", () => {
    expect(() => loadConfig({ ...valid, TURSO_DATABASE_URL: undefined })).toThrow();
  });

  it("rejects missing TURSO_AUTH_TOKEN", () => {
    expect(() => loadConfig({ ...valid, TURSO_AUTH_TOKEN: undefined })).toThrow();
  });
});
```

- [ ] **Step 3:** run workers-pool tests (config.spec is Workers pool)

```bash
npx vitest run test/config.spec.ts
```
Expected: PASS

- [ ] **Step 4:** commit

```bash
git add src/config.ts test/config.spec.ts
git commit -m "feat(config): require turso credentials"
```

---

## Task 5: Wire `db` into the bot — private-only middleware + `/start` reactivation

**Files:** `src/bot/bot.ts`, `src/index.ts`.

- [ ] **Step 1:** update `src/bot/bot.ts` — `createBot(config, db)`:

```ts
import { Bot } from "grammy";
import type { AppConfig } from "../config";
import type { Db } from "../db/types";
import { touchChat, upsertActiveChat } from "../db/repositories/chats";
import { STRINGS } from "../i18n/strings";

export function createBot(config: AppConfig, db: Db): Bot {
  const bot = new Bot(config.BOT_TOKEN);

  // Private chats only (invariant 11). Touch the chat on every private message.
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private") return;
    if (ctx.from) {
      await touchChat(db, {
        id: ctx.chat.id,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
        username: ctx.from.username,
      });
    }
    return next();
  });

  bot.command("start", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    await upsertActiveChat(db, {
      id: ctx.chat.id,
      first_name: ctx.from?.first_name,
      last_name: ctx.from?.last_name,
      username: ctx.from?.username,
    });
    await ctx.reply(STRINGS.start.welcome);
  });

  return bot;
}
```

- [ ] **Step 2:** update `src/index.ts` fetch handler to build the db and await the PRAGMA:

```ts
import { webhookCallback } from "grammy";
import { loadConfig } from "./config";
import { verifySecretToken } from "./webhook";
import { createBot } from "./bot/bot";
import { createDb } from "./db/client";

export default {
  async fetch(
    request: Request,
    env: Record<string, string>,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/webhook") {
      return new Response("Not Found", { status: 404 });
    }

    const config = loadConfig(env);
    if (!verifySecretToken(request, config.WEBHOOK_SECRET)) {
      return new Response("Forbidden", { status: 403 });
    }

    const { db, ready } = createDb(config);
    await ready;
    const bot = createBot(config, db);
    return webhookCallback(bot, "cloudflare-mod")(request);
  },

  async scheduled(
    controller: ScheduledController,
    _env: Record<string, string>,
    _ctx: ExecutionContext,
  ): Promise<void> {
    console.log(`scheduled stub: ${controller.cron}`);
  },
};
```

- [ ] **Step 3:** typecheck

```bash
npm run typecheck
```
Expected: PASS

- [ ] **Step 4:** commit

```bash
git add src/bot/bot.ts src/index.ts
git commit -m "feat(bot): wire db, private-only middleware and start reactivation"
```

---

## Task 6: `vitest.db.config.ts` + dual-pool `test` script

**Files:** `vitest.config.ts`, `vitest.db.config.ts`, `package.json`.

- [ ] **Step 1:** update `vitest.config.ts` to exclude `test/db`:

```ts
import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: {
    include: ["test/**/*.spec.ts"],
    exclude: ["test/db/**"],
  },
});
```

- [ ] **Step 2:** `vitest.db.config.ts` (Node pool, includes `test/db`):

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/db/**/*.spec.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3:** update `package.json` `test` script to run both pools:

```json
"test": "vitest run && vitest run --config vitest.db.config.ts"
```

- [ ] **Step 4:** run the full suite

```bash
npm test
```
Expected: all tests pass in both pools (smoke, config, webhook in workers; client, chats in node)

- [ ] **Step 5:** commit

```bash
git add vitest.config.ts vitest.db.config.ts package.json
git commit -m "test: dual-pool layout (workers + node) for db repository tests"
```

---

## Task 7: Update README path reference + DoD gate

**Files:** verify `README.md` (and `AGENTS.md` if needed).

- [ ] **Step 1:** confirm README's apply-schema command points to `src/db/schema.sql`:

```bash
turso db shell <your-db> < src/db/schema.sql
```
Update if it still references `db/schema.sql`.

- [ ] **Step 2:** confirm no remaining references to `db/schema.sql` anywhere:

```bash
grep -rn "db/schema.sql" README.md AGENTS.md docs/milestones.md || echo "no stale references"
```

- [ ] **Step 3:** DoD gate — run all checks

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: all green

- [ ] **Step 4:** confirm no `any`

```bash
grep -rn ": any" src test || echo "No 'any' found"
```

- [ ] **Step 5:** confirm `.env` not in git and no secrets committed

```bash
git status --short .env   # should be empty
```

- [ ] **Step 6:** final commit if any docs/path fixes

```bash
git add README.md
git commit -m "docs: point schema apply command at src/db/schema.sql"
```

---

## Self-review (against M1 spec)

- **Apply `schema.sql` to Turso; run `PRAGMA foreign_keys = ON` on every connection** → T2 (README docs in T7) ✓
- **`src/db/client.ts` + `src/db/schema.ts` Drizzle kept in sync by hand** → T1, T2 ✓ (all 5 tables, in sync now)
- **`src/db/repositories/chats.ts`: create-or-touch on interaction; get; set status** → T3 ✓
- **Chat lifecycle: on `/start` upsert and set `status='active'` (reactivating from blocked/stopped/deleted). Timestamps ISO 8601 UTC.** → T3 (`upsertActiveChat`), T5 ✓
- **Ignore messages from non-private chats** → T5 middleware (invariant 11) ✓
- **`src/i18n/strings.ts` (Italian, user-facing) — start the centralized strings module** → exists from M0 ✓
- **DoD: first `/start` inserts; later `/start` after non-active resets to active; group messages ignored; unit tests for chats repo and status transitions** → T3, T5, T7 ✓

**Refs coverage:** SRS 3.6 (FR-6.1–6.5) → T3/T5; SRS 6.1 (chats) → T1/T3; SRS 6.6 (indexes/relations) → T1; NFR-5.1 (strict TS) → all tasks; NFR-5.2 (hand-written schema) → T1 (moved, no drizzle-kit). AGENTS invariants 11 (private only) and 12 (`/stop` deactivates — `setChatStatus` ready for M2) → T3/T5.
