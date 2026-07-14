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
  const cleaned =
    typeof env === "object" && env !== null
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
    image: "world.jpg",
    width: 600,
    height: 484,
    minLongitude: -180,
    maxLongitude: 180,
    minLatitude: -80.9292,
    maxLatitude: 80.9292,
  },
  {
    id: "valle-aosta",
    name: "Valle d'Aosta",
    image: "valle-aosta.jpg",
    width: 600,
    height: 484,
    minLongitude: 6.8,
    maxLongitude: 7.9,
    minLatitude: 45.465,
    maxLatitude: 46.0839,
  },
  {
    id: "piemonte",
    name: "Piemonte",
    image: "piemonte.jpg",
    width: 600,
    height: 484,
    minLongitude: 6.6,
    maxLongitude: 9.3,
    minLatitude: 44.5169,
    maxLatitude: 46.0492,
  },
  {
    id: "liguria",
    name: "Liguria",
    image: "liguria.jpg",
    width: 600,
    height: 484,
    minLongitude: 7.5,
    maxLongitude: 10.1,
    minLatitude: 43.4707,
    maxLatitude: 44.9736,
  },
  {
    id: "lombardia",
    name: "Lombardia",
    image: "lombardia.jpg",
    width: 600,
    height: 484,
    minLongitude: 8.5,
    maxLongitude: 11.4,
    minLatitude: 44.8354,
    maxLatitude: 46.4705,
  },
  {
    id: "trentino-alto-adige",
    name: "Trentino-Alto Adige",
    image: "trentino-alto-adige.jpg",
    width: 600,
    height: 484,
    minLongitude: 10.4,
    maxLongitude: 12.5,
    minLatitude: 45.7924,
    maxLatitude: 46.961,
  },
  {
    id: "veneto",
    name: "Veneto",
    image: "veneto.jpg",
    width: 600,
    height: 484,
    minLongitude: 10.6,
    maxLongitude: 13.1,
    minLatitude: 45.0253,
    maxLatitude: 46.4329,
  },
  {
    id: "friuli-venezia-giulia",
    name: "Friuli-Venezia Giulia",
    image: "friuli-venezia-giulia.jpg",
    width: 600,
    height: 484,
    minLongitude: 12.3,
    maxLongitude: 13.95,
    minLatitude: 45.6394,
    maxLatitude: 46.5622,
  },
  {
    id: "emilia-romagna",
    name: "Emilia-Romagna",
    image: "emilia-romagna.jpg",
    width: 600,
    height: 484,
    minLongitude: 9.15,
    maxLongitude: 12.8,
    minLatitude: 43.3688,
    maxLatitude: 45.4713,
  },
  {
    id: "toscana",
    name: "Toscana",
    image: "toscana.jpg",
    width: 600,
    height: 484,
    minLongitude: 9.7,
    maxLongitude: 12.4,
    minLatitude: 42.564,
    maxLatitude: 44.1475,
  },
  {
    id: "umbria",
    name: "Umbria",
    image: "umbria.jpg",
    width: 600,
    height: 484,
    minLongitude: 11.9,
    maxLongitude: 13.3,
    minLatitude: 42.5637,
    maxLatitude: 43.3899,
  },
  {
    id: "marche",
    name: "Marche",
    image: "marche.jpg",
    width: 600,
    height: 484,
    minLongitude: 12.2,
    maxLongitude: 13.9,
    minLatitude: 42.7775,
    maxLatitude: 43.7759,
  },
  {
    id: "lazio",
    name: "Lazio",
    image: "lazio.jpg",
    width: 600,
    height: 484,
    minLongitude: 11.4,
    maxLongitude: 14.0,
    minLatitude: 41.0222,
    maxLatitude: 42.5855,
  },
  {
    id: "abruzzo",
    name: "Abruzzo",
    image: "abruzzo.jpg",
    width: 600,
    height: 484,
    minLongitude: 13.0,
    maxLongitude: 14.8,
    minLatitude: 41.7387,
    maxLatitude: 42.813,
  },
  {
    id: "molise",
    name: "Molise",
    image: "molise.jpg",
    width: 600,
    height: 484,
    minLongitude: 14.1,
    maxLongitude: 15.15,
    minLatitude: 41.4092,
    maxLatitude: 42.0414,
  },
  {
    id: "campania",
    name: "Campania",
    image: "campania.jpg",
    width: 600,
    height: 484,
    minLongitude: 13.8,
    maxLongitude: 15.8,
    minLatitude: 40.0905,
    maxLatitude: 41.3135,
  },
  {
    id: "puglia",
    name: "Puglia",
    image: "puglia.jpg",
    width: 600,
    height: 484,
    minLongitude: 14.9,
    maxLongitude: 18.55,
    minLatitude: 39.8917,
    maxLatitude: 42.1133,
  },
  {
    id: "basilicata",
    name: "Basilicata",
    image: "basilicata.jpg",
    width: 600,
    height: 484,
    minLongitude: 15.35,
    maxLongitude: 16.9,
    minLatitude: 39.9241,
    maxLatitude: 40.8762,
  },
  {
    id: "calabria",
    name: "Calabria",
    image: "calabria.jpg",
    width: 600,
    height: 484,
    minLongitude: 15.6,
    maxLongitude: 17.25,
    minLatitude: 37.9,
    maxLatitude: 40.15,
  },
  {
    id: "sicilia",
    name: "Sicilia",
    image: "sicilia.jpg",
    width: 600,
    height: 484,
    minLongitude: 11.9,
    maxLongitude: 15.7,
    minLatitude: 36.254,
    maxLatitude: 38.6865,
  },
  {
    id: "sardegna",
    name: "Sardegna",
    image: "sardegna.jpg",
    width: 600,
    height: 484,
    minLongitude: 8.1,
    maxLongitude: 9.85,
    minLatitude: 38.85,
    maxLatitude: 41.3,
  },
];
