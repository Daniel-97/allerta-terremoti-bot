import { InlineKeyboard } from "grammy";
import { encodeEventDetail } from "../util/callback-data";
import type { ParsedEvent } from "../ingv/types";
import { getLocation } from "../db/repositories/locations";
import type { Db } from "../db/types";

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function composeProximity(event: ParsedEvent, distanceKm: number, locName: string): { text: string; keyboard: InlineKeyboard } {
  const kb = new InlineKeyboard()
    .text("🔍 Dettagli", encodeEventDetail(event.eventId))
    .url("📡 INGV", `https://terremoti.ingv.it/event/${event.eventId}`);
  const text =
    `🌍 *M ${event.magnitude.toFixed(1)}*\n` +
    `📍 *${locName}* — ${distanceKm.toFixed(0)} km\n` +
    `📌 ${event.zone}\n` +
    `📏 Profondità: ${event.depth != null ? `${event.depth.toFixed(1)} km` : "N/D"}\n` +
    `🕐 ${formatTime(event.time)}\n` +
    `_Fonte: INGV_`;
  return { text, keyboard: kb };
}

export function composeNational(event: ParsedEvent, distanceKm: number | null, locName: string | null): { text: string; keyboard: InlineKeyboard } {
  const kb = new InlineKeyboard()
    .text("🔍 Dettagli", encodeEventDetail(event.eventId))
    .url("📡 INGV", `https://terremoti.ingv.it/event/${event.eventId}`);
  const distLine = locName && distanceKm != null
    ? `📍 *${locName}* — ${distanceKm.toFixed(0)} km\n`
    : "";
  const text =
    `🌍 *M ${event.magnitude.toFixed(1)}*\n` +
    distLine +
    `📌 ${event.zone}\n` +
    `📏 Profondità: ${event.depth != null ? `${event.depth.toFixed(1)} km` : "N/D"}\n` +
    `🕐 ${formatTime(event.time)}\n` +
    `_Fonte: INGV_`;
  return { text, keyboard: kb };
}

export function composeWorld(event: ParsedEvent): { text: string; keyboard: InlineKeyboard } {
  const kb = new InlineKeyboard()
    .text("🔍 Dettagli", encodeEventDetail(event.eventId))
    .url("📡 INGV", `https://terremoti.ingv.it/event/${event.eventId}`);
  const text =
    `🌍 *M ${event.magnitude.toFixed(1)}*\n` +
    `📌 ${event.zone}\n` +
    `📏 Profondità: ${event.depth != null ? `${event.depth.toFixed(1)} km` : "N/D"}\n` +
    `🕐 ${formatTime(event.time)}\n` +
    `_Fonte: INGV_`;
  return { text, keyboard: kb };
}

export async function getNearestLocationName(db: Db, locId: number | null): Promise<string | null> {
  if (!locId) return null;
  const loc = await getLocation(db, locId);
  return loc?.name ?? null;
}
