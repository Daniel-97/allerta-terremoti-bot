import { webhookCallback, Bot } from "grammy";
import { loadConfig } from "@/config";
import { verifySecretToken } from "@/webhook";
import { createBot } from "@/bot/bot";
import { createDb } from "@/db/client";
import { createLogger } from "@/util/log";
import { runMainCron } from "@/jobs/poll";
import { runRetryCron } from "@/jobs/retry";
import { runCleanupCron } from "@/jobs/cleanup";

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
    const config = loadConfig(env);
    const { db, ready } = createDb(config);
    await ready;
    const bot = new Bot(config.BOT_TOKEN);

    try {
      switch (controller.cron) {
        case "*/5 * * * *":
          try {
            await runRetryCron(
              {
                maxAttempts: config.maxAttempts,
                italyAlertThreshold: config.italyAlertThreshold,
                worldAlertThreshold: config.worldAlertThreshold,
              },
              db,
              bot,
            );
          } catch (err) {
            log.error(
              { cron: controller.cron, job: "retry", err: String(err) },
              "scheduled trigger error",
            );
          }
          try {
            await runMainCron(
              {
                HEALTHCHECKS_URL: config.HEALTHCHECKS_URL,
                italyAlertThreshold: config.italyAlertThreshold,
                worldAlertThreshold: config.worldAlertThreshold,
                lookbackWindowMin: config.lookbackWindowMin,
              },
              db,
              bot,
            );
          } catch (err) {
            log.error(
              { cron: controller.cron, job: "main", err: String(err) },
              "scheduled trigger error",
            );
          }
          break;
        case "0 3 * * *":
          await runCleanupCron(db, {
            lookbackWindowMin: config.lookbackWindowMin,
            deliveriesRetentionDays: config.deliveriesRetentionDays,
            eventsRetentionDays: config.eventsRetentionDays,
          });
          break;
        default:
          log.info({ cron: controller.cron }, "unknown cron — stub");
      }
    } catch (err) {
      log.error({ cron: controller.cron, err: String(err) }, "scheduled trigger error");
    }
  },
};
