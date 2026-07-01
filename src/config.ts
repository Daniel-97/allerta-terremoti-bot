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

export function loadConfig(env: unknown): AppConfig & { maxAttempts: number } {
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
  return { ...raw, maxAttempts };
}
