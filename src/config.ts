import { z } from "zod";

const schema = z.object({
  BOT_TOKEN: z.string().min(1),
  WEBHOOK_SECRET: z.string().min(1),
  TURSO_DATABASE_URL: z.string().url(),
  TURSO_AUTH_TOKEN: z.string().min(1),
  GEONAMES_USERNAME: z.string().min(1),
  ADMIN_CHAT_IDS: z.string().optional(),
  HEALTHCHECKS_URL: z.string().url().optional(),
  MAX_ATTEMPTS: z.coerce.number().positive().int().default(3),
  ITALY_ALERT_THRESHOLD: z.coerce.number().positive().default(5.0),
  WORLD_ALERT_THRESHOLD: z.coerce.number().positive().default(7.0),
  MAX_LOCATIONS_PER_USER: z.coerce.number().positive().int().default(10),
  LOOKBACK_WINDOW_MIN: z.coerce.number().positive().int().default(60),
  DELIVERIES_RETENTION_DAYS: z.coerce.number().positive().int().default(90),
  EVENTS_RETENTION_DAYS: z.coerce.number().positive().int().default(365),
});

export type AppConfig = z.infer<typeof schema>;

export interface RuntimeConfig extends AppConfig {
  maxAttempts: number;
  adminChatIds: number[];
  italyAlertThreshold: number;
  worldAlertThreshold: number;
  maxLocationsPerUser: number;
  lookbackWindowMin: number;
  deliveriesRetentionDays: number;
  eventsRetentionDays: number;
}

function parseAdminChatIds(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const n = Number(s);
      if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ADMIN_CHAT_IDS entry: ${s}`);
      return n;
    });
}

export function loadConfig(env: unknown): RuntimeConfig {
  const cleaned = typeof env === "object" && env !== null
    ? Object.fromEntries(
        Object.entries(env as Record<string, unknown>).map(([k, v]) => [
          k,
          v === "" ? undefined : v,
        ]),
      )
    : env;
  const raw = schema.parse(cleaned);
  const adminChatIds = parseAdminChatIds(raw.ADMIN_CHAT_IDS);
  return {
    ...raw,
    maxAttempts: raw.MAX_ATTEMPTS,
    adminChatIds,
    italyAlertThreshold: raw.ITALY_ALERT_THRESHOLD,
    worldAlertThreshold: raw.WORLD_ALERT_THRESHOLD,
    maxLocationsPerUser: raw.MAX_LOCATIONS_PER_USER,
    lookbackWindowMin: raw.LOOKBACK_WINDOW_MIN,
    deliveriesRetentionDays: raw.DELIVERIES_RETENTION_DAYS,
    eventsRetentionDays: raw.EVENTS_RETENTION_DAYS,
  };
}

export interface Zone {
  id: string;
  name: string;
  image: string;
  width: number;
  height: number;
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
}

export const zones: Zone[] = [
  {
    id: "world",
    name: "Mondo intero",
    image: "world.png",
    width: 600,
    height: 600,
    minLongitude: -180,
    maxLongitude: 180,
    minLatitude: -85,
    maxLatitude: 85,
  },
  {
    id: "italia",
    name: "Italia intera",
    image: "italy_full.png",
    width: 600,
    height: 600,
    minLongitude: 6.6,
    maxLongitude: 18.8,
    minLatitude: 35.3,
    maxLatitude: 47.1,
  },
  {
    id: "nord",
    name: "Nord Italia",
    image: "italy_nord.png",
    width: 600,
    height: 600,
    minLongitude: 6.6,
    maxLongitude: 14.0,
    minLatitude: 44.0,
    maxLatitude: 47.1,
  },
  {
    id: "centro",
    name: "Centro Italia",
    image: "italy_center.png",
    width: 600,
    height: 600,
    minLongitude: 9.5,
    maxLongitude: 15.0,
    minLatitude: 41.0,
    maxLatitude: 44.2,
  },
  {
    id: "sud",
    name: "Sud Italia (penisola)",
    image: "italy_sud.png",
    width: 600,
    height: 600,
    minLongitude: 13.0,
    maxLongitude: 18.6,
    minLatitude: 37.9,
    maxLatitude: 42.1,
  },
  {
    id: "sicilia",
    name: "Sicilia",
    image: "italy_sicily.png",
    width: 600,
    height: 600,
    minLongitude: 11.9,
    maxLongitude: 15.7,
    minLatitude: 36.5,
    maxLatitude: 38.35,
  },
  {
    id: "sardegna",
    name: "Sardegna",
    image: "italy_sardinia.png",
    width: 600,
    height: 600,
    minLongitude: 8.1,
    maxLongitude: 9.9,
    minLatitude: 38.85,
    maxLatitude: 41.3,
  },
];