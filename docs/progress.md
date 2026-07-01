# allerta-terremoti-bot — Progress

**Last updated:** 2026-06-30
**Current milestone:** M3 (Detection & notification) — COMPLETED ✅

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
- **Commands:** `/posizioni`, `/impostazioni`, `/aiuto`, `/stop`, `/credits` registered in Telegram menu. `/start` states national alerts are on by default. `/stop` deactivates (keeps data, sets `stopped`) and notifies admin via `notifyUserStop`.
- **Location removal** with two-tap inline confirmation (delete → confirm).
- **Logging NFR-5.8.2:** every command and every callback query logged (chatId, userId, first_name, command/callback, outcome).
- **Files:** `src/geocoding/geonames.ts`, `src/util/callback-data.ts`, `src/util/geo-bbox.ts`, `src/util/constants.ts`, `src/db/repositories/locations.ts`, `src/bot/inline/{keyboards,panels,router}.ts`, `src/bot/commands/{start,aiuto,posizioni,impostazioni,stop,credits}.ts`, `src/bot/location-intake.ts`. `src/i18n/strings.ts` expanded with all Italian M2 strings.
- **Tests:** `test/util/callback-data.spec.ts` (12), `test/util/geo-bbox.spec.ts` (9), `test/geocoding/geonames.spec.ts` (5 — mock fetch), `test/db/locations.spec.ts` (10 — node pool), `test/db/chats-alerts.spec.ts` (3 — node pool).
- **DoD verified:** 60 total tests (41 workers + 19 db), all green.

### M2a — Error logging enrichment ✅

- `SRS.md`: added **FR-10.6** — external service errors logged in structured format with full detail (HTTP status, body excerpt, error name/message, context). Admin push via Telegram implemented in M4 (best-effort fire-and-forget).
- `AGENTS.md`: new invariant #14 — external service errors are logged, not pushed to admin in v1.
- `src/geocoding/geonames.ts`: enriched logging — distinguishes client error (4xx) vs server error (5xx) vs network error (catch). HTTP response body included (first 500 chars). Error name and message included for network/timeout errors.
- **Tests:** `test/geocoding/geonames.spec.ts` (7 tests, +2 for enriched log fields).
- **DoD verified:** 66 total tests (47 workers + 19 db), all green.

### M3 — Detection & notification (the core) ✅

- **INGV client (`src/ingv/`):** FDSN text format parser with zod validation; `fetchItalyEvents` (Italian bbox, no mag floor) and `fetchWorldEvents` (global ≥ WORLD_ALERT_THRESHOLD); both restricted to `LOOKBACK_WINDOW` via `starttime`. Realistic fixture for tests.
- **Dedup:** `history` repository `insertIfNew` uses `ON CONFLICT DO NOTHING` on `history.id`.
- **Haversine:** `src/geo/haversine.ts` — distance function with tests (Roma–Milano ~480 km, Roma–NY ~6900 km).
- **Matching (`src/notify/match.ts`):** union of proximity (per-location distance + magnitude threshold), national (in `ITALY_BBOX` ≥ `ITALY_ALERT_THRESHOLD` + `italy_alerts` toggle), and world (≥ `WORLD_ALERT_THRESHOLD` + `world_alerts` toggle). Nearest-location selection. One `Recipient` per user. Ordered by distance ascending (FR-4.7).
- **Compose (`src/notify/compose.ts`):** 3 message formats: proximity, national (omits distance if no location), world (no personal distance). INGV page URL: `https://terremoti.ingv.it/event/<id>`. Buttons: Dettagli + INGV page. Time in `Europe/Rome`.
- **Deliver (`src/notify/deliver.ts`):** `deliveries` rows idempotent (`ON CONFLICT DO NOTHING`), sends via `bot.api.sendMessage`, ~30/s rate (33ms sleep). Permanent errors → `setChatStatus('blocked')`; transient → marked for retry. Logs every delivery error (NFR-5.8.4).
- **Main cron (`src/jobs/poll.ts`):** dead-man's-switch ping → fetch INGV (italy + world) → dedup → match → deliver first wave → save event. Logs cycle stats (NFR-5.8.6).
- **Scheduled routing (`src/index.ts`):** dispatches by `event.cron` to main cron (`* * * * *`), retry (`*/5`), and cleanup (`0 3`).
- **Details callback (`ev;<id>;det`):** reads event from `history`; if found, replies with new message (coords, depth, magnitude, stations, time); if gone, graceful "Dettagli non più disponibili." (FR-4.12).
- **Tests:** `test/ingv/parser.spec.ts` (6), `test/geo/haversine.spec.ts` (4), `test/db/m3-repos.spec.ts` (9), `test/db/match.spec.ts` (2), `test/notify/errors.spec.ts` (6), `test/notify/compose.spec.ts` (7).
- **DoD verified:** 114 total tests (75 workers + 39 db), all green.

