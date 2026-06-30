import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

async function main(): Promise<void> {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error("TURSO_DATABASE_URL is required");
    process.exit(1);
  }
  if (!authToken) {
    console.error("TURSO_AUTH_TOKEN is required");
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

  console.log("Applying src/db/schema.sql to", url);
  await client.executeMultiple(sqlScript);
  console.log("Schema applied successfully.");

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
