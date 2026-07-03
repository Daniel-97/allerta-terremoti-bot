import { InlineKeyboard } from "grammy";
import { encodeEventDetail } from "../util/callback-data";
import type { ParsedEvent } from "../ingv/types";
import type { Recipient } from "./match";
import { getLocation } from "../db/repositories/locations";
import type { Db } from "../db/types";

const TITLE_MAX = 50;
const ADDRESS_MAX = 100;
const INGV_SOURCE_URL_PREFIX = "https://terremoti.ingv.it/event/";

export interface VenuePayload {
  latitude: number;
  longitude: number;
  title: string;
  address: string;
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

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1).trimEnd() + "…";
}

function depthLabel(depth: number | null): string {
  return depth != null ? `${depth.toFixed(1)} km` : "N/D";
}

function buildIngvSourceUrl(eventId: string): string | null {
  const id = eventId?.trim();
  if (!id) return null;
  return `${INGV_SOURCE_URL_PREFIX}${encodeURIComponent(id)}`;
}

function buildKeyboard(event: ParsedEvent): InlineKeyboard {
  const kb = new InlineKeyboard().text("🔍 Dettagli", encodeEventDetail(event.eventId));
  const sourceUrl = buildIngvSourceUrl(event.eventId);
  if (sourceUrl) {
    kb.url("📡 INGV", sourceUrl);
  }
  return kb;
}

function buildTitle(event: ParsedEvent): string {
  return truncate(`Terremoto M${event.magnitude.toFixed(1)} rilevato`, TITLE_MAX);
}

export function composeProximity(event: ParsedEvent, distanceKm: number, locName: string): VenuePayload {
  const address = truncate(
    `${distanceKm.toFixed(0)} km da ${locName} — ${formatTime(event.time)}, prof. ${depthLabel(event.depth)}`,
    ADDRESS_MAX,
  );
  return { latitude: event.lat, longitude: event.lon, title: buildTitle(event), address, keyboard: buildKeyboard(event) };
}

export function composeNational(event: ParsedEvent, distanceKm: number | null, locName: string | null): VenuePayload {
  const locPart = locName && distanceKm != null ? `${distanceKm.toFixed(0)} km da ${locName}` : event.zone;
  const address = truncate(
    `${locPart} — ${formatTime(event.time)}, prof. ${depthLabel(event.depth)}`,
    ADDRESS_MAX,
  );
  return { latitude: event.lat, longitude: event.lon, title: buildTitle(event), address, keyboard: buildKeyboard(event) };
}

export function composeWorld(event: ParsedEvent): VenuePayload {
  const address = truncate(
    `${event.zone} — ${formatTime(event.time)}, prof. ${depthLabel(event.depth)}`,
    ADDRESS_MAX,
  );
  return { latitude: event.lat, longitude: event.lon, title: buildTitle(event), address, keyboard: buildKeyboard(event) };
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
): Promise<VenuePayload> {
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