---

```
src/
  index.ts            # fetch (webhook + secret verify) + scheduled routing (main/retry/cleanup)
  config.ts           # zod env (BOT_TOKEN, WEBHOOK_SECRET, TURSO_* required)
  webhook.ts          # verifySecretToken
  bot/
    bot.ts            # createBot(config, db) — all commands + callback router + location intake
    commands/{start,aiuto,posizioni,impostazioni,stop,credits}.ts
    commands/{broadcast,stats,events,delivery,health}.ts  # admin commands (gated)
    inline/{keyboards,panels,router}.ts
    location-intake.ts  # reply keyboard + location/venue handler + geocoding + validation
  i18n/strings.ts         # all M2 Italian strings (commands, panels, errors)
  i18n/admin-strings.ts   # English admin-facing strings (M4)
  ingv/{types,parser,client}.ts  # FDSN text format, Italy + world queries
  geo/haversine.ts                    # distance function
  notify/{errors,match,compose,deliver,admin}.ts  # error classification, recipient matching, message composition, delivery, admin push
  jobs/{poll,retry,cleanup}.ts        # cron orchestrators (main, retry, cleanup)
  geocoding/geonames.ts  # reverse geocode via GeoNames
  db/
    schema.sql        # hand-written DDL (source of truth)
    schema.ts         # Drizzle defs for all 5 tables
    client.ts         # createDb + PRAGMA foreign_keys=ON
    types.ts          # Db type
    repositories/{chats,locations,deliveries,history,system-state}.ts  # data access for all 5 tables
  util/
    time.ts           # nowIso()
    log.ts            # structured JSON-lines logger
    callback-data.ts  # compact ; scheme encode/decode
    geo-bbox.ts       # IT/SM/AT/CH bounding boxes
    constants.ts      # MAX_LOCATIONS_PER_USER, thresholds, MAX_ATTEMPTS
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
wrangler.jsonc        # 3 cron triggers: main (* * * * *), retry (*/5), cleanup (0 3)
```

### Test gate (run before each milestone)

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- 114 tests across 2 pools (75 workers + 39 db), all must pass
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

None — all milestones completed.

---

## M5 — Hardening ✅

- **Fixed `src/notify/errors.ts` bug:** `msg.includes("5")` was removed — it incorrectly classified permanent errors containing the digit "5" as transient. The fallback `return "transient"` already catches legitimate unclassified errors. 2 new tests added (permanent with "5" stays permanent; 503 transient).
- **Rate-limit handling:** 429 responses already classified as `failed_transient` and retried by the retry cron. No custom `retry_after` logic needed for v1 (accepted simplification).
- **Overlap lock:** Skipped for v1 — idempotency via `history.id` + `deliveries(event_id, chat) ON CONFLICT DO NOTHING` is sufficient. Decision documented in README.
- **Invariant review:**
  - AGENTS.md invariant 14 updated: admin push via Telegram is now implemented (M4), best-effort fire-and-forget
  - SRS FR-10.1/10.2/10.6 updated: watchdog simplified (immediate alert, no threshold/counter/recovery); admin push now active
- **README verification:** stale references to `INGV_FAILURE_ALERT_THRESHOLD` removed; monitoring section updated; project structure updated for `admin-strings.ts`; overlap lock decision documented.
- **Onboarding copy:** reviewed and accepted as-is (`/start` and `/aiuto` already clear).
- **DoD verified:** 116 total tests (77 workers + 39 db), all green.

---

## M4 — Reliability & operations ✅

