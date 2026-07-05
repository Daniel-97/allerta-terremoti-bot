import { Bot } from "grammy";
import { createLogger } from "@/util/log";

const log = createLogger("set-webhook");

const command = process.argv[2];
const url = process.argv[3];

function requireToken(): string {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    log.error({}, "BOT_TOKEN is required (set it in your .env or export it)");
    process.exit(1);
  }
  return token;
}

async function setWebhook(baseUrl: string): Promise<void> {
  const token = requireToken();
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    log.error({}, "WEBHOOK_SECRET is required (set it in your .env or export it)");
    process.exit(1);
  }
  const bot = new Bot(token);
  const webhookUrl = `${baseUrl}/webhook`;
  await bot.api.setWebhook(webhookUrl, { secret_token: secret });
  log.info({ url: webhookUrl }, "webhook set");
}

async function deleteWebhook(): Promise<void> {
  const token = requireToken();
  const bot = new Bot(token);
  await bot.api.deleteWebhook();
  log.info({}, "webhook deleted. Use npm run start-polling for local polling");
}

async function getWebhookInfo(): Promise<void> {
  const token = requireToken();
  const bot = new Bot(token);
  const info = await bot.api.getWebhookInfo();
  log.info(
    {
      url: info.url || "(none, using polling)",
      pendingUpdateCount: info.pending_update_count,
      lastErrorMessage: info.last_error_message,
      lastErrorDate: info.last_error_date
        ? new Date(info.last_error_date * 1000).toISOString()
        : undefined,
    },
    "webhook status",
  );
}

async function main(): Promise<void> {
  switch (command) {
    case "set":
      if (!url) {
        log.error({}, "Usage: npm run set-webhook -- set <url>");
        process.exit(1);
      }
      await setWebhook(url);
      break;
    case "delete":
      await deleteWebhook();
      break;
    case "info":
      await getWebhookInfo();
      break;
    default:
      log.info(
        {},
        "Available commands: 'set <url>' to configure the webhook, 'delete' to remove it, 'info' to show the current status",
      );
      break;
  }
}

main().catch((err) => {
  log.error({ err: String(err) }, "set-webhook failed");
  process.exit(1);
});
