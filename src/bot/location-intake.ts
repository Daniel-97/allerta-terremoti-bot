import type { Context } from "grammy";
import type { ReplyKeyboardMarkup } from "grammy/types";
import type { Db } from "@/db/types";
import type { RuntimeConfig } from "@/config";
import { isAllowedArea } from "@/util/geo-bbox";
import { reverseGeocode } from "@/services/geonames";
import {
  addLocation,
  countLocations,
  findByName,
} from "@/db/repositories/locations";
import { STRINGS } from "@/i18n/strings";
import { createLogger } from "@/util/log";
import { mainMenuReplyMarkup } from "@/bot/main-menu";

const log = createLogger("bot");

// grammy's ReplyKeyboardMarkup expects mutable arrays; mainMenuReplyMarkup is
// declared `as const` (read-only) for safe sharing across consumers.
const mainMenuKeyboard = mainMenuReplyMarkup as unknown as ReplyKeyboardMarkup;

export type LocationFlowOutcome =
  | { kind: "out_of_area" }
  | { kind: "cap_reached" }
  | { kind: "geocoding_failed" }
  | { kind: "duplicate" }
  | { kind: "added"; id: number; name: string };

export async function addLocationFlow(
  db: Db,
  config: Pick<RuntimeConfig, "GEONAMES_USERNAME" | "maxLocationsPerUser">,
  chatId: number,
  lat: number,
  lon: number,
): Promise<LocationFlowOutcome> {
  if (!isAllowedArea(lat, lon)) {
    return { kind: "out_of_area" };
  }

  const count = await countLocations(db, chatId);
  if (count >= config.maxLocationsPerUser) {
    return { kind: "cap_reached" };
  }

  const name = await reverseGeocode(lat, lon, config.GEONAMES_USERNAME);
  if (!name) {
    return { kind: "geocoding_failed" };
  }

  const existing = await findByName(db, chatId, name);
  if (existing) {
    return { kind: "duplicate" };
  }

  const id = await addLocation(db, { chat: chatId, lat, lon, name });
  return { kind: "added", id, name };
}

export async function handleLocation(
  ctx: Context,
  db: Db,
  config: RuntimeConfig,
): Promise<void> {
  const loc = ctx.message?.location ?? ctx.message?.venue?.location;
  if (!loc) return;
  const chatId = ctx.chat!.id;

  log.info(
    {
      chatId,
      userId: ctx.from?.id,
      lat: loc.latitude,
      lon: loc.longitude,
    },
    "location received",
  );

  const outcome = await addLocationFlow(db, config, chatId, loc.latitude, loc.longitude);

  switch (outcome.kind) {
    case "out_of_area":
      await ctx.reply(STRINGS.posizioni.outOfArea, { reply_markup: mainMenuKeyboard });
      return;
    case "cap_reached":
      await ctx.reply(STRINGS.posizioni.cap, { reply_markup: mainMenuKeyboard });
      return;
    case "geocoding_failed":
      await ctx.reply(STRINGS.posizioni.geocodingFail, { reply_markup: mainMenuKeyboard });
      return;
    case "duplicate":
      await ctx.reply(STRINGS.posizioni.duplicate, { reply_markup: mainMenuKeyboard });
      return;
    case "added":
      log.info({ chatId, locId: outcome.id, name: outcome.name }, "location added");
      await ctx.reply(STRINGS.posizioni.added(outcome.name), {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard,
      });
      return;
  }
}
