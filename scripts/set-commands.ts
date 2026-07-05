import { Bot } from "grammy";
import { createLogger } from "@/util/log";

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
    { command: "aiuto", description: "Mostra l'aiuto" },
    { command: "posizioni", description: "Le tue posizioni salvate" },
    { command: "impostazioni", description: "Raggio, magnitudo, allerti nazionali/mondiali" },
    { command: "stop", description: "Disattiva le notifiche" },
    { command: "credits", description: "Fonti e crediti" },
  ]);
  log.info({}, "commands registered");
}

main().catch((err) => {
  log.error({ err: String(err) }, "set-commands failed");
  process.exit(1);
});
