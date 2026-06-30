import { webhookCallback } from "grammy";
import { loadConfig } from "./config";
import { verifySecretToken } from "./webhook";
import { createBot } from "./bot/bot";
import { createDb } from "./db/client";

export default {
  async fetch(
    request: Request,
    env: Record<string, string>,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/webhook") {
      return new Response("Not Found", { status: 404 });
    }

    const config = loadConfig(env);
    if (!verifySecretToken(request, config.WEBHOOK_SECRET)) {
      return new Response("Forbidden", { status: 403 });
    }

    const { db, ready } = createDb(config);
    await ready;
    const bot = createBot(config, db);
    return webhookCallback(bot, "cloudflare-mod")(request);
  },

  async scheduled(
    controller: ScheduledController,
    _env: Record<string, string>,
    _ctx: ExecutionContext,
  ): Promise<void> {
    console.log(`scheduled stub: ${controller.cron}`);
  },
};
