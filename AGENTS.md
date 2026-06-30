# AGENTS.md

Instructions for coding agents working on **allerta-terremoti-bot**. Read this before making
changes. For *what* the system must do, see `allerta-terremoti-bot-SRS.md`. For architecture and
setup, see `README.md`.

---

## Project in one paragraph

A Telegram earthquake-alert bot running on a single Cloudflare Worker. A `fetch` handler
serves the Telegram webhook (stateless, inline-first interaction). A `scheduled` handler
runs three cron jobs: a main job that polls INGV and sends alerts, a retry job for transient
failures, and a daily cleanup job. The bot operates in **private chats only**. Persistence is
Turso (libSQL). Seismic data is from INGV; GeoNames is used only to name user locations.

---

## Language and style

- **All code, comments, identifiers, commit messages, table and column names are in English.**
- **User-facing bot messages are in Italian** and live **only** in `src/i18n/strings.ts`.
  Never hard-code Italian strings elsewhere; add them to that module and reference them.
- TypeScript in **strict** mode. No `any` (use `unknown` + narrowing, or proper types).
- Prefer `async/await`; handle errors explicitly (no silent catches).
- Keep functions small and pure where possible; isolate side effects (network, DB) behind
  the modules listed below.

---

## Project structure

Place new code in the right module; do not collapse everything into `index.ts`.

```
src/
  index.ts            Worker entry: fetch (webhook) + scheduled (cron) handlers only
  config.ts           Env parsing/validation with zod; the only place env is read
  bot/                grammY setup, commands, callback routing, keyboards, panels, location intake
  jobs/               poll.ts (main), retry.ts, cleanup.ts, system-state/watchdog helpers
  ingv/               FDSN client + event parsing/types
  geocoding/          GeoNames reverse geocoding (user locations only)
  notify/             match.ts (eligibility), compose.ts (text+buttons), deliver.ts, errors.ts
  db/                 client.ts, schema.ts (Drizzle table defs), schema.sql (DDL), repositories/
  geo/                haversine.ts (distance + bounding box)
  i18n/               strings.ts (Italian user-facing strings)
test/                 tests for core modules
```

---

## Validation: definition of done

Before considering any change complete, run and pass all of:

```bash
npm run lint
npm run typecheck
npm test
npm run build      # wrangler build / dry-run deploy
```

Do not finish with failing checks, type errors, or lint errors.

---

## Database

- The **schema is hand-written SQL** in `src/db/schema.sql`. This file is the source of
  truth for the database. **There are no drizzle-kit migrations.** Do not add drizzle-kit,
  do not generate migrations.
- Schema changes are made by editing `schema.sql` and applying it manually. When you change
  `schema.sql`, update the Drizzle table definitions in `src/db/schema.ts` to match (they
  are kept in sync **by hand**).
- All data access goes through `src/db/repositories/`. Do not scatter SQL across the
  codebase.
- Respect the existing tables and constraints: `chats`, `locations`, `history`,
  `deliveries`, `system_state`. Do not reintroduce removed tables (`incoming`, `outgoing`) or `felt_reports` (the "did you feel it?" feature is deferred to a future version).

---

## Tests

- Only **core modules** require tests (no global coverage threshold):
  - `geo/haversine.ts` — distance and bounding box.
  - `notify/match.ts` — proximity + national/world eligibility, recipient union, nearest-location selection.
  - `notify/errors.ts` — permanent vs transient classification.
  - `ingv/` — event parsing.
  - delivery idempotency behavior.
- Use **Vitest** with `@cloudflare/vitest-pool-workers`.
- Mock external services (Telegram, INGV, GeoNames); never hit real endpoints in tests.

---

## Configuration and secrets

- **Single production environment.** No separate dev/prod split.
- All secrets are read **only** in `src/config.ts`, validated with zod, and accessed through
  the typed config object. Never read `env` elsewhere.
- Secrets are provided via `wrangler secret` (prod) and `.dev.vars` (local). **Never commit
  secrets.** Keep `.dev.vars.example` up to date when adding a variable.
- `ADMIN_CHAT_IDS` (comma-separated chat IDs) gates all admin commands; validate it in
  `config.ts` and check membership before handling any admin command.

---

## Admin commands and notifications

Admin commands are a **separate operational surface**, not part of the end-user experience:

- Admins are identified by `ADMIN_CHAT_IDS` (comma-separated chat IDs), read in `config.ts`.
- Admin commands from non-admins are **silently ignored** (no reply).
- Admin commands are **not** registered in the public command menu (`setMyCommands`).
- They **may take text arguments** in the command itself (e.g. `/broadcast <message>`). This
  is the only allowed free-text input and does **not** relax the inline-first rule for
  end-user interaction (invariant 1). No conversational state is used.
