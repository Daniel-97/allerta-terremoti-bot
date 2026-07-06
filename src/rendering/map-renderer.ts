import { zones } from "@/config";
import type { Zone } from "@/config";
import type { ParsedEvent } from "@/services/ingv/types";
import { formatTime, depthLabel } from "@/notify/compose";
import { buildBannerFragment, BANNER_HEIGHT } from "@/rendering/banner";
import type { Fonts } from "@/rendering/fonts";

const SUB_ZONES = zones.filter((z) => z.id !== "world");
const WORLD_ZONE = zones.find((z) => z.id === "world")!;

function distanceToCenter(lat: number, lon: number, zone: Zone): number {
  const centerLat = (zone.minLatitude + zone.maxLatitude) / 2;
  const centerLon = (zone.minLongitude + zone.maxLongitude) / 2;
  return Math.hypot(lat - centerLat, lon - centerLon);
}

// Region bounding boxes are rectangles approximating irregular shapes, so
// neighbouring regions can both legitimately contain a point near their shared
// border (e.g. Milan sits inside both Lombardia's and Piemonte's boxes). Among
// all regions whose box contains the point, the one whose center is closest
// wins — a much better proxy for "which region is this actually in" than an
// arbitrary fixed check order.
export function selectZone(lat: number, lon: number): Zone {
  let best: Zone | null = null;
  let bestDistance = Infinity;

  for (const zone of SUB_ZONES) {
    if (
      lon >= zone.minLongitude &&
      lon <= zone.maxLongitude &&
      lat >= zone.minLatitude &&
      lat <= zone.maxLatitude
    ) {
      const distance = distanceToCenter(lat, lon, zone);
      if (distance < bestDistance) {
        best = zone;
        bestDistance = distance;
      }
    }
  }

  return best ?? WORLD_ZONE;
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

const MARKER_COLOR = "#FF4444";

function markerCircles(x: number, y: number): string {
  return `<circle cx="${x}" cy="${y}" r="12" fill="${MARKER_COLOR}" stroke="white" stroke-width="2"/>
<circle cx="${x}" cy="${y}" r="20" fill="none" stroke="${MARKER_COLOR}" stroke-width="3"/>
<circle cx="${x}" cy="${y}" r="28" fill="none" stroke="${MARKER_COLOR}" stroke-width="2"/>
<circle cx="${x}" cy="${y}" r="36" fill="none" stroke="${MARKER_COLOR}" stroke-width="1"/>`;
}

export function buildOverlaySvg(zone: Zone, x: number, y: number): string {
  return `<svg width="${zone.width}" height="${zone.height}" xmlns="http://www.w3.org/2000/svg">
${markerCircles(x, y)}
</svg>`;
}

export async function renderOverlayToPng(svg: string, fonts: Fonts): Promise<Uint8Array> {
  const { Resvg } = await import("@cf-wasm/resvg/workerd");
  const resvg = await Resvg.async(svg, {
    font: {
      fontBuffers: [fonts.regular, fonts.bold],
      defaultFontFamily: "Liberation Sans",
      sansSerifFamily: "Liberation Sans",
    },
  });
  const rendered = resvg.render();
  const pngBytes = rendered.asPng();
  return pngBytes;
}

export async function compositeImages(
  baseBytes: Uint8Array,
  overlayBytes: Uint8Array,
  topPadding: number,
): Promise<Uint8Array> {
  const { PhotonImage, Rgba, padding_top, watermark } = await import("@cf-wasm/photon/workerd");
  const base = PhotonImage.new_from_byteslice(baseBytes);
  const overlay = PhotonImage.new_from_byteslice(overlayBytes);
  const padded = padding_top(base, topPadding, new Rgba(255, 255, 255, 255));

  try {
    watermark(padded, overlay, BigInt(0), BigInt(0));
    return padded.get_bytes();
  } finally {
    base.free();
    overlay.free();
    padded.free();
  }
}

export type GetBaseImageFn = (imageName: string) => Uint8Array;
export type GetFontsFn = () => Fonts;

export async function generateEarthquakeImage(
  event: ParsedEvent,
  getBaseImage: GetBaseImageFn,
  getFonts: GetFontsFn,
): Promise<Uint8Array> {
  const { lat, lon, magnitude, depth, time, zone: zoneName } = event;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error("Invalid coordinates");
  }

  const zone = selectZone(lat, lon);
  const { x, y } = latLonToPixel(lat, lon, zone);

  const baseBytes = getBaseImage(zone.image);
  if (baseBytes.length === 0) {
    throw new Error(`Empty base image: ${zone.image}`);
  }

  const banner = buildBannerFragment({
    location: zoneName,
    depthLabel: depthLabel(depth),
    dateTime: formatTime(time),
    magnitudeLabel: `M${magnitude.toFixed(1)}`,
  });

  // The map is sized so BANNER_HEIGHT + zone.height is exactly zone.width — no
  // padding or framing needed, the composite is already square.
  const totalHeight = zone.height + BANNER_HEIGHT;
  const svg = `<svg width="${zone.width}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
${banner}
<g transform="translate(0, ${BANNER_HEIGHT})">
${markerCircles(x, y)}
</g>
</svg>`;

  const overlayBytes = await renderOverlayToPng(svg, getFonts());
  const result = await compositeImages(baseBytes, overlayBytes, BANNER_HEIGHT);
  return result;
}
