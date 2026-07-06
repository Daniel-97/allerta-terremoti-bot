import { zones } from "@/config";
import type { Zone } from "@/config";
import type { ParsedEvent } from "@/services/ingv/types";
import { formatTime, depthLabel } from "@/notify/compose";
import { buildBannerFragment, BANNER_HEIGHT } from "@/rendering/banner";
import type { Fonts } from "@/rendering/fonts";

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

const FRAME_COLOR = "#1a1a1a";
const FRAME_WIDTH = 3;

export function buildFrame(width: number, height: number): string {
  const inset = FRAME_WIDTH / 2;
  return `<rect x="${inset}" y="${inset}" width="${width - FRAME_WIDTH}" height="${height - FRAME_WIDTH}" fill="none" stroke="${FRAME_COLOR}" stroke-width="${FRAME_WIDTH}"/>`;
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

export interface EdgePadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export async function compositeImages(
  baseBytes: Uint8Array,
  overlayBytes: Uint8Array,
  padding: EdgePadding,
): Promise<Uint8Array> {
  const { PhotonImage, Rgba, padding_top, padding_bottom, padding_left, padding_right, watermark } =
    await import("@cf-wasm/photon/workerd");
  // Each padding_* call consumes its Rgba argument (wasm-bindgen ownership), so a
  // fresh instance is needed per call — reusing one throws "null pointer passed to rust".
  const white = () => new Rgba(255, 255, 255, 255);

  const base = PhotonImage.new_from_byteslice(baseBytes);
  const withTop = padding_top(base, padding.top, white());
  base.free();
  const withBottom = padding_bottom(withTop, padding.bottom, white());
  withTop.free();
  const withLeft = padding_left(withBottom, padding.left, white());
  withBottom.free();
  const padded = padding_right(withLeft, padding.right, white());
  withLeft.free();

  const overlay = PhotonImage.new_from_byteslice(overlayBytes);
  try {
    watermark(padded, overlay, BigInt(0), BigInt(0));
    return padded.get_bytes();
  } finally {
    overlay.free();
    padded.free();
  }
}

export type GetBaseImageFn = (imageName: string) => Uint8Array;
export type GetFontsFn = () => Fonts;

export interface SquarePadding {
  squareSize: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// A small bottom margin so the map isn't flush against the frame on the bottom
// edge only (left/right get margin from squaring the image; top is anchored by
// the banner) — purely aesthetic, kept modest so it doesn't inflate the side
// margins it forces the square canvas to grow by (see computeSquarePadding).
const BOTTOM_MARGIN = 20;

// Telegram crops preview images that aren't 1:1 — pad the shorter axis so the
// banner+map composite becomes square. Sizes are derived from the zone/banner
// passed in, so this adapts to whatever dimensions are used.
export function computeSquarePadding(zoneWidth: number, zoneHeight: number, bannerHeight: number): SquarePadding {
  const contentHeight = zoneHeight + bannerHeight;
  const desiredHeight = contentHeight + BOTTOM_MARGIN;
  const squareSize = Math.max(zoneWidth, desiredHeight);

  if (squareSize > zoneWidth) {
    const bottom = squareSize - contentHeight;
    const sideTotal = squareSize - zoneWidth;
    const left = Math.floor(sideTotal / 2);
    return { squareSize, top: 0, bottom, left, right: sideTotal - left };
  }

  const slack = squareSize - contentHeight;
  const top = Math.floor(slack / 2);
  return { squareSize, top, bottom: slack - top, left: 0, right: 0 };
}

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

  const { squareSize, top, bottom, left, right } = computeSquarePadding(zone.width, zone.height, BANNER_HEIGHT);

  const svg = `<svg width="${squareSize}" height="${squareSize}" xmlns="http://www.w3.org/2000/svg">
<g transform="translate(${left}, ${top})">
${banner}
<g transform="translate(0, ${BANNER_HEIGHT})">
${markerCircles(x, y)}
</g>
</g>
${buildFrame(squareSize, squareSize)}
</svg>`;

  const overlayBytes = await renderOverlayToPng(svg, getFonts());
  const result = await compositeImages(baseBytes, overlayBytes, {
    top: top + BANNER_HEIGHT,
    bottom,
    left,
    right,
  });
  return result;
}
