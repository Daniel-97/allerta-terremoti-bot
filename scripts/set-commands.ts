import { Bot } from "grammy";
import { createLogger } from "../src/util/log";

const log = createLogger("set-commands");

async function main(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    log.error({}, "BOT_TOKEN is required (set it in your .env or export it)");
    process.exit(1);
  }
  const bot = new Bot(token);
  await bot.api.setMyCommands([
    { command: "start", description: "Avvia il bot" },
  ]);
  log.info({}, "commands registered");
}

main().catch((err) => {
  log.error({ err: String(err) }, "set-commands failed");
  process.exit(1);
});
