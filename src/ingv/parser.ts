import { z } from "zod";
import type { ParsedEvent } from "./types";

const HEADER = "#EventID|Time|Latitude|Longitude|Depth/km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName";

const eventSchema = z.object({
  eventId: z.string().min(1),
  time: z.string().min(1),
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  depth: z.coerce.number().nullable(),
  author: z.string(),
  catalog: z.string(),
  contributor: z.string(),
  contributorId: z.string(),
  magType: z.string(),
  magnitude: z.coerce.number(),
  magAuthor: z.string(),
  zone: z.string(),
});

export function parseFdsnText(text: string): ParsedEvent[] {
  const rawLines = text.trim().split("\n");
  const lines = rawLines.filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  if (lines[0] !== HEADER) throw new Error("Invalid INGV FDSN text format header");
  if (lines.length < 2) return [];

  const events: ParsedEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const parts = line.split("|");
    const raw: Record<string, string> = {
      eventId: parts[0] ?? "",
      time: parts[1] ?? "",
      lat: parts[2] ?? "",
      lon: parts[3] ?? "",
      depth: parts[4] ?? "",
      author: parts[5] ?? "",
      catalog: parts[6] ?? "",
      contributor: parts[7] ?? "",
      contributorId: parts[8] ?? "",
      magType: parts[9] ?? "",
      magnitude: parts[10] ?? "",
      magAuthor: parts[11] ?? "",
      zone: parts[12] ?? "",
    };
    const parsed = eventSchema.parse(raw);
    events.push(parsed);
  }
  return events;
}
