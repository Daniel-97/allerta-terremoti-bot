import { loadConfig } from "../src/config";
import { createDb } from "../src/db/client";
import { createBot } from "../src/bot/bot";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const { db, ready } = createDb(config);
  await ready;
  const bot = createBot(config, db);
  bot.start();
  console.log("Polling started. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
