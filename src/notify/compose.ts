import { InlineKeyboard } from "grammy";
import type { ParsedEvent } from "@/services/ingv/types";
import type { Recipient } from "@/notify/match";
import { getLocation } from "@/db/repositories/locations";
import type { Db } from "@/db/types";
import { encodeLoc } from "@/util/callback-data";

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

export function depthLabel(depth: number | null): string {
  return depth != null ? `${depth.toFixed(1)} km` : "N/D";
}

export function formatMagType(magType: string): string {
  return magType ? ` (${magType})` : "";
}

export function formatTitle(magnitude: number, zone: string, markdown = true, includeLabel = true, magType = ""): string {
  const magValue = magnitude.toFixed(1);
  const label = includeLabel ? (markdown ? "*Magnitudo:* " : "Magnitudo: ") : "";
  return `⚠️ ${label}${magValue}${formatMagType(magType)} - ${zone}`;
}

function buildLocationLine(distanceKm: number, locName: string): string {
  return `📍 *${locName}* — ${distanceKm.toFixed(0)} km`;
}

function buildKeyboard(event: ParsedEvent): InlineKeyboard {
  const kb = new InlineKeyboard();
  const id = event.eventId?.trim();
  if (id) {
    kb.url("📡 INGV", `${INGV_SOURCE_URL_PREFIX}${encodeURIComponent(id)}`);
  }
  return kb;
}

function buildTitleLine(event: ParsedEvent): string {
  return formatTitle(event.magnitude, event.zone, true, true, event.magType);
}

function buildReasonLabel(reason: Recipient["reason"]): string {
  switch (reason) {
    case "proximity":
      return "🔔 *Allerta di prossimità*";
    case "general":
      return "📢 *Terremoto rilevante*";
  }
}

export function composeProximity(event: ParsedEvent, distanceKm: number, locName: string, locId: number): ComposedMessage {
  const text =
    `${buildReasonLabel("proximity")}\n\n` +
    `${buildTitleLine(event)}\n` +
    `${buildLocationLine(distanceKm, locName)}\n` +
    `📏 *Profondità:* ${depthLabel(event.depth)}\n` +
    `🕐 *Ora:* ${formatTime(event.time)}\n` +
    `*Fonte:* INGV`;
  const keyboard = buildKeyboard(event);
  keyboard.text(`⚙️ Soglie per ${locName}`, encodeLoc(locId));
  return { text, keyboard };
}

export function composeGeneral(event: ParsedEvent, distanceKm: number | null, locName: string | null): ComposedMessage {
  const locLine = locName && distanceKm != null ? `${buildLocationLine(distanceKm, locName)}\n` : "";
  const text =
    `${buildReasonLabel("general")}\n\n` +
    `${buildTitleLine(event)}\n` +
    locLine +
    `📏 *Profondità:* ${depthLabel(event.depth)}\n` +
    `🕐 *Ora:* ${formatTime(event.time)}\n` +
    `*Fonte:* INGV`;
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

  if (rec.reason === "proximity") {
    return composeProximity(event, rec.distanceKm!, locName!, rec.nearestLocationId!);
  }
  return composeGeneral(event, rec.distanceKm, locName);
}
