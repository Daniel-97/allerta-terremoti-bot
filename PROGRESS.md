# allerta-terremoti-bot — Progress

**Last updated:** 2026-06-30
**Current milestone:** M2 (User interaction) — NOT STARTED

---

## Completed milestones

### M0 — Scaffold & deployed "hello world" ✅

- TypeScript strict, ESLint flat config, Prettier, Vitest + `@cloudflare/vitest-pool-workers`
- `src/index.ts`: fetch handler with `webhookCallback(bot, "cloudflare-mod")` + `X-Telegram-Bot-Api-Secret-Token` verification against `WEBHOOK_SECRET`
- `src/config.ts`: zod-validated env (`BOT_TOKEN`, `WEBHOOK_SECRET` required; others optional with empty-string-as-undefined handling)
- `src/bot/bot.ts`: `createBot` with `/start` reply (placeholder Italian message via `src/i18n/strings.ts`)
- `src/webhook.ts`: `verifySecretToken`
- `wrangler.jsonc`: 3 cron triggers (`* * * * *`, `*/5 * * * *`, `0 3 * * *`); `scheduled` handler is a stub
- `scripts/set-commands.ts`: isolated `npm run set-commands` registers `/start`
- Single production environment (`.env.example` documented)
- **DoD verified:** lint/typecheck/test/build green; 7 tests pass
- **Note:** production deploy + Telegram webhook registration documented in README but not executed (no Cloudflare account / bot token at the time)

### M0a — Logging foundation ✅

- SRS: added **NFR-5.8** (Logging operativo) — JSON-lines format, levels info/warn/error, 7 required log points (requests, commands, cron cycles, delivery errors, broadcasts, INGV polling, admin notifications). PII allowed (public Telegram data). No filter — all levels always pass. Zero-dependency implementation.
- AGENTS: new invariant #13 — all logs go through `src/util/log.ts`; no `console.log`/`warn`/`error` scattered in application code.
- `src/util/log.ts`: `createLogger(name)` and `logger.child(fields)`. JSON-lines via `console.log/warn/error`. `{ ts, level, logger, ...fields, msg }`. Zero dependencies. API compatible with `pino`-style.
- `src/index.ts`: logs every fetch request (method, path, status, durationMs) and every scheduled trigger (cron expr, durationMs).
- `src/bot/bot.ts`: logs every user touch (chatId, userId, first_name, username) and every command (chatId, command, outcome).
- All scripts (`apply-schema`, `set-commands`, `start-polling`, `simulate-update`) use `log.info/error` instead of `console.log/error`.
- **Tests:** `test/log.spec.ts` (5 tests in workers pool) — verifies JSON format, levels, child binding, field merging.
- **DoD verified:** 20 total tests (14 workers + 6 db), all green.

### M1 — Data foundation & config ✅

- `db/schema.sql` moved to `src/db/schema.sql` (AGENTS location); empty `db/` removed
- `src/db/schema.ts`: Drizzle table defs for all 5 tables (chats, locations, history, deliveries, system_state) kept in sync with `schema.sql` by hand
- `src/db/client.ts`: `createDb(config)` returns `{ db, ready }`; uses `@libsql/client` + `drizzle-orm/libsql` (auto web/native switching); runs `PRAGMA foreign_keys = ON` on every connection
- `src/db/types.ts`: shared `Db` type
- `src/db/repositories/chats.ts`: `touchChat`, `upsertActiveChat`, `getChat`, `setChatStatus` — functional style
- `src/util/time.ts`: `nowIso()` for ISO 8601 UTC timestamps
- `src/config.ts`: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` now required; empty string env vars treated as absent
- `src/bot/bot.ts`: private-only middleware (`ctx.chat?.type !== "private"` returns) + `touchChat` on every private message + `/start` calls `upsertActiveChat` (reactivates from blocked/stopped/deleted, sets `status='active'`, refreshes `updated_at`)
- `src/index.ts`: `createDb` awaited before `createBot`
- **Tests:** `test/db/chats.spec.ts` (5) + `test/db/client.spec.ts` (1) in **Node pool** via `vitest.db.config.ts` against libSQL `:memory:`; `npm test` runs both pools (9 workers-pool tests + 6 db-pool tests = 15 total)
- Scripts:
  - `npm run db:apply` — applies `src/db/schema.sql` to Turso via libSQL client (bypasses `loadConfig`, only needs `TURSO_*`); idempotent
  - `npm run start-polling` — grammY polling mode for local testing (real Telegram)
  - `npm run simulate` — sends fake `/start` update to `wrangler dev`
- **DoD verified:** lint/typecheck/test/build all green

---

## Current state of the codebase

```
src/
  index.ts            # fetch (webhook + secret verify) + scheduled stub
  config.ts           # zod env (BOT_TOKEN, WEBHOOK_SECRET, TURSO_* required)
  webhook.ts          # verifySecretToken
  bot/bot.ts          # createBot(config, db) — private-only middleware + /start
  i18n/strings.ts     # STRINGS.start.welcome (Italian)
  db/
    schema.sql        # hand-written DDL (source of truth)
    schema.ts         # Drizzle defs for all 5 tables
    client.ts         # createDb + PRAGMA foreign_keys=ON
    types.ts          # Db type
    repositories/chats.ts  # touch/upsert/get/setStatus
  util/time.ts        # nowIso()
