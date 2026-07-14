import { sqliteTable, integer, text, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const chats = sqliteTable("chats", {
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
});

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