- Commands: `/broadcast <message>`, `/stats`, `/events`, `/delivery <event_id>`, `/health`.
- `/broadcast` sends the message **directly** to all active users — no preview/confirmation,
  no `deliveries` tracking. Validate the argument: reject empty messages and messages over
  4096 chars (feedback to the admin). Log every broadcast (admin, timestamp, recipient count).
  Permanent send errors still update chat status. Known limit: not tracked or retryable — a
  broadcast interrupted mid-send stays partial.
- Admin-facing message text is in **English** (user-facing text stays Italian).

The bot also **pushes** notifications to admins (to `ADMIN_CHAT_IDS`):

- **New user**: on creation of a new `chats` row (first-ever interaction).
- **Event summary**: after an event's first delivery wave, only if recipients ≥ 1; includes
  event identity, recipient count, and delivery outcome.
- **User left**: when a user runs `/stop`.
- **Watchdog**: INGV unreachable for `INGV_FAILURE_ALERT_THRESHOLD` consecutive cycles
  (edge-triggered, with a recovery notice); best-effort alert on DB errors. State lives in
  the `system_state` table. The main cron also pings `HEALTHCHECKS_URL` every run
  (dead-man's-switch).
- These pushes are **best-effort / fire-and-forget**: a failure must never block user
  registration, event processing, or alert delivery.

---

## Invariants — never break these

These encode design decisions that are easy to violate by accident:

1. **Inline-first.** All end-user interaction uses inline keyboards. The reply keyboard is
   used **only** for `request_location`. Never ask the user to type a value as free text.
   (Admin commands are exempt — see "Admin commands".)
2. **`callback_data` ≤ 64 bytes.** Use the compact scheme (e.g. `l;<id>;r;100`) with short
   IDs.
3. **Stateless interaction.** No conversational state machine. Every update is handled from
   its own content; navigation context lives in `callback_data`.
4. **Every seismic-alert send goes through `deliveries`** with the idempotent
   `INSERT ... ON CONFLICT DO NOTHING` on `(event_id, chat)`. Never send an alert without
   recording it. (The admin `/broadcast` is the exception: direct send, no `deliveries`.)
5. **No double notifications.** Event de-duplication is by unique `history.id`.
6. **Never geocode the epicenter.** Use the INGV `zone` text. Geocoding (GeoNames) is for
   user locations only and must stay off the alert path.
7. **First alert wave is sent in the main cron run**, not deferred to the retry job. The
   retry job only handles `failed_transient`.
8. **Nearest location only** in proximity alerts; thresholds (`radius`,
   `magnitude_threshold`) are **per location**; `italy_alerts` and `world_alerts` are
   **per user** (global). National alerts trigger at `ITALY_ALERT_THRESHOLD` (within
   `ITALY_BBOX` = lat 35–48, lon 6–27, the INGV reference box), world alerts at
   `WORLD_ALERT_THRESHOLD` (worldwide, never below M6.0 — INGV's guaranteed global floor);
   both thresholds are **code constants**. A user eligible under multiple rules gets exactly
   one message.
9. **One location per municipality per user**, max `MAX_LOCATIONS_PER_USER` (10), enforced
   with explicit, graceful checks (the DB `UNIQUE` is a safety net, not the flow logic).
10. **Notifications are text-only** in v1.
11. **Private chats only.** Ignore messages from groups/supergroups/channels.
12. **`/stop` deactivates, it does not delete.** It sets a `stopped` status and keeps data.
    `/start` reactivates a chat from **any** non-active status (including `blocked`).
13. **All logs go through `src/util/log.ts`.** No `console.log` / `console.warn` /
    `console.error` calls in application code or scripts (the logger module itself is
    the only exception). Logs may include Telegram profile data (`first_name`,
    `username`, etc. — public data). Never log tokens or secrets.
14. **External service errors are logged, not pushed to admin in v1.** Errors from
    GeoNames, INGV, DB, or Telegram delivery are logged with full detail (HTTP status,
    error type, context). No Telegram notification to admin in v1 to avoid consuming
    rate-limit capacity that must be reserved for seismic alerts. Admin push
    notifications via Telegram will be introduced in M4 with rate-limit handling.

---

## Anti-goals — do not do

- Do not add image/map cards to notifications (v1 is text-only).
- Do not add heavy dependencies, or any library that is not Workers-compatible (no
  Node-only modules, no native binaries, no `moment`/`luxon`).
- Do not introduce conversational state or sessions.
- Do not reintroduce removed tables or the per-event notified-chats tracking.
- Do not add drizzle-kit or auto-generated migrations (schema is hand-written `schema.sql`).
- Do not call the geocoder while processing an event.
- Do not add a dev/prod split or extra environments.
- Do not support groups in v1; do not add a confirmation step to `/broadcast`.
- Do not add the "did you feel it?" feedback feature or a `felt_reports` table in v1.
- Do not delete user data on `/stop` (it deactivates only).
- Do not re-process revised/retracted INGV events in v1 (first detection only).
- Do not expand scope beyond the SRS without it being requested.

---

## Git conventions

- Use **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- Keep commits focused; commit messages in English, imperative mood.
