import { z } from "zod";
import { MAX_ATTEMPTS as FALLBACK_MAX_ATTEMPTS } from "./util/constants";

const schema = z.object({
  BOT_TOKEN: z.string().min(1),
  WEBHOOK_SECRET: z.string().min(1),
  TURSO_DATABASE_URL: z.string().url(),
  TURSO_AUTH_TOKEN: z.string().min(1),
  GEONAMES_USERNAME: z.string().min(1),
  ADMIN_CHAT_IDS: z.string().optional(),
  HEALTHCHECKS_URL: z.string().url().optional(),
  MAX_ATTEMPTS: z.string().optional(),
});

export type AppConfig = z.infer<typeof schema>;

export interface RuntimeConfig extends AppConfig {
  maxAttempts: number;
  adminChatIds: number[];
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
  const maxAttempts = raw.MAX_ATTEMPTS ? Number(raw.MAX_ATTEMPTS) : FALLBACK_MAX_ATTEMPTS;
  const adminChatIds = parseAdminChatIds(raw.ADMIN_CHAT_IDS);
  return { ...raw, maxAttempts, adminChatIds };
}
