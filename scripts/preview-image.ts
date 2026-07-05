import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Resvg } from "@cf-wasm/resvg/node";
import { PhotonImage, watermark } from "@cf-wasm/photon/node";
import { selectZone, latLonToPixel, buildOverlaySvg } from "../src/img/pipeline";
import { createLogger } from "../src/util/log";

const log = createLogger("preview-image");

const IMG_DIR = join(import.meta.dirname, "..", "src", "img");

function getBaseImage(imageName: string): Uint8Array {
  return readFileSync(join(IMG_DIR, imageName));
}

async function renderOverlayToPng(svg: string): Promise<Uint8Array> {
  const resvg = await Resvg.async(svg);
  return resvg.render().asPng();
}

function compositeImages(baseBytes: Uint8Array, overlayBytes: Uint8Array): Uint8Array {
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

async function main(): Promise<void> {
  const [latArg, lonArg, outArg] = process.argv.slice(2);
  const lat = latArg ? Number(latArg) : 41.9028; // default: Roma
  const lon = lonArg ? Number(lonArg) : 12.4964;
  const outputPath = outArg ?? join(import.meta.dirname, "output", "preview.png");

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Coordinate non valide. Uso: tsx scripts/preview-image.ts <lat> <lon> [outputPath]");
  }

  const zone = selectZone(lat, lon);
  const { x, y } = latLonToPixel(lat, lon, zone);
  log.info({ lat, lon, zone: zone.id, x, y }, "zona selezionata");

  const baseBytes = getBaseImage(zone.image);
  const svg = buildOverlaySvg(zone, x, y);
  const overlayBytes = await renderOverlayToPng(svg);
  const result = compositeImages(baseBytes, overlayBytes);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, result);
  log.info({ outputPath }, "immagine salvata");
}

main().catch((err) => {
  log.error({ err: String(err) }, "preview-image failed");
  process.exit(1);
});
