import { Bot } from "grammy";

async function main(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error("BOT_TOKEN is required (set it in your .env or export it)");
    process.exit(1);
  }
  const bot = new Bot(token);
  await bot.api.setMyCommands([
    { command: "start", description: "Avvia il bot" },
  ]);
  console.log("Commands registered.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
