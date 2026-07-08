import type { Context } from "grammy";
import { decode } from "@/util/callback-data";
import { createLogger } from "@/util/log";
import {
  listLocations,
  getLocation,
  updateRadius,
  updateMagnitude,
  deleteLocation,
} from "@/db/repositories/locations";
import { getChat, setAlertFlags } from "@/db/repositories/chats";
import { getEvent } from "@/db/repositories/history";
import { STRINGS } from "@/i18n/strings";
import * as panels from "@/bot/inline/panels";
import type { Db } from "@/db/types";

const log = createLogger("bot");

export async function handleCallbackQuery(
  ctx: Context,
  db: Db,
): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  const cb = decode(data);

  log.info(
    {
      chatId: ctx.callbackQuery?.message?.chat.id,
      userId: ctx.callbackQuery?.from.id,
      first_name: ctx.callbackQuery?.from.first_name,
      username: ctx.callbackQuery?.from.username,
      callback: data,
      kind: cb?.kind ?? "unknown",
    },
    "callback query received",
  );

  if (!cb) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    switch (cb.kind) {
      case "loc": {
        const loc = await getLocation(db, cb.locId);
        if (!loc) {
          await ctx.answerCallbackQuery({ text: "Posizione non trovata" });
          return;
        }
        await panels.editPanel(ctx, panels.renderLocationDetail(loc.name, loc.radius, loc.magnitude_threshold, loc.id));
        break;
      }
      case "radiusMenu": {
        await panels.editPanel(ctx, panels.renderRadiusPresets(cb.locId));
        break;
      }
      case "magnitudeMenu": {
        await panels.editPanel(ctx, panels.renderMagnitudePresets(cb.locId));
        break;
      }
      case "radius": {
        await updateRadius(db, cb.locId, cb.radius);
        const loc = await getLocation(db, cb.locId);
        if (loc) {
          await panels.editPanel(ctx, panels.renderLocationDetail(loc.name, loc.radius, loc.magnitude_threshold, loc.id));
        }
        break;
      }
      case "magnitude": {
        await updateMagnitude(db, cb.locId, cb.magnitude / 10);
        const loc = await getLocation(db, cb.locId);
        if (loc) {
          await panels.editPanel(ctx, panels.renderLocationDetail(loc.name, loc.radius, loc.magnitude_threshold, loc.id));
        }
        break;
      }
      case "delete": {
        const loc = await getLocation(db, cb.locId);
        if (loc) {
          await panels.editPanel(ctx, panels.renderConfirmDelete(loc.name, loc.id));
        }
        break;
      }
      case "deleteOk": {
        const loc = await getLocation(db, cb.locId);
        if (loc) {
          await deleteLocation(db, cb.locId);
          await ctx.answerCallbackQuery({ text: `Posizione "${loc.name}" rimossa` });
          const locs = await listLocations(db, loc.chat);
          await panels.editPanel(ctx, panels.renderLocationsList(locs));
        }
        break;
      }
      case "toggle": {
        const msg = ctx.callbackQuery?.message;
        if (!msg) return;
        const chatId = msg.chat.id;
        const chat = await getChat(db, chatId);
        if (!chat) return;
        const italy = cb.flag === "ita" ? cb.value : chat.italy_alerts;
        const world = cb.flag === "wld" ? cb.value : chat.world_alerts;
        await setAlertFlags(db, chatId, { italy_alerts: italy, world_alerts: world });
        if (cb.flag === "ita") {
          await ctx.answerCallbackQuery({
            text: cb.value ? STRINGS.toggles.italyOn : STRINGS.toggles.italyOff,
          });
        } else {
          await ctx.answerCallbackQuery({
            text: cb.value ? STRINGS.toggles.worldOn : STRINGS.toggles.worldOff,
          });
        }
        await panels.editPanel(ctx, panels.renderSettings(italy, world));
        break;
      }
      case "evDetail": {
        const ev = await getEvent(db, cb.eventId);
        if (!ev) {
          await ctx.answerCallbackQuery({ text: STRINGS.eventDetail.notAvailable });
          return;
        }
        const lines = [
          `📍 *${ev.zone}*`,
          `📏 Coordinate: ${ev.lat.toFixed(3)}, ${ev.lon.toFixed(3)}`,
          `📏 Profondità: ${ev.depth != null ? `${ev.depth.toFixed(1)} km` : "N/D"}`,
          `📊 Magnitudo: *${ev.magnitude_value.toFixed(1)}* (${ev.magnitude_type ?? "N/D"})`,
          ev.magnitude_uncertainty != null ? `   Incertezza: ±${ev.magnitude_uncertainty.toFixed(1)}` : "",
          `📡 Stazioni: ${ev.stations_count ?? "N/D"}`,
          `🕐 ${ev.date}`,
        ].filter(Boolean).join("\n");
        await ctx.reply(`${STRINGS.eventDetail.title}\n\n${lines}\n\n${STRINGS.eventDetail.source}`, { parse_mode: "Markdown" });
        break;
      }
      case "nav": {
        const msg = ctx.callbackQuery?.message;
        if (!msg) return;
        const chatId = msg.chat.id;
        if (cb.target === "add") {
          await ctx.reply(STRINGS.posizioni.addPrompt, {
            reply_markup: { remove_keyboard: true },
            parse_mode: "Markdown",
          });
          break;
        }
        // "back" — depends on current context; for now fallback to location list
        const locs = await listLocations(db, chatId);
        await panels.editPanel(ctx, panels.renderLocationsList(locs));
        break;
      }
    }
  } catch (err) {
    log.error({ err: String(err), callback: data }, "callback handler error");
    await ctx.answerCallbackQuery({ text: STRINGS.errors.generic });
  }

  await ctx.answerCallbackQuery();
}
