import { loadConfig } from "@/config";
import { createDb } from "@/db/client";
import { createBot } from "@/bot/bot";
import { createLogger } from "@/util/log";

const log = createLogger("start-polling");

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const { db, ready } = createDb(config);
  await ready;
  const bot = createBot(config, db);
  bot.start();
  log.info({}, "polling started. Press Ctrl+C to stop.");
}

main().catch((err) => {
  log.error({ err: String(err) }, "polling start failed");
  process.exit(1);
});
