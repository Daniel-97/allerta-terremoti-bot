import { zones } from "@/config";
import type { Zone } from "@/config";
import type { ParsedEvent } from "@/services/ingv/types";
import { formatTime, depthLabel } from "@/notify/compose";
import {
  buildBannerFragment,
  escapeXml,
  BANNER_HEIGHT,
  LOCATION_MAX_WIDTH,
  LOCATION_BASE_FONT_SIZE,
  LOCATION_MIN_FONT_SIZE,
} from "@/rendering/banner";
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

async function measureTextWidth(
  text: string,
  fontSize: number,
  boldFont: Uint8Array,
): Promise<number> {
  const { Resvg } = await import("@cf-wasm/resvg/workerd");
  const svg = `<svg width="2000" height="${fontSize * 2}" xmlns="http://www.w3.org/2000/svg">
<text x="0" y="${fontSize}" font-family="Arimo, sans-serif" font-size="${fontSize}" font-weight="bold" letter-spacing="0.5" fill="#000">${escapeXml(text)}</text>
</svg>`;
  const resvg = await Resvg.async(svg, {
    font: { fontBuffers: [boldFont], defaultFontFamily: "Arimo", sansSerifFamily: "Arimo" },
  });
  const bbox = resvg.innerBBox();
  return bbox ? bbox.width : 0;
}

// resvg has no text-measurement API at SVG-build time, so the location's fit
// is determined by actually rendering it and reading back the glyph width —
// a fixed px-per-character estimate can't be accurate for both short mixed-case
// names and long all-caps ones. Long names first get a smaller font to fit
// LOCATION_MAX_WIDTH; if even the minimum font size can't fit them, they're
// truncated as a last resort so the banner never overflows.
export async function fitLocationText(
  location: string,
  boldFont: Uint8Array,
): Promise<{ text: string; fontSize: number }> {
  const baseWidth = await measureTextWidth(location, LOCATION_BASE_FONT_SIZE, boldFont);
  if (baseWidth <= LOCATION_MAX_WIDTH) {
    return { text: location, fontSize: LOCATION_BASE_FONT_SIZE };
  }

  const scaledFontSize = Math.floor(LOCATION_BASE_FONT_SIZE * (LOCATION_MAX_WIDTH / baseWidth));
  if (scaledFontSize >= LOCATION_MIN_FONT_SIZE) {
    return { text: location, fontSize: scaledFontSize };
  }

  const avgCharWidthAtMinSize =
    (baseWidth / location.length) * (LOCATION_MIN_FONT_SIZE / LOCATION_BASE_FONT_SIZE);
  let maxChars = Math.max(1, Math.floor(LOCATION_MAX_WIDTH / avgCharWidthAtMinSize) - 1);
  let text = `${location.slice(0, maxChars)}…`;

  // The average-based estimate above can undershoot for character-heavy
  // strings, so verify with a real measurement and trim further if needed.
  while (maxChars > 1) {
    const width = await measureTextWidth(text, LOCATION_MIN_FONT_SIZE, boldFont);
    if (width <= LOCATION_MAX_WIDTH) break;
    maxChars -= 1;
    text = `${location.slice(0, maxChars)}…`;
  }

  return { text, fontSize: LOCATION_MIN_FONT_SIZE };
}

export async function renderOverlayToPng(svg: string, fonts: Fonts): Promise<Uint8Array> {
  const { Resvg } = await import("@cf-wasm/resvg/workerd");
  const resvg = await Resvg.async(svg, {
    font: {
      fontBuffers: [fonts.bold],
      defaultFontFamily: "Arimo",
      sansSerifFamily: "Arimo",
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
  const { lat, lon, magnitude, depth, time, zone: zoneName, magType } = event;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    throw new Error("Invalid coordinates");
  }

  const zone = selectZone(lat, lon);
  const { x, y } = latLonToPixel(lat, lon, zone);

  const baseBytes = getBaseImage(zone.image);
  if (baseBytes.length === 0) {
    throw new Error(`Empty base image: ${zone.image}`);
  }

  const fonts = getFonts();
  const { text: fittedLocation, fontSize: locationFontSize } = await fitLocationText(
    zoneName,
    fonts.bold,
  );

  const banner = buildBannerFragment({
    location: fittedLocation,
    locationFontSize,
    depthLabel: depthLabel(depth),
    dateTime: formatTime(time),
    magnitudeLabel: magnitude.toFixed(1),
    magType,
  });

  // The map is sized so BANNER_HEIGHT + zone.height is exactly zone.width — no
  // padding or framing needed, the composite is already square.
  const totalHeight = zone.height + BANNER_HEIGHT;
  // Marker rings can extend past the map's top edge when the epicenter is near
  // it (up to 36px radius); clip the marker group to the map area so it never
  // paints over the banner above it.
  const svg = `<svg width="${zone.width}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
<defs>
<clipPath id="map-area"><rect x="0" y="0" width="${zone.width}" height="${zone.height}"/></clipPath>
</defs>
${banner}
<g transform="translate(0, ${BANNER_HEIGHT})" clip-path="url(#map-area)">
${markerCircles(x, y)}
</g>
</svg>`;

  const overlayBytes = await renderOverlayToPng(svg, fonts);
  const result = await compositeImages(baseBytes, overlayBytes, BANNER_HEIGHT);
  return result;
}
