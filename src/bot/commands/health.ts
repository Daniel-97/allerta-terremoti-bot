import type { Context } from "grammy";
import type { Bot } from "grammy";
import type { Logger } from "../../util/log";
import { createLogger } from "../../util/log";
import { ADMIN } from "../../i18n/admin-strings";
import { sql } from "drizzle-orm";
import type { Db } from "../../db/types";
import type { RuntimeConfig } from "../../config";

const log = createLogger("health");

interface Check {
  service: string;
  ok: boolean;
  detail: string;
}

async function checkTelegram(bot: Bot): Promise<Check> {
  try {
    const me = await bot.api.getMe();
    return { service: "Telegram API", ok: true, detail: `@${me.username}` };
  } catch (err) {
    log.warn({ err: String(err) }, "health: telegram check failed");
    return { service: "Telegram API", ok: false, detail: String(err) };
  }
}

async function checkIngv(): Promise<Check> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch("https://webservices.ingv.it/fdsnws/event/1/version", {
      signal: ctrl.signal,
    });
    if (res.ok) {
      const ver = await res.text();
      return { service: "INGV", ok: true, detail: `version ${ver.trim()}` };
    }
    log.warn({ status: res.status }, "health: ingv http error");
    return { service: "INGV", ok: false, detail: `HTTP ${res.status}` };
  } catch (err) {
    log.warn({ err: String(err) }, "health: ingv check failed");
    return { service: "INGV", ok: false, detail: String(err) };
  } finally {
    clearTimeout(tid);
  }
}

async function checkGeonames(config: RuntimeConfig): Promise<Check> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(
      `https://secure.geonames.org/searchJSON?q=test&maxRows=1&username=${config.GEONAMES_USERNAME}`,
      { signal: ctrl.signal },
    );
    if (res.ok) return { service: "GeoNames", ok: true, detail: "reachable" };
    log.warn({ status: res.status }, "health: geonames http error");
    return { service: "GeoNames", ok: false, detail: `HTTP ${res.status}` };
  } catch (err) {
    log.warn({ err: String(err) }, "health: geonames check failed");
    return { service: "GeoNames", ok: false, detail: String(err) };
  } finally {
    clearTimeout(tid);
  }
}

async function checkTurso(db: Db): Promise<Check> {
  try {
    await db.run(sql`SELECT 1`);
    return { service: "Turso (DB)", ok: true, detail: "connected" };
  } catch (err) {
    log.warn({ err: String(err) }, "health: turso check failed");
    return { service: "Turso (DB)", ok: false, detail: String(err) };
  }
}

export async function handle(
  ctx: Context,
  db: Db,
  logHandler: Logger,
  _args: string,
  config: RuntimeConfig,
  bot: Bot,
): Promise<void> {
  logHandler.info({ chatId: ctx.chat?.id, command: "/health", outcome: "handled" }, "command handled");

  const checks = await Promise.all([
    checkTelegram(bot),
    checkIngv(),
    checkGeonames(config),
    checkTurso(db),
  ]);

  const lines = checks.map((c) => ADMIN.health.line(c.service, c.ok, c.detail));
  await ctx.reply([ADMIN.health.title, ...lines].join("\n"), { parse_mode: "Markdown" });
}
