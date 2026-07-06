import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Resvg } from "@cf-wasm/resvg/node";
import { PhotonImage, Rgba, padding_top, watermark } from "@cf-wasm/photon/node";
import { selectZone, latLonToPixel, buildOverlaySvg } from "@/rendering/map-renderer";
import { buildBannerFragment, BANNER_HEIGHT } from "@/rendering/banner";
import { formatTime, depthLabel } from "@/notify/compose";
import { createLogger } from "@/util/log";
import type { ParsedEvent } from "@/services/ingv/types";
import type { Fonts } from "@/rendering/fonts";

const log = createLogger("preview-image");

const IMG_DIR = join(import.meta.dirname, "..", "src", "rendering", "img");
const FONTS_DIR = join(import.meta.dirname, "..", "src", "rendering", "fonts");

function getBaseImage(imageName: string): Uint8Array {
  return readFileSync(join(IMG_DIR, imageName));
}

function getFonts(): Fonts {
  return {
    regular: readFileSync(join(FONTS_DIR, "LiberationSans-Regular.ttf")),
    bold: readFileSync(join(FONTS_DIR, "LiberationSans-Bold.ttf")),
  };
}

async function renderOverlayToPng(svg: string, fonts: Fonts): Promise<Uint8Array> {
  const resvg = await Resvg.async(svg, {
    font: {
      fontBuffers: [fonts.regular, fonts.bold],
      defaultFontFamily: "Liberation Sans",
      sansSerifFamily: "Liberation Sans",
    },
  });
  return resvg.render().asPng();
}

function compositeImages(baseBytes: Uint8Array, overlayBytes: Uint8Array, topPadding: number): Uint8Array {
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

async function main(): Promise<void> {
  const [latArg, lonArg, magArg, outArg] = process.argv.slice(2);
  const lat = latArg ? Number(latArg) : 41.9028; // default: Roma
  const lon = lonArg ? Number(lonArg) : 12.4964;
  const magnitude = magArg ? Number(magArg) : 4.2;
  const outputPath = outArg ?? join(import.meta.dirname, "output", "preview.png");

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(magnitude)) {
    throw new Error("Parametri non validi. Uso: tsx scripts/preview-image.ts <lat> <lon> [magnitudo] [outputPath]");
  }

  const event: ParsedEvent = {
    eventId: "preview",
    time: new Date().toISOString(),
    lat,
    lon,
    depth: 8.4,
    author: "preview",
    catalog: "preview",
    contributor: "preview",
    contributorId: "preview",
    magType: "ML",
    magnitude,
    magAuthor: "preview",
    zone: "Zona di prova",
  };

  log.info({ lat, lon, magnitude }, "generazione immagine di anteprima");

  const zone = selectZone(event.lat, event.lon);
  const { x, y } = latLonToPixel(event.lat, event.lon, zone);
  const baseBytes = getBaseImage(zone.image);

  const banner = buildBannerFragment({
    location: event.zone,
    depthLabel: depthLabel(event.depth),
    dateTime: formatTime(event.time),
    magnitudeLabel: `M${event.magnitude.toFixed(1)}`,
  });
  const markerSvg = buildOverlaySvg(zone, x, y);
  const totalHeight = zone.height + BANNER_HEIGHT;

  const svg = `<svg width="${zone.width}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
${banner}
<g transform="translate(0, ${BANNER_HEIGHT})">${markerSvg}</g>
</svg>`;

  const overlayBytes = await renderOverlayToPng(svg, getFonts());
  const result = compositeImages(baseBytes, overlayBytes, BANNER_HEIGHT);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, result);
  log.info({ outputPath }, "immagine salvata");
}

main().catch((err) => {
  log.error({ err: String(err) }, "preview-image failed");
  process.exit(1);
});
