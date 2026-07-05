import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { createLogger } from "@/util/log";

const log = createLogger("apply-schema");

async function main(): Promise<void> {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    log.error({}, "TURSO_DATABASE_URL is required");
    process.exit(1);
  }
  if (!authToken) {
    log.error({}, "TURSO_AUTH_TOKEN is required");
    process.exit(1);
  }

  const sqlScript = readFileSync(
    new URL("../src/db/schema.sql", import.meta.url),
    "utf8",
  );

  const client = createClient({
    url,
    authToken,
  });

  log.info({ url }, "applying schema");
  await client.executeMultiple(sqlScript);
  log.info({}, "schema applied successfully");
  await client.close();
}

main().catch((err) => {
  log.error({ err: String(err) }, "apply-schema failed");
  process.exit(1);
});
