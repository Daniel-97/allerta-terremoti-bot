# allerta-terremoti-bot — Progress

**Last updated:** 2026-06-30
**Current milestone:** M2 (User interaction) — COMPLETED ✅

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

### M2 — User interaction (inline-first) ✅

- **Location intake (FR-1):** reply keyboard with `request_location`; location/venue accepted; reverse-geocode via GeoNames (`src/geocoding/geonames.ts`) with 4s timeout + graceful fallback; name as `Comune (PROV)`; reject outside IT/SM/AT/CH (bounding boxes in `src/util/geo-bbox.ts`); enforce `(chat, name)` uniqueness + 10-locations cap with explicit, friendly checks.
- **Settings (FR-2):** per-location `radius` (25–300 km presets) and `magnitude_threshold` (2.0–5.0 presets) via inline buttons; global `italy_alerts` / `world_alerts` toggles via `setAlertFlags`.
- **Inline panel pattern (FR-7.6):** single message that edits itself in place (`src/bot/inline/panels.ts`). All navigation context in `callback_data` (`src/util/callback-data.ts`, `;` scheme, ≤ 64 bytes). Router dispatch in `src/bot/inline/router.ts`.
- **Commands:** `/posizioni`, `/impostazioni`, `/aiuto`, `/stop`, `/credits` registered in Telegram menu. `/start` states national alerts are on by default. `/stop` deactivates (keeps data, sets `stopped`) with admin notification stub (`TODO M4`).
- **Location removal** with two-tap inline confirmation (delete → confirm).
- **Logging NFR-5.8.2:** every command and every callback query logged (chatId, userId, first_name, command/callback, outcome).
- **Files:** `src/geocoding/geonames.ts`, `src/util/callback-data.ts`, `src/util/geo-bbox.ts`, `src/util/constants.ts`, `src/db/repositories/locations.ts`, `src/bot/inline/{keyboards,panels,router}.ts`, `src/bot/commands/{start,aiuto,posizioni,impostazioni,stop,credits}.ts`, `src/bot/location-intake.ts`. `src/i18n/strings.ts` expanded with all Italian M2 strings.
- **Tests:** `test/util/callback-data.spec.ts` (12), `test/util/geo-bbox.spec.ts` (9), `test/geocoding/geonames.spec.ts` (5 — mock fetch), `test/db/locations.spec.ts` (10 — node pool), `test/db/chats-alerts.spec.ts` (3 — node pool).
- **DoD verified:** 60 total tests (41 workers + 19 db), all green.

### M2a — Error logging enrichment ✅

- `SRS.md`: added **FR-10.6** — external service errors logged in structured format with full detail (HTTP status, body excerpt, error name/message, context). No Telegram admin push in v1 to avoid rate-limit conflicts with seismic alerts. Admin push via Telegram deferred to M4 with rate-limit handling.
- `AGENTS.md`: new invariant #14 — external service errors are logged, not pushed to admin in v1.
- `src/geocoding/geonames.ts`: enriched logging — distinguishes client error (4xx) vs server error (5xx) vs network error (catch). HTTP response body included (first 500 chars). Error name and message included for network/timeout errors.
- **Tests:** `test/geocoding/geonames.spec.ts` (7 tests, +2 for enriched log fields).
- **DoD verified:** 66 total tests (47 workers + 19 db), all green.

---

```
src/
  index.ts            # fetch (webhook + secret verify) + scheduled stub
  config.ts           # zod env (BOT_TOKEN, WEBHOOK_SECRET, TURSO_* required)
  webhook.ts          # verifySecretToken
  bot/
    bot.ts            # createBot(config, db) — all commands + callback router + location intake
    commands/{start,aiuto,posizioni,impostazioni,stop,credits}.ts
    inline/{keyboards,panels,router}.ts
    location-intake.ts  # reply keyboard + location/venue handler + geocoding + validation
  i18n/strings.ts     # all M2 Italian strings (commands, panels, errors)
  geocoding/geonames.ts  # reverse geocode via GeoNames
  db/
    schema.sql        # hand-written DDL (source of truth)
    schema.ts         # Drizzle defs for all 5 tables
    client.ts         # createDb + PRAGMA foreign_keys=ON
    types.ts          # Db type
    repositories/{chats,locations}.ts  # touch/upsert/get/setStatus + setAlertFlags; locations CRUD
  util/
    time.ts           # nowIso()
    log.ts            # structured JSON-lines logger
    callback-data.ts  # compact ; scheme encode/decode
    geo-bbox.ts       # IT/SM/AT/CH bounding boxes
    constants.ts      # MAX_LOCATIONS_PER_USER, thresholds
scripts/
  set-commands.ts     # npm run set-commands
  apply-schema.ts     # npm run db:apply
  start-polling.ts    # npm run start-polling (local testing)
  simulate-update.ts  # npm run simulate (local testing)
test/
  smoke.spec.ts           # workers pool
  webhook.spec.ts         # workers pool
  config.spec.ts          # workers pool
  log.spec.ts             # workers pool
  util/
    callback-data.spec.ts # workers pool
    geo-bbox.spec.ts      # workers pool
  geocoding/geonames.spec.ts  # workers pool (mock fetch)
  db/
    client.spec.ts        # node pool + libsql :memory:
    chats.spec.ts         # node pool + libsql :memory:
    chats-alerts.spec.ts  # node pool + libsql :memory:
    locations.spec.ts     # node pool + libsql :memory:
vitest.config.ts      # workers pool, excludes test/db
vitest.db.config.ts   # node pool for test/db
wrangler.jsonc        # 3 cron triggers, stub scheduled handler
```

### Test gate (run before each milestone)

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- 60 tests across 2 pools (41 workers + 19 db), all must pass
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
| `GEONAMES_USERNAME` | M2 |
| `ADMIN_CHAT_IDS` | M4 (optional before) |
| `HEALTHCHECKS_URL` | M3 (optional before) |
| `MAX_ATTEMPTS` | optional, code constant fallback |

Empty strings in `.env` are treated as absent (handled in `config.ts` preprocess step).

---

## Milestones pending

### M3 — Detection & notification (core) — NEXT

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
- Structured logging via `src/util/log.ts` (zero-dependency, JSON-lines, Pino-compatible API). NFR-5.8. No LOG_LEVEL filter — all levels always pass. PII allowed (public Telegram data). Invariants #13, #14
- External service errors logged with full detail (HTTP status, body, error type, context). **No Telegram admin push in v1** to conserve rate-limit for seismic alerts (FR-10.6). Admin push via Telegram introduced in M4 with rate-limit handling.
- Inline panels via `src/bot/inline/` (edit-in-place, compact callback_data scheme, router dispatch)
- `src/util/callback-data.ts`: compact `;` scheme per SRS 8.2; ≤ 64 bytes enforced
- `src/geocoding/geonames.ts`: reverse geocode via GeoNames with 4s timeout + graceful fallback (returns null)
- Area validation via bounding boxes in `src/util/geo-bbox.ts` (IT/SM/AT/CH)
- `/stop` sets `stopped` status, keeps data; admin notification stub (`TODO M4`)
- Every slash command and every callback query logged (NFR-5.8.2)

---

## How to start a new coding session

1. Read `AGENTS.md` (invariants, anti-goals, structure)
2. Read `MILESTONES.md` (full milestone spec)
3. Read this file for current state + completed work
4. Check `.opencode/plans/` for an existing plan for the current milestone
5. Run the test gate (`npm run lint && npm run typecheck && npm test && npm run build`) to confirm baseline green before starting
