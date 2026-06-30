import { z } from "zod";

const schema = z.object({
  BOT_TOKEN: z.string().min(1),
  WEBHOOK_SECRET: z.string().min(1),
  // M1+ (optional at M0, tightened later):
  TURSO_DATABASE_URL: z.string().url().optional(),
  TURSO_AUTH_TOKEN: z.string().optional(),
  GEONAMES_USERNAME: z.string().optional(),
  ADMIN_CHAT_IDS: z.string().optional(),
  HEALTHCHECKS_URL: z.string().url().optional(),
  MAX_ATTEMPTS: z.string().optional(),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(env: unknown): AppConfig {
  return schema.parse(env);
}
