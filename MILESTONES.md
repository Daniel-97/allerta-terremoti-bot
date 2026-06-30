# allerta-terremoti-bot — Implementation Plan (Milestones)

This is the implementation plan for allerta-terremoti-bot. Work through the milestones **in order**,
one at a time. Each milestone is a self-contained task with an objective, scope, and a
**Definition of Done (DoD)** that must be fully met before moving on.

**Before starting any milestone, read `AGENTS.md` and the relevant parts of
`allerta-terremoti-bot-SRS.md`.** `AGENTS.md` invariants and anti-goals apply at all times.
`schema.sql` is the source of truth for the database.

**Definition of Done applies to every milestone** (in addition to its specific DoD):
`npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all pass. No `any`,
no committed secrets, no Workers-incompatible dependencies.

Guiding principle: build a **thin vertical slice first** (a deployed bot that replies),
then grow it. Do not build all layers horizontally.

---

## M0 — Scaffold & deployed "hello world"

**Objective:** a TypeScript Cloudflare Worker deployed to production that answers `/start`
in a private chat, with the full quality toolchain in place.

**Scope:**
- Initialize the project: TypeScript (strict), ESLint + Prettier, Vitest +
  `@cloudflare/vitest-pool-workers`, `wrangler.jsonc`.
- Create the folder structure from `AGENTS.md` (empty/stub modules are fine).
- `src/index.ts` with a `fetch` handler wiring grammY via
  `webhookCallback(bot, "cloudflare-mod")`; verify the `X-Telegram-Bot-Api-Secret-Token`
  header against `WEBHOOK_SECRET`.
- `src/config.ts`: parse and validate env/secrets with zod; the only place env is read.
- Minimal bot: `/start` replies with a placeholder message. Register user commands via
  `setMyCommands`.
- `.dev.vars.example` documented; deploy to production; set the webhook with a secret token.

**DoD:**
- Sending `/start` to the production bot returns a reply.
- Webhook rejects requests with a missing/wrong secret token.
- Lint/typecheck/test/build green; a trivial test runs under the Workers pool.

**Refs:** SRS 7.1–7.3, 7.9, NFR-4.2; AGENTS (structure, validation).

---

## M1 — Data foundation & config

**Objective:** the database and data-access layer exist, and chats are created/reactivated
correctly.

**Scope:**
- Apply `schema.sql` to the Turso database (document the command). Run
  `PRAGMA foreign_keys = ON` on every connection.
- `src/db/client.ts` (libSQL/Drizzle) and `src/db/schema.ts` (Drizzle table defs kept in
  sync with `schema.sql` by hand).
- `src/db/repositories/chats.ts`: create-or-touch a chat on interaction; get; set status.
- Chat lifecycle: on `/start`, upsert the chat and set `status = 'active'` (reactivating
  from `blocked` / `stopped` / `deleted`). Timestamps as ISO 8601 UTC.
- Ignore messages from non-private chats (groups/supergroups/channels).
- `src/i18n/strings.ts` (Italian, user-facing) — start the centralized strings module.

**DoD:**
- First-ever `/start` inserts a chat; a later `/start` after a non-active status resets it
  to `active`.
- Group messages are ignored.
- Unit tests for the chats repository and the status transitions.

**Refs:** SRS 3.6 (FR-6), 6.1, 6.6, NFR-5.1/5.2; AGENTS (database, invariants 11–12).

---

## M2 — User interaction (inline-first)

**Objective:** a user can fully configure themselves — locations and settings — through
inline panels. No alerts yet.

**Scope:**
- **Location intake (FR-1):** reply keyboard with `request_location`; accept location/venue;
  reverse-geocode via GeoNames (`src/geocoding/geonames.ts`) with short timeout + graceful
  fallback; name as `Comune (PROV)`; reject outside IT/SM/AT/CH; enforce `(chat, name)`
  uniqueness and the 10-locations cap with explicit, friendly checks.
- **Settings (FR-2):** per-location `radius` and `magnitude_threshold` via inline presets;
  global `italy_alerts` / `world_alerts` toggles.
- **Inline panel pattern (FR-7.6):** a single message that edits itself in place
  (list → location detail → presets → back). All navigation context in `callback_data`
  (≤ 64 bytes); define the compact scheme (see SRS 8.2).
- **Commands:** `/posizioni`, `/impostazioni`, `/aiuto`, `/stop`, `/credits`.
  `/start` and/or `/aiuto` must state that national alerts are on by default (FR-7.1.1).
  `/stop` deactivates (keeps data) and notifies admin (wire the admin push in M4 if not yet
  available; a stub is acceptable here).
- Location removal with two-tap inline confirmation.

**DoD:**
- A user can add/list/remove locations, hit the cap and uniqueness messages, set radius &
  magnitude from presets, and toggle both alert preferences — all via buttons.
- No free-text value entry anywhere; reply keyboard used only for `request_location`.
- All `callback_data` stays within 64 bytes.
- Tests for the geocoding fallback and the callback_data encode/decode.

**Refs:** SRS 3.1, 3.2, 3.7 (FR-7), 7.6; AGENTS (invariants 1–3, 8–10).

---

## M3 — Detection & notification (the core)

**Objective:** new INGV events are detected and the right users are alerted, in a single
main-cron run, with idempotent delivery tracking.

**Scope:**
- **INGV client (`src/ingv/`):** fetch events with FDSN filters — Italy query over
  `ITALY_BBOX` (lat 35–48, lon 6–27) with a low magnitude floor, plus a global query for
  `magnitude ≥ WORLD_ALERT_THRESHOLD`; restrict to `LOOKBACK_WINDOW` via `starttime`. Prefer
  the FDSN text format; parse and validate (zod). Keep a real INGV response as a test fixture.
- **Dedup:** claim each event by unique `history.id`; store all processed events (FR-3.6).
- **Matching (`src/notify/match.ts`):** Haversine + bounding-box pre-filter; union of
  proximity / national / world eligibility; nearest-location selection; one message per user
  (FR-4.4). National = within `ITALY_BBOX` and ≥ `ITALY_ALERT_THRESHOLD`; world ≥
  `WORLD_ALERT_THRESHOLD` (never below 6.0).
- **Compose (`src/notify/compose.ts`):** text-only; clean magnitude in the main line (type in
  Details); proximity/national format vs world format (no personal distance); inline buttons
  Details + INGV page. Times in `Europe/Rome` via `Intl.DateTimeFormat`.
- **Deliver (`src/notify/deliver.ts`, `errors.ts`):** write `deliveries` rows
  (`INSERT ... ON CONFLICT DO NOTHING`), send respecting Telegram rate (~30/s), update status;
  classify permanent vs transient; permanent → update chat status.
- **Main cron:** dead-man's-switch ping at start → poll → match → deliver first wave → save
  event. Wire `event.cron` routing in the `scheduled` handler.
- **Details callback:** read from `history`; graceful "no longer available" message (FR-4.12).

**DoD:**
- A simulated/fixture INGV event produces correct recipients and one message each;
  re-running the cron on the same event sends nothing (idempotent).
- Proximity, national, and world formats are correct; a user eligible via multiple rules
  gets exactly one message.
- Tests: matching logic, error classification, INGV parsing, idempotency.

**Refs:** SRS 3.3, 3.4, 3.5, 7.5, 7.9, NFR-1.x/2.x; AGENTS (invariants 4–8).

---

## M4 — Reliability & operations

**Objective:** retries, cleanup, self-monitoring, and the full admin surface.

**Scope:**
- **Retry cron:** re-send `failed_transient` with `attempts < MAX_ATTEMPTS`.
- **Cleanup cron (daily):** delete `deliveries` older than 3 months; delete `history` events
  with no deliveries older than the lookback window.
- **Watchdog (`system_state`):** INGV consecutive-failure counter, edge-triggered admin alert
  after `INGV_FAILURE_ALERT_THRESHOLD` (5) cycles + recovery notice; best-effort admin alert
  on DB errors. Dead-man's-switch ping already wired in M3.
- **Admin commands (`status='active'` gate via `ADMIN_CHAT_IDS`, hidden from menu):**
  `/broadcast <message>` (direct send to active users; validate empty / >4096; log
  who/when/count; no `deliveries`, no retry — partial sends possible), `/stats`, `/events`,
  `/delivery <event_id>`, `/health` (check Telegram, INGV, GeoNames, Turso). Admin text in
  English.
- **Admin push notifications:** new user, event summary (recipients ≥ 1), user `/stop`.
  All best-effort / fire-and-forget.

**DoD:**
- Transient failures are retried and resolve; cleanup removes the right rows and preserves
  the rest.
- Simulated repeated INGV failure triggers exactly one admin alert, then a recovery notice.
- Each admin command works and is ignored for non-admins.
- Tests: retry selection, cleanup rules, watchdog edge-triggering.

**Refs:** SRS 3.8, 3.9, 3.10, 3.11; AGENTS (admin commands and notifications).

---

## M5 — Hardening

**Objective:** make it robust and observable for production.

**Scope:**
- Telegram rate-limit handling (respect 429 `retry_after`); robust error handling on every
  external call; structured logs for polling cycles, delivery errors, and broadcasts.
- Optional overlap lock in `system_state` (NFR-2.4) if runs risk overlapping.
- Review every `AGENTS.md` invariant against the codebase, one by one.
- Confirm onboarding/help copy is clear (national-alerts default, how to add a location).
- README setup/deploy steps verified end-to-end on a clean environment.

**DoD:**
- A burst of events/users does not double-notify, lose alerts, or exceed rate limits.
- All invariants verified; lint/typecheck/test/build green; production deploy reproducible
  from the README.

**Refs:** SRS NFR-1.x, 2.x, 5.x, 7.x; AGENTS (all invariants and anti-goals).

---

## Sequencing notes

- **M0 first, always.** It validates the deploy/webhook chain, where most setup friction lives.
- M1 unblocks both M2 and M3. After M1, M2 (interaction) and M3 (detection) can progress
  fairly independently; do M2 first if you want a usable bot sooner, M3 first if you want the
  core alert path sooner.
- M4 depends on M3 (delivery tracking, crons). M5 is continuous polish, finalized last.
- Give the agent **one milestone at a time**. Require the full Definition of Done (including
  green lint/typecheck/test/build) before moving on.
