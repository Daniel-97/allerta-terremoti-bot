-- allerta-terremoti-bot — database schema (Turso / libSQL)
--
-- This file is the SINGLE SOURCE OF TRUTH for the database.
-- It is hand-written and applied manually (no drizzle-kit / no auto migrations).
-- Keep src/db/schema.ts (Drizzle table definitions, used for typed queries) in sync
-- with this file by hand.
--
-- Conventions:
--   * Timestamps: TEXT in ISO 8601 UTC, e.g. '2026-06-29T14:30:00Z'.
--   * Enums: TEXT + CHECK constraint.
--   * Booleans: INTEGER 0/1 + CHECK.
--   * Surrogate primary keys: INTEGER PRIMARY KEY (SQLite rowid, short — fits callback_data).
--   * Magnitudes / coordinates / radius thresholds: REAL (or INTEGER for whole km).
--
-- IMPORTANT: foreign keys are OFF by default in SQLite/libSQL. The application MUST run
-- `PRAGMA foreign_keys = ON;` on every connection for ON DELETE CASCADE to take effect.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- chats — one row per Telegram private chat (user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chats (
    id            INTEGER PRIMARY KEY,                  -- Telegram chat id
    first_name    TEXT,
    last_name     TEXT,
    username      TEXT,
    status        TEXT    NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'blocked', 'stopped', 'deleted')),
    italy_alerts  INTEGER NOT NULL DEFAULT 1 CHECK (italy_alerts IN (0, 1)),
    world_alerts  INTEGER NOT NULL DEFAULT 0 CHECK (world_alerts IN (0, 1)),
    created_at    TEXT    NOT NULL,                     -- ISO 8601 UTC
    last_seen_at  TEXT    NOT NULL,                     -- ISO 8601 UTC
    updated_at    TEXT    NOT NULL                      -- ISO 8601 UTC
);

-- ---------------------------------------------------------------------------
-- locations — saved locations per user (max 10 enforced in the application)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id                   INTEGER PRIMARY KEY,           -- surrogate id (used in callback_data)
    chat                 INTEGER NOT NULL,
    lat                  REAL    NOT NULL,
    lon                  REAL    NOT NULL,
    name                 TEXT    NOT NULL,              -- 'Comune (PROV)'
    radius               INTEGER NOT NULL DEFAULT 100   -- km
                                 CHECK (radius >= 1 AND radius <= 300),
    magnitude_threshold  REAL    NOT NULL DEFAULT 2.0
                                 CHECK (magnitude_threshold >= 2.0),
    FOREIGN KEY (chat) REFERENCES chats (id) ON DELETE CASCADE
);

-- One location per municipality per user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_chat_name ON locations (chat, name);
-- Fast lookup of a user's locations.
CREATE INDEX IF NOT EXISTS idx_locations_chat ON locations (chat);

-- ---------------------------------------------------------------------------
-- history — every processed seismic event (dedup + details)
-- id is the INGV event id (natural key).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS history (
    id                     TEXT PRIMARY KEY,            -- INGV event id
    zone                   TEXT NOT NULL,               -- INGV textual epicenter description
    date                   TEXT NOT NULL,               -- ISO 8601 UTC (event origin time)
    lat                    REAL NOT NULL,
    lon                    REAL NOT NULL,
    depth                  REAL,                        -- km
    stations_count         INTEGER,
    magnitude_type         TEXT,                        -- e.g. 'ML', 'Mw'
    magnitude_value        REAL NOT NULL,
    magnitude_uncertainty  REAL
);

-- Cleanup / recent-window queries by event time.
CREATE INDEX IF NOT EXISTS idx_history_date ON history (date);

-- ---------------------------------------------------------------------------
-- deliveries — per-recipient delivery tracking for seismic notifications
-- (the admin /broadcast does NOT write here)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliveries (
    id         INTEGER PRIMARY KEY,
    event_id   TEXT    NOT NULL,
    chat       INTEGER NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'sent', 'failed_transient', 'failed_permanent')),
    attempts   INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT    NOT NULL,                        -- ISO 8601 UTC
    FOREIGN KEY (event_id) REFERENCES history (id) ON DELETE CASCADE,
    FOREIGN KEY (chat)     REFERENCES chats (id)   ON DELETE CASCADE
);

-- Idempotency: one delivery row per (event, chat). Enables INSERT ... ON CONFLICT DO NOTHING.
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_event_chat ON deliveries (event_id, chat);
-- "Delivered to everyone?" checks and retry selection.
CREATE INDEX IF NOT EXISTS idx_deliveries_event_status ON deliveries (event_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries (status);
-- Cleanup of old rows (> 3 months).
CREATE INDEX IF NOT EXISTS idx_deliveries_updated_at ON deliveries (updated_at);

-- ---------------------------------------------------------------------------
-- system_state — small key/value store for the watchdog and optional overlap lock
-- Keys in use: 'ingv_consecutive_failures', 'ingv_alerted', 'last_successful_sync_at'.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_state (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL                            -- ISO 8601 UTC
);