scripts/
  set-commands.ts     # npm run set-commands
  apply-schema.ts     # npm run db:apply
  start-polling.ts    # npm run start-polling (local testing)
  simulate-update.ts  # npm run simulate (local testing)
test/
  smoke.spec.ts       # workers pool
  webhook.spec.ts     # workers pool
  config.spec.ts      # workers pool
  db/
    client.spec.ts    # node pool + libsql :memory:
    chats.spec.ts     # node pool + libsql :memory:
vitest.config.ts      # workers pool, excludes test/db
vitest.db.config.ts   # node pool for test/db
wrangler.jsonc        # 3 cron triggers, stub scheduled handler
```

### Test gate (run before each milestone)

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- 20 tests across 2 pools (14 workers + 6 db), all must pass
- No `any`, no committed secrets, no Workers-incompatible deps

### Database

- Single Turso database, schema applied via `npm run db:apply`
- Connection via `@libsql/client` (web/native auto-detected based on runtime)
- No drizzle-kit / auto migrations (hand-written `schema.sql` only)

### Configuration (`.env.example`)

| Variable | Required since |
|---|---|
| `BOT_TOKEN` | M0 |
| `WEBHOOK_SECRET` | M0 |
| `TURSO_DATABASE_URL` | M1 |
| `TURSO_AUTH_TOKEN` | M1 |
| `GEONAMES_USERNAME` | M2 (optional before) |
| `ADMIN_CHAT_IDS` | M4 (optional before) |
| `HEALTHCHECKS_URL` | M3 (optional before) |
| `MAX_ATTEMPTS` | optional, code constant fallback |

Empty strings in `.env` are treated as absent (handled in `config.ts` preprocess step).

---

## Milestones pending

### M2 — User interaction (inline-first) — NEXT

- Location intake: reply keyboard with `request_location`; accept location/venue; reverse-geocode via GeoNames (`src/geocoding/geonames.ts`); name as `Comune (PROV)`; reject outside IT/SM/AT/CH; enforce `(chat, name)` uniqueness and 10-locations cap with explicit checks
- Settings: per-location `radius` and `magnitude_threshold` via inline presets; global `italy_alerts` / `world_alerts` toggles
- Inline panel pattern: single message that edits itself in place; all navigation context in `callback_data` (≤ 64 bytes); compact scheme per SRS 8.2
- Commands: `/posizioni`, `/impostazioni`, `/aiuto`, `/stop`, `/credits`; `/start`/`/aiuto` must state national alerts are on by default; `/stop` deactivates (keeps data) and notifies admin (stub ok)
- Location removal with two-tap inline confirmation
- Tests: geocoding fallback + callback_data encode/decode

**Refs:** SRS 3.1, 3.2, 3.7 (FR-7), 7.6; AGENTS (invariants 1–3, 8–10).

### M3 — Detection & notification (core)

INGV polling, event matching (Haversine + bounding box; proximity / national / world eligibility), message composition, delivery with idempotency.

### M4 — Reliability & operations

Retry cron, cleanup cron, watchdog, admin commands (`/broadcast`, `/stats`, `/events`, `/delivery`, `/health`), admin push notifications.

### M5 — Hardening

Rate-limit handling, structured logging, overlap lock, invariant review, end-to-end README verification.

---

## Key decisions taken so far

- TypeScript strict + `exactOptionalPropertyTypes: true`
- ESLint 10 flat config (`eslint.config.js`, not `.eslintrc`)
- ESM throughout (`"type": "module"` in `package.json`)
- **No drizzle-kit / auto migrations** — `schema.sql` is hand-written and source of truth; `src/db/schema.ts` kept in sync by hand
- Two Vitest pools: Workers pool (src code) + Node pool (DB repos against libSQL `:memory:`; web client doesn't support `:memory:`)
- `setMyCommands` runs as isolated script (`npm run set-commands`), not inside Worker (stateless)
- `callback_data` compact scheme (SRS 8.2); enforced ≤ 64 bytes
- No stub folders created in M0/M1 (`jobs/`, `ingv/`, `geocoding/`, `notify/`, `geo/` appear in their milestones)
- Local testing via `npm run start-polling` (polling → real Telegram) or `npm run simulate` (fake update to `wrangler dev`)
- `/stop` not yet wired; `setChatStatus` in `chats.ts` ready for it
- Structured logging via `src/util/log.ts` (zero-dependency, JSON-lines, Pino-compatible API). NFR-5.8. No LOG_LEVEL filter — all levels always pass. PII allowed (public Telegram data). Invariant #13

---

## How to start a new coding session

1. Read `AGENTS.md` (invariants, anti-goals, structure)
2. Read `MILESTONES.md` (full milestone spec)
3. Read this file for current state + completed work
4. Check `.opencode/plans/` for an existing plan for the current milestone
5. Run the test gate (`npm run lint && npm run typecheck && npm test && npm run build`) to confirm baseline green before starting
