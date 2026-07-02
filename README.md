# allerta-terremoti-bot

A Telegram bot that sends **real-time earthquake alerts** to users based on their saved
locations. Seismic data comes from the **INGV** (Istituto Nazionale di Geofisica e
Vulcanologia). The bot runs entirely on **Cloudflare Workers** with a **Turso** (libSQL)
database. It works in **private chats only** (no groups).

> The bot's user-facing language is **Italian**. The codebase and documentation are in
> **English**. User-facing strings are centralized in a single module.

This README covers how the bot works, its architecture, the data sources, and how to set
it up and deploy it. For the full requirements see `docs/srs.md`. For contributor
and coding-agent rules see `AGENTS.md`.

---

## How it works (for users)

1. **Start** the bot with `/start`. It greets the user and asks them to share a location.
2. **Add a location** by sharing a Telegram location (a one-tap reply-keyboard button, or
   the attachment menu). The bot reverse-geocodes it to a `Municipality (PROV)` name and
   saves it.
3. **Configure** per-location thresholds via `/impostazioni`:
   - **Radius** — how far from an epicenter (in km) the user wants to be alerted for that
     location (default 100, max 300).
   - **Magnitude threshold** — minimum magnitude to be alerted for, for that location
     (default 2.0).
   - **National alerts** (`italy_alerts`, global toggle, default on) — always receive large
     events in Italy.
   - **World alerts** (`world_alerts`, global toggle, default off) — receive very large
     events anywhere in the world (≥ M7).
4. **Receive alerts.** When INGV publishes a new event, every user with a matching
   location (within radius and at/above their magnitude threshold) gets a text alert. Large
   Italian events (≥ M5.0) go to users with national alerts on; very large world events
   (≥ M7.0) go to users with world alerts on. A user eligible under several rules receives
   a single message.

All interaction is **button-based** (inline keyboards). The only free input is sharing a
location. There is no free-text value entry.

### Commands

| Command | Description |
|---|---|
| `/start` | Onboarding; prompts to share the first location |
| `/aiuto` | How the bot works |
| `/posizioni` | List / manage saved locations |
| `/impostazioni` | Open the settings panel |
| `/stop` | Deactivate: stop all notifications (data is kept, not deleted). `/start` reactivates. |
| `/credits` | Data sources, author, and useful links |

### Admin commands

Reserved for administrators (chat IDs listed in `ADMIN_CHAT_IDS`). These are **not** shown
in the public command menu, and are silently ignored for non-admins. They are an
operational surface: they accept text arguments directly in the command.

| Command | Description |
|---|---|
| `/broadcast <message>` | Send a text message directly to all active users (no preview/confirmation, no `deliveries` tracking). Rejects empty messages and messages over 4096 chars. |
| `/stats` | Operational stats: users (total/active/unreachable), locations, last processed event + timestamp (polling health), last send outcome |
| `/events` | The last ~10 processed events with their IDs (to feed `/delivery`) |
| `/delivery <event_id>` | Delivery status of a seismic event (delivered / transient failures / permanent failures) |
| `/health` | Check reachability of all external dependencies: Telegram API, INGV, GeoNames, Turso |

### Admin notifications (push)

The bot also pushes operational notifications to admins automatically (best-effort; a
failure here never affects users):

