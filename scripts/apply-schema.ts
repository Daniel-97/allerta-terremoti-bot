import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { loadConfig } from "../src/config";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const sqlScript = readFileSync(
    new URL("../src/db/schema.sql", import.meta.url),
    "utf8",
  );

  const client = createClient({
    url: config.TURSO_DATABASE_URL,
    authToken: config.TURSO_AUTH_TOKEN,
  });

  console.log("Applying src/db/schema.sql to", config.TURSO_DATABASE_URL);
  await client.executeMultiple(sqlScript);
  console.log("Schema applied successfully.");
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
