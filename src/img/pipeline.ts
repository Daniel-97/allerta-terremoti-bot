import { zones } from "../config";
import type { Zone } from "../config";

// Check smaller/more specific zones first (order matters: sicilia/sardegna before sud due to overlaps)
const SUB_ZONE_ORDER = ["sicilia", "sardegna", "nord", "centro", "sud"];
const zoneById = new Map(zones.map((z) => [z.id, z]));
const SUB_ZONES = SUB_ZONE_ORDER.map((id) => zoneById.get(id)!).filter(Boolean);
const FULL_ITALY_ZONE = zones.find((z) => z.id === "italia")!;
const WORLD_ZONE = zones.find((z) => z.id === "world")!;

export function selectZone(lat: number, lon: number): Zone {
  for (const zone of SUB_ZONES) {
    if (
      lon >= zone.minLongitude &&
      lon <= zone.maxLongitude &&
      lat >= zone.minLatitude &&
      lat <= zone.maxLatitude
    ) {
      return zone;
    }
  }
  if (
    lon >= FULL_ITALY_ZONE.minLongitude &&
    lon <= FULL_ITALY_ZONE.maxLongitude &&
    lat >= FULL_ITALY_ZONE.minLatitude &&
    lat <= FULL_ITALY_ZONE.maxLatitude
  ) {
    return FULL_ITALY_ZONE;
  }
  return WORLD_ZONE;
}

function mercatorY(latDeg: number): number {
  const latRad = (latDeg * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
}

export function latLonToPixel(lat: number, lon: number, zone: Zone): { x: number; y: number } {
  const mercY = mercatorY(lat);
  const minMercY = mercatorY(zone.minLatitude);
  const maxMercY = mercatorY(zone.maxLatitude);

  const x = ((lon - zone.minLongitude) / (zone.maxLongitude - zone.minLongitude)) * zone.width;
  const y = ((mercY - minMercY) / (maxMercY - minMercY)) * zone.height;

  return {
    x: Math.round(x),
    y: Math.round(zone.height - y),
  };
}

function magnitudeColor(magnitude: number): string {
  if (magnitude < 3) return "#FFD700";
  if (magnitude < 5) return "#FF8C00";
  return "#FF4444";
}

export function buildOverlaySvg(zone: Zone, x: number, y: number, magnitude: number): string {
  const color = magnitudeColor(magnitude);
  const magLabel = `M${magnitude.toFixed(1)}`;
  return `<svg width="${zone.width}" height="${zone.height}" xmlns="http://www.w3.org/2000/svg">
<circle cx="${x}" cy="${y}" r="6" fill="${color}" stroke="white" stroke-width="2"/>
<text x="${x}" y="${y + 16}" fill="white" font-size="11" text-anchor="middle" font-weight="bold" stroke="rgba(0,0,0,0.5)" stroke-width="0.5">${magLabel}</text>
</svg>`;
}

export async function renderOverlayToPng(svg: string): Promise<Uint8Array> {
  const { Resvg } = await import("@cf-wasm/resvg/workerd");
  const resvg = new Resvg(svg);
  const rendered = resvg.render();
  const pngBytes = rendered.asPng();
  return pngBytes;
}

export async function compositeImages(
  baseBytes: Uint8Array,
  overlayBytes: Uint8Array,
): Promise<Uint8Array> {
  const { PhotonImage, watermark } = await import("@cf-wasm/photon/workerd");
  const base = PhotonImage.new_from_byteslice(baseBytes);
  const overlay = PhotonImage.new_from_byteslice(overlayBytes);

  try {
    watermark(base, overlay, BigInt(0), BigInt(0));
    return base.get_bytes();
  } finally {
    base.free();
    overlay.free();
  }
}

export type GetBaseImageFn = (imageName: string) => Uint8Array;

export async function generateEarthquakeImage(
  lat: number,
  lon: number,
  magnitude: number,
  getBaseImage: GetBaseImageFn,
): Promise<Uint8Array> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error("Invalid coordinates");
  }

  const zone = selectZone(lat, lon);
  const { x, y } = latLonToPixel(lat, lon, zone);

  const baseBytes = getBaseImage(zone.image);
  if (baseBytes.length === 0) {
    throw new Error(`Empty base image: ${zone.image}`);
  }

  const svg = buildOverlaySvg(zone, x, y, magnitude);
  const overlayBytes = await renderOverlayToPng(svg);

  const result = await compositeImages(baseBytes, overlayBytes);
  return result;
}
