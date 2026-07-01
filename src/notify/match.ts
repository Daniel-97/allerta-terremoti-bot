import { haversineKm } from "../geo/haversine";
import { inBbox, ITALY_BBOX } from "../util/geo-bbox";
import { ITALY_ALERT_THRESHOLD, WORLD_ALERT_THRESHOLD } from "../util/constants";
import type { ParsedEvent } from "../ingv/types";
import type { Db } from "../db/types";
import { chats as chatsTable } from "../db/schema";
import { listLocations } from "../db/repositories/locations";
import { getChat } from "../db/repositories/chats";

export interface Recipient {
  chatId: number;
  reason: "proximity" | "national" | "world";
  nearestLocationId: number | null;
  distanceKm: number | null;
}

export async function findRecipients(event: ParsedEvent, db: Db): Promise<Recipient[]> {
  const recipients = new Map<number, Recipient>();

  // fetch all active chats — this is efficient for v1 (10-100 users)
  // For larger scale, this should be paginated
  const allChats = await db.select().from(chatsTable);

  for (const chat of allChats) {
    if (chat.status !== "active") continue;

    const matched = await matchChat(event, chat.id, db);
    if (matched) recipients.set(chat.id, matched);
  }

  return Array.from(recipients.values()).sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    if (a.distanceKm !== null) return -1;
    if (b.distanceKm !== null) return 1;
    return 0;
  });
}

export async function matchChat(event: ParsedEvent, chatId: number, db: Db): Promise<Recipient | null> {
  const chat = await getChat(db, chatId);
  if (!chat || chat.status !== "active") return null;

  let best: Recipient | null = null;

  // Proximity: check each location
  const locs = await listLocations(db, chatId);
  let nearestDist = Infinity;
  let nearestLocId: number | null = null;
  for (const loc of locs) {
    const dist = haversineKm(event.lat, event.lon, loc.lat, loc.lon);
    if (dist <= loc.radius && event.magnitude >= loc.magnitude_threshold) {
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestLocId = loc.id;
      }
    }
  }
  if (nearestLocId !== null) {
    best = { chatId, reason: "proximity", nearestLocationId: nearestLocId, distanceKm: nearestDist };
  }

  // National
  if (event.magnitude >= ITALY_ALERT_THRESHOLD && inBbox(event.lat, event.lon, ITALY_BBOX) && chat.italy_alerts) {
    const nearest = best?.reason === "proximity" && best.nearestLocationId ? { locId: best.nearestLocationId, km: best.distanceKm } : null;
    best = { chatId, reason: "national", nearestLocationId: nearest?.locId ?? null, distanceKm: nearest?.km ?? null };
  }

  // World
  if (event.magnitude >= WORLD_ALERT_THRESHOLD && chat.world_alerts) {
    const nearest = best?.reason === "proximity" && best.nearestLocationId ? { locId: best.nearestLocationId, km: best.distanceKm } : null;
    best = { chatId, reason: "world", nearestLocationId: nearest?.locId ?? null, distanceKm: nearest?.km ?? null };
  }

  return best;
}
