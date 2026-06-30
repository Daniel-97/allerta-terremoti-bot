export interface ParsedEvent {
  eventId: string;
  time: string;
  lat: number;
  lon: number;
  depth: number | null;
  author: string;
  catalog: string;
  contributor: string;
  contributorId: string;
  magType: string;
  magnitude: number;
  magAuthor: string;
  zone: string;
}
