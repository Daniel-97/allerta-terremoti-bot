export interface BBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export const ITALY_BBOX: BBox = {
  minLat: 35,
  maxLat: 48,
  minLon: 6,
  maxLon: 27,
};

export const SAN_MARINO_BBOX: BBox = {
  minLat: 43.9,
  maxLat: 44,
  minLon: 12.4,
  maxLon: 12.5,
};

export const AUSTRIA_BBOX: BBox = {
  minLat: 46.4,
  maxLat: 49.0,
  minLon: 9.5,
  maxLon: 17.2,
};

export const SWITZERLAND_BBOX: BBox = {
  minLat: 45.8,
  maxLat: 47.8,
  minLon: 5.9,
  maxLon: 10.5,
};

export function inBbox(lat: number, lon: number, b: BBox): boolean {
  return lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;
}

export function isAllowedArea(lat: number, lon: number): boolean {
  return (
    inBbox(lat, lon, ITALY_BBOX) ||
    inBbox(lat, lon, SAN_MARINO_BBOX) ||
    inBbox(lat, lon, AUSTRIA_BBOX) ||
    inBbox(lat, lon, SWITZERLAND_BBOX)
  );
}
