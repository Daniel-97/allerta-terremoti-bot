import { InlineKeyboard } from "grammy";
import { encodeEventMap } from "../util/callback-data";
import type { ParsedEvent } from "../ingv/types";
import type { Recipient } from "./match";
import { getLocation } from "../db/repositories/locations";
import type { Db } from "../db/types";

const INGV_SOURCE_URL_PREFIX = "https://terremoti.ingv.it/event/";

export interface ComposedMessage {
  text: string;
  keyboard: InlineKeyboard;
}

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

function depthLabel(depth: number | null): string {
  return depth != null ? `${depth.toFixed(1)} km` : "N/D";
}

function buildLocationLine(distanceKm: number, locName: string): string {
  return `📍 *${locName}* — ${distanceKm.toFixed(0)} km`;
}

function buildKeyboard(event: ParsedEvent): InlineKeyboard {
  const kb = new InlineKeyboard();
  const id = event.eventId?.trim();
  if (id) {
    kb.url("📡 INGV", `${INGV_SOURCE_URL_PREFIX}${encodeURIComponent(id)}`);
    kb.text("🗺️ Mappa", encodeEventMap(id));
  }
  return kb;
}

function buildTitleLine(event: ParsedEvent): string {
  return `⚠️ Terremoto *M${event.magnitude.toFixed(1)}* - ${event.zone}`;
}

export function composeProximity(event: ParsedEvent, distanceKm: number, locName: string): ComposedMessage {
  const text =
    `${buildTitleLine(event)}\n` +
    `${buildLocationLine(distanceKm, locName)}\n` +
    `📏 Profondità: ${depthLabel(event.depth)}\n` +
    `🕐 ${formatTime(event.time)}\n` +
    `_Fonte: INGV_`;
  return { text, keyboard: buildKeyboard(event) };
}

export function composeNational(event: ParsedEvent, distanceKm: number | null, locName: string | null): ComposedMessage {
  const locLine = locName && distanceKm != null ? `${buildLocationLine(distanceKm, locName)}\n` : "";
  const text =
    `${buildTitleLine(event)}\n` +
    locLine +
    `📏 Profondità: ${depthLabel(event.depth)}\n` +
    `🕐 ${formatTime(event.time)}\n` +
    `_Fonte: INGV_`;
  return { text, keyboard: buildKeyboard(event) };
}

export function composeWorld(event: ParsedEvent): ComposedMessage {
  const text =
    `${buildTitleLine(event)}\n` +
    `📏 Profondità: ${depthLabel(event.depth)}\n` +
    `🕐 ${formatTime(event.time)}\n` +
    `_Fonte: INGV_`;
  return { text, keyboard: buildKeyboard(event) };
}

export async function getNearestLocationName(db: Db, locId: number | null): Promise<string | null> {
  if (!locId) return null;
  const loc = await getLocation(db, locId);
  return loc?.name ?? null;
}

export async function composeMessage(
  event: ParsedEvent,
  rec: Recipient,
  db: Db,
): Promise<ComposedMessage> {
  const locName = await getNearestLocationName(db, rec.nearestLocationId);

  if (rec.reason === "world" || (!locName && rec.reason === "national")) {
    if (rec.reason === "world") return composeWorld(event);
    return composeNational(event, null, null);
  }

  if (rec.reason === "proximity") {
    return composeProximity(event, rec.distanceKm!, locName!);
  }
  return composeNational(event, rec.distanceKm, locName);
}