- **Retry cron (`src/jobs/retry.ts`):** re-sends `failed_transient` deliveries with `attempts < MAX_ATTEMPTS`. Re-evaluates eligibility via `matchChat` (if user no longer eligible → skip). Composes via shared `composeMessage` from `compose.ts`. Rate-limited (33ms/send). Logs cycle stats.
- **Cleanup cron (`src/jobs/cleanup.ts`):** daily job deletes `deliveries` older than 90 days and `history` rows with no deliveries older than the lookback window (60 min).
- **Watchdog:** INGV fetch errors thrown (not swallowed) by `client.ts`; `poll.ts` catches and immediately notifies admin via `notify/admin.ts`. No counter, no threshold, no edge-triggering — error → alert, simple.
- **Admin commands (gated by `ADMIN_CHAT_IDS`, silently ignored for non-admins):**
  - `/broadcast <message>` — direct send to all active users; validates >0 and ≤4096 chars; rate-limited; errors → `blocked` status; logs admin, timestamp, count
  - `/stats` — users by status (total/active/stopped/blocked/deleted), locations count, last event, last polling timestamp
  - `/events` — last 10 processed events with ID, magnitude, zone, date
  - `/delivery <event_id>` — delivery rows per event with status counts (sent/pending/transient/permanent)
  - `/health` — pings Telegram API, INGV, GeoNames, Turso; all errors logged via `log.warn`
  - All admin text in English (`src/i18n/admin-strings.ts`); not registered in public menu
- **Admin push notifications (best-effort / fire-and-forget):**
  - `notifyNewUser`: sent on first-ever chat interaction (detected via `getChat` pre-check)
  - `notifyEventSummary`: sent after each delivery wave with recipients ≥ 1 (magnitude, zone, ID, counts)
  - `notifyUserStop`: sent when user runs `/stop`
  - `notifyIngvFailure`: sent on any INGV fetch error
  - All notifications use `bot.api.sendMessage` wrapped in try/catch; never block the main flow
- **Config:** `ADMIN_CHAT_IDS` env var parsed into `number[]`; `MAX_ATTEMPTS` env var with code-constant fallback (3); new `RuntimeConfig` interface extends `AppConfig`
- **Refactors:** `composeMessage` extracted from `deliver.ts` into `compose.ts` (shared); `matchChat` exported from `match.ts`; `fetchText` throws on error instead of returning `[]`
- **Tests:** `test/db/retry.spec.ts` (4), `test/db/cleanup.spec.ts` (5), `test/config.spec.ts` updated (4 for ADMIN_CHAT_IDS parsing)
- **DoD verified:** 114 total tests (75 workers + 39 db), all green.

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
- `/stop` wired with admin notification via `notifyUserStop`; `setChatStatus` in `chats.ts` ready for it
- Structured logging via `src/util/log.ts` (zero-dependency, JSON-lines, Pino-compatible API). NFR-5.8. No LOG_LEVEL filter — all levels always pass. PII allowed (public Telegram data). Invariants #13, #14
- External service errors logged with full detail (HTTP status, body, error type, context). Admin push via Telegram implemented in M4 (best-effort fire-and-forget, no rate-limit issues observed).
- Inline panels via `src/bot/inline/` (edit-in-place, compact callback_data scheme, router dispatch)
- `src/util/callback-data.ts`: compact `;` scheme per SRS 8.2; ≤ 64 bytes enforced
- `src/geocoding/geonames.ts`: reverse geocode via GeoNames with 4s timeout + graceful fallback (returns null)
- Area validation via bounding boxes in `src/util/geo-bbox.ts` (IT/SM/AT/CH)
- `/stop` deactivates (keeps data, sets `stopped`) and notifies admin via `notifyUserStop`
- Every slash command and every callback query logged (NFR-5.8.2)
- INGV FDSN text format parser with zod validation; Italy + world queries; dedup via `history.id ON CONFLICT DO NOTHING`
- Haversine distance + union eligibility matching (proximity/national/world) + nearest location per user
- Delivery idempotent via `deliveries(event_id, chat) ON CONFLICT DO NOTHING`; permanent error → `setChatStatus(blocked)`
- Rate limiting via sleep(33ms) between sends (~30/s); proper `retry_after` handling deferred to M5
- Details callback responds with a new message (not edit-in-place)
- INGV event page URL: `https://terremoti.ingv.it/event/<id>`
- `scheduled` handler routes by `event.cron` to main, retry (`*/5`), and cleanup (`0 3`) crons.

---

## How to start a new coding session

1. Read `AGENTS.md` (invariants, anti-goals, structure)
2. Read `docs/milestones.md` (full milestone spec)
3. Read this file for current state + completed work
4. Check `.opencode/plans/` for an existing plan for the current milestone
5. Run the test gate (`npm run lint && npm run typecheck && npm test && npm run build`) to confirm baseline green before starting
