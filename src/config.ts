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
  };
}