- **New user** — when a brand-new chat is created (a user's first interaction), admins get
  a notification with the user's name/username and timestamp.
- **Event summary** — after an event's first delivery wave, if at least one user was
  notified, admins get a summary: event (magnitude, zone, ID), recipient count, and
  delivery outcome (delivered / failed). No summary is sent for events that notified no one.
- **User left** — when a user runs `/stop`, admins are notified.

---

## Architecture

The bot is a **single Cloudflare Worker** with two entry points:

- **`fetch` handler** — receives Telegram updates via **webhook** and handles all user
  interaction (commands, inline button callbacks, location sharing). This path is
  **stateless**: every update is interpreted from its own content; navigation context is
  encoded in the inline `callback_data`.
- **`scheduled` handler** — runs three **Cron Triggers**:
  - **Main cron** (~every minute): pings the dead-man's-switch, polls INGV for new events
    (Italy bounding box + worldwide for very large events, over a lookback window), matches
    recipients, writes `deliveries` rows, and **sends the first wave of alerts in the same
    run** (minimal alert latency). Updates system watchdog state.
  - **Retry cron** (~every 1–5 minutes): re-sends only the deliveries that failed with a
    transient error.
  - **Cleanup cron** (daily): deletes `deliveries` older than 3 months and `history` events
    with no recipients older than the lookback window.

```
Telegram ──webhook──▶ Worker.fetch ──▶ user interaction (stateless, inline-first)
                                          │
                                          ▼
                                       Turso (libSQL)
                                          ▲
                                          │
INGV ◀──poll── Worker.scheduled (main cron) ──▶ match ──▶ deliveries ──▶ send (Telegram)
                Worker.scheduled (retry cron) ──▶ re-send failed_transient
                Worker.scheduled (cleanup cron) ──▶ prune old rows
                Worker.scheduled (main cron) ──ping──▶ external monitor (dead-man's-switch)
```

### Monitoring

The bot watches itself: if an INGV fetch fails, admins get an immediate alert. The main cron
also pings an external monitor (e.g. healthchecks.io) on every run — if the
pings stop, the external service flags that the whole system is down (the one case internal
monitoring can't catch).

### Reliable delivery

Every send is tracked persistently in the `deliveries` table (`pending` / `sent` /
`failed_transient` / `failed_permanent`). This makes it possible to tell whether an event
was delivered to everyone, and to retry **only** the recipients that failed.

- **Permanent errors** (bot blocked, chat gone, user deactivated) → the chat is marked and
  excluded from future alerts; not retried.
- **Transient errors** (rate limit, 5xx, timeout) → retried by the retry cron up to N
  attempts.

### Idempotency

Cron runs can overlap (a slow run still finishing when the next one starts). To make this
harmless, the critical operations are **idempotent** via unique constraints: an event is
"claimed" by its unique `history.id`, and each send is recorded with an
`INSERT ... ON CONFLICT DO NOTHING` on the unique `(event_id, chat)` pair in `deliveries`.
No user is ever notified twice. An optional lightweight lock (with TTL) can further reduce
overlap — skipped for v1 (idempotency is sufficient).

---

## Data sources and how they are used

| Source | Used for | Notes |
|---|---|---|
| **INGV FDSN event web service** | The primary source of earthquakes | Polled by the main cron over a bounded area and time window. The event's textual epicenter description (`zone`) is used as-is in alerts — **no geocoding on the alert path**. |
| **GeoNames API** | Reverse-geocoding **user locations only** (coordinates → `Municipality (PROV)`) | Called only when a user adds a location, never while processing an event. Short timeout + graceful fallback. Requires a free GeoNames username. |
| **Telegram Bot API** | Receiving updates (webhook) and sending / editing messages | Inbound via `fetch`; outbound from both the interaction path and the cron jobs. |

The split is deliberate: the **alert path never depends on a geocoding service**. When an
earthquake happens, the bot uses the zone description INGV already provides, so a slow or
unavailable geocoder can never delay an alert.

> **INGV coverage** (per the INGV–Civil Protection agreement): magnitude ≥ 2.5 within
> Italian borders, ≥ 5.0 across the Mediterranean, ≥ 6.0 worldwide. World alerts are
> therefore reliable only at ≥ M6.0 (the default world threshold is M7.0). All seismic data
> comes solely from INGV.

---

## Tech stack

- **Language:** TypeScript (strict).
- **Runtime / hosting:** Cloudflare Workers (`wrangler`), Cron Triggers.
- **Telegram framework:** [grammY](https://grammy.dev) (`webhookCallback(bot, "cloudflare-mod")`
  for the webhook; `bot.api` standalone for sends from cron).
- **Database:** Turso (libSQL) via `@libsql/client/web`, queried with **Drizzle ORM**.
  The schema is **hand-written SQL** applied manually (no drizzle-kit migrations).
- **INGV parsing:** native `fetch`; prefer the FDSN **text** output to avoid XML, otherwise
  `fast-xml-parser`.
- **Validation:** `zod` for external responses and config.
- **Geo:** Haversine distance implemented in-house; bounding-box pre-filter.
- **Date/time:** native `Intl.DateTimeFormat` with `timeZone: 'Europe/Rome'` (no date libs).
- **Tests:** Vitest with `@cloudflare/vitest-pool-workers`.

---

## Project structure

```
src/
  index.ts            Worker entry: fetch (webhook) + scheduled (cron) handlers
  config.ts           Env parsing/validation (zod)
  bot/                Telegram interaction (commands, callbacks, keyboards, panels)
  jobs/               Cron logic: poll (main), retry, cleanup, system-state/watchdog
  ingv/               INGV FDSN client + parsing
  geocoding/          GeoNames reverse geocoding (user locations only)
  notify/             Eligibility matching, message composition, delivery + error handling
  db/                 libSQL/Drizzle client, schema.ts (queries), schema.sql (DDL), repositories
  geo/                Haversine + bounding box
   i18n/               Italian user-facing strings + English admin strings (admin-strings.ts)
test/                 Tests for core modules
wrangler.jsonc        Worker config: cron triggers, bindings
```

---

## Setup (local development)

Prerequisites: Node.js (current LTS), a Cloudflare account, a Turso database, a Telegram
bot token (from [@BotFather](https://t.me/BotFather)), and a free GeoNames username.

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create the database schema** by applying the hand-written DDL to your Turso database:
   ```bash
   npm run db:apply
   ```
3. **Configure secrets** for local runs in `.dev.vars` (see `.dev.vars.example`):
   ```
   BOT_TOKEN=...
   TURSO_DATABASE_URL=...
   TURSO_AUTH_TOKEN=...
   GEONAMES_USERNAME=...
   WEBHOOK_SECRET=...
   ADMIN_CHAT_IDS=...
   HEALTHCHECKS_URL=...
   # Optional tunables (defaults shown in .dev.vars.example):
   # MAX_ATTEMPTS=3
   # ITALY_ALERT_THRESHOLD=5.0
   # WORLD_ALERT_THRESHOLD=7.0
   ```
4. **Run locally**
   ```bash
   npx wrangler dev
   ```
   To receive real Telegram updates locally, expose the dev server with a tunnel and set
   the webhook to that URL (see Deployment).
5. **Run checks**
   ```bash
   npm run lint && npm run typecheck && npm test
   ```

---

## Local testing

There are two approaches to test the bot locally:

### Option A — Polling mode (real Telegram, no tunnel)

Runs the bot as a **long-running Node process** using grammY's polling, bypassing the Worker/webhook entirely. It uses the same config, database, and command handlers.

```bash
# Apply the DB schema first (one-time)
npm run db:apply

# Start polling
npm run start-polling
```

The bot will receive real Telegram updates directly. Press `Ctrl+C` to stop.

### Option B — Simulate an update against `wrangler dev`

Runs the Worker locally and sends a fake `/start` update via HTTP.

Terminal 1 — start the local Worker (requires `.env` to also be present in `.dev.vars`):
```bash
# wrangler dev reads .dev.vars — copy .env there or use wrangler secret
cp .env .dev.vars
npx wrangler dev
```

Terminal 2 — send a simulated `/start` update:
```bash
npm run simulate
```

The Worker will process the fake update through the full pipeline: secret verification, DB, bot middleware, and `/start` handler. Telegram won't receive the reply, but the DB insert and logs confirm everything works. Use `TEST_CHAT_ID` in `.env` to control the simulated user ID.

---

## Deployment (production)

There is a single **production** environment.

### Automatic deploy (GitHub Actions)

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which
installs dependencies, deploys the Worker via
[`cloudflare/wrangler-action`](https://github.com/cloudflare/wrangler-action), and pushes the
application secrets to Cloudflare via `wrangler secret put`. It can also be triggered manually
from the **Actions** tab (`workflow_dispatch`).

Configure these repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token with "Edit Cloudflare Workers" permissions on the target account |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `BOT_TOKEN`, `WEBHOOK_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `GEONAMES_USERNAME` | Required app secrets |
| `ADMIN_CHAT_IDS`, `HEALTHCHECKS_URL` | Optional app secrets |
| `MAX_ATTEMPTS`, `ITALY_ALERT_THRESHOLD`, `WORLD_ALERT_THRESHOLD`, `MAX_LOCATIONS_PER_USER`, `LOOKBACK_WINDOW_MIN`, `DELIVERIES_RETENTION_DAYS` | Optional app secrets — each defaults to a sensible value when unset |

These are synced to Cloudflare on every deploy, so updating a GitHub secret is enough to roll
the new value out on the next push (or manual run).

**Cron triggers** (main + retry + cleanup) are configured in `wrangler.jsonc` and deploy
automatically with the Worker.

### Manual deploy (fallback)

1. **Deploy the Worker**
   ```bash
   npx wrangler deploy
   ```
2. **Set production secrets**
   ```bash
   wrangler secret put BOT_TOKEN
   wrangler secret put TURSO_DATABASE_URL
   wrangler secret put TURSO_AUTH_TOKEN
   wrangler secret put GEONAMES_USERNAME
   wrangler secret put WEBHOOK_SECRET
   wrangler secret put HEALTHCHECKS_URL  # optional, skip if unused
   # Optional tunables — each has a sensible default; only set to override:
   # wrangler secret put MAX_ATTEMPTS
   # wrangler secret put ITALY_ALERT_THRESHOLD
   # wrangler secret put WORLD_ALERT_THRESHOLD
   # wrangler secret put MAX_LOCATIONS_PER_USER
   # wrangler secret put LOOKBACK_WINDOW_MIN
   # wrangler secret put DELIVERIES_RETENTION_DAYS
   ```

### Telegram webhook

**Register the Telegram webhook** to the deployed Worker URL, passing `WEBHOOK_SECRET` as
the secret token. Telegram will then send it back in the `X-Telegram-Bot-Api-Secret-Token`
header on every update, which the Worker verifies. Use the `set-webhook` script:
```bash
npm run set-webhook -- set https://<worker-url>
npm run set-webhook -- info
npm run set-webhook -- delete
```
This is a one-time step (unless the Worker URL or `WEBHOOK_SECRET` changes) and isn't handled
by the GitHub Actions workflow.

### Configuration

All variables are optional unless marked as **required**.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `BOT_TOKEN` | **yes** | — | Telegram bot token |
| `WEBHOOK_SECRET` | **yes** | — | Secret token verified via the `X-Telegram-Bot-Api-Secret-Token` header |
| `TURSO_DATABASE_URL` | **yes** | — | Turso/libSQL connection URL |
| `TURSO_AUTH_TOKEN` | **yes** | — | Turso auth token |
| `GEONAMES_USERNAME` | **yes** | — | GeoNames username for reverse geocoding |
| `ADMIN_CHAT_IDS` | no | — | Comma-separated chat IDs allowed to run admin commands |
| `HEALTHCHECKS_URL` | no | — | External monitor endpoint pinged each main-cron run (dead-man's-switch) |
| `MAX_ATTEMPTS` | no | `3` | Max send attempts for transient failures |
| `ITALY_ALERT_THRESHOLD` | no | `5.0` | Minimum magnitude for national alerts (within `ITALY_BBOX`) |
| `WORLD_ALERT_THRESHOLD` | no | `7.0` | Minimum magnitude for world alerts (not below 6.0 — INGV's guaranteed global floor) |
| `MAX_LOCATIONS_PER_USER` | no | `10` | Maximum number of saved locations per user |
| `LOOKBACK_WINDOW_MIN` | no | `60` | Lookback window (minutes) when polling INGV for new events |
| `DELIVERIES_RETENTION_DAYS` | no | `90` | Days to keep delivery records before cleanup |

> Other tunables are **code constants**: `ITALY_BBOX` (lat 35–48, lon 6–27, INGV reference box).

---

## License

TBD.
