import type { Context } from "grammy";
import type { RuntimeConfig } from "@/config";
import type { Db } from "@/db/types";
import { isAllowedArea } from "@/util/geo-bbox";
import { reverseGeocode } from "@/services/geonames";
import {
  addLocation,
  countLocations,
  findByName,
} from "@/db/repositories/locations";
import { STRINGS } from "@/i18n/strings";
import { createLogger } from "@/util/log";

const log = createLogger("bot");

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

  if (!isAllowedArea(loc.latitude, loc.longitude)) {
    await ctx.reply(STRINGS.posizioni.outOfArea);
    return;
  }

  const count = await countLocations(db, chatId);
  if (count >= config.maxLocationsPerUser) {
    await ctx.reply(STRINGS.posizioni.cap);
    return;
  }

  const name = await reverseGeocode(
    loc.latitude,
    loc.longitude,
    config.GEONAMES_USERNAME,
  );
  if (!name) {
    await ctx.reply(STRINGS.posizioni.geocodingFail);
    return;
  }

  const existing = await findByName(db, chatId, name);
  if (existing) {
    await ctx.reply(STRINGS.posizioni.duplicate);
    return;
  }

  const id = await addLocation(db, {
    chat: chatId,
    lat: loc.latitude,
    lon: loc.longitude,
    name,
  });

  log.info({ chatId, locId: id, name }, "location added");
  await ctx.reply(STRINGS.posizioni.added(name), { parse_mode: "Markdown" });
}
