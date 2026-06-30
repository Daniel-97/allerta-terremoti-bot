import { webhookCallback, Bot } from "grammy";
import { loadConfig } from "./config";
import { verifySecretToken } from "./webhook";
import { createBot } from "./bot/bot";
import { createDb } from "./db/client";
import { createLogger } from "./util/log";
import { runMainCron } from "./jobs/poll";

const log = createLogger("worker");

export default {
  async fetch(
    request: Request,
    env: Record<string, string>,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const start = Date.now();

    if (url.pathname !== "/webhook") {
      log.warn({ method: request.method, path: url.pathname }, "unknown path");
      return new Response("Not Found", { status: 404 });
    }

    const config = loadConfig(env);
    if (!verifySecretToken(request, config.WEBHOOK_SECRET)) {
      log.warn({ method: request.method }, "rejected: wrong secret token");
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const { db, ready } = createDb(config);
      await ready;
      const bot = createBot(config, db);
      const response = await webhookCallback(bot, "cloudflare-mod")(request);
      log.info(
        {
          method: request.method,
          path: "/webhook",
          status: response.status,
          durationMs: Date.now() - start,
        },
        "request handled",
      );
      return response;
    } catch (err) {
      log.error({ err: String(err) }, "fetch handler error");
      return new Response("Internal Server Error", { status: 500 });
    }
  },

  async scheduled(
    controller: ScheduledController,
    env: Record<string, string>,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const start = Date.now();
      const config = loadConfig(env);
    const { db, ready } = createDb(config);
    await ready;
    const bot = new Bot(config.BOT_TOKEN);

    log.info({ cron: controller.cron }, "scheduled trigger started");

    try {
      switch (controller.cron) {
        case "* * * * *":
          await runMainCron({ HEALTHCHECKS_URL: config.HEALTHCHECKS_URL, GEONAMES_USERNAME: config.GEONAMES_USERNAME }, db, bot);
          break;
        case "*/5 * * * *":
          log.info({ cron: controller.cron }, "retry cron — M4 stub");
          break;
        case "0 3 * * *":
          log.info({ cron: controller.cron }, "cleanup cron — M4 stub");
          break;
        default:
          log.info({ cron: controller.cron }, "unknown cron — stub");
      }
      log.info({ cron: controller.cron, durationMs: Date.now() - start }, "scheduled trigger finished");
    } catch (err) {
      log.error({ cron: controller.cron, err: String(err) }, "scheduled trigger error");
    }
  },
};
