import { z } from "zod";
import type { ParsedEvent } from "./types";

const KNOWN_HEADER_COLUMNS = [
  "#eventid", "time", "latitude", "longitude", "depth/km",
  "author", "catalog", "contributor", "contributorid",
  "magtype", "magnitude", "magauthor", "eventlocationname",
] as const;

const MIN_COLUMNS = KNOWN_HEADER_COLUMNS.length;

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

function validateHeader(header: string): void {
  const cols = header.toLowerCase().split("|");
  if (cols.length < MIN_COLUMNS) throw new Error("Invalid INGV FDSN text format header");
  for (let i = 0; i < MIN_COLUMNS; i++) {
    if (cols[i] !== KNOWN_HEADER_COLUMNS[i]) throw new Error("Invalid INGV FDSN text format header");
  }
}

export function parseFdsnText(text: string): ParsedEvent[] {
  const rawLines = text.trim().split("\n");
  const lines = rawLines.filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  validateHeader(lines[0]!);
  if (lines.length < 2) return [];

  const events: ParsedEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const parts = line.split("|");
    if (parts.length < MIN_COLUMNS) continue;
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
