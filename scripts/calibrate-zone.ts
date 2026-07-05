import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Resvg } from "@cf-wasm/resvg/node";
import { PhotonImage, watermark } from "@cf-wasm/photon/node";
import { zones } from "@/config";
import { latLonToPixel } from "@/rendering/map-renderer";

const IMG_DIR = join(import.meta.dirname, "..", "src", "rendering", "img");

// Known reference cities (real-world coordinates) to check against the "centro" base map.
const REFERENCES: { name: string; lat: number; lon: number; color: string }[] = [
  { name: "Bologna", lat: 44.4949, lon: 11.3426, color: "#FF00FF" }, // magenta
  { name: "Ancona", lat: 43.6158, lon: 13.5189, color: "#00FFFF" }, // cyan
  { name: "Firenze", lat: 43.7696, lon: 11.2558, color: "#FFFF00" }, // yellow
  { name: "Roma", lat: 41.9028, lon: 12.4964, color: "#FF0000" }, // red
  { name: "Frosinone", lat: 41.6401, lon: 13.3487, color: "#0000FF" }, // blue
  { name: "Civitavecchia", lat: 42.093, lon: 11.7935, color: "#FFA500" }, // orange
  { name: "Grosseto", lat: 42.7603, lon: 11.1112, color: "#8B00FF" }, // violet
  { name: "Pescara", lat: 42.4618, lon: 14.2161, color: "#00FF00" }, // green
  { name: "L'Aquila", lat: 42.3498, lon: 13.3995, color: "#000000" }, // black
];

async function main(): Promise<void> {
  const zoneId = process.argv[2] ?? "centro";
  const zone = zones.find((z) => z.id === zoneId);
  if (!zone) throw new Error(`Zone not found: ${zoneId}`);

  const baseBytes = readFileSync(join(IMG_DIR, zone.image));

  const markers = REFERENCES.map((ref) => {
    const { x, y } = latLonToPixel(ref.lat, ref.lon, zone);
    console.log(`${ref.color}  ${ref.name.padEnd(15)} -> pixel (${x}, ${y})`);
    return `<circle cx="${x}" cy="${y}" r="7" fill="${ref.color}" stroke="black" stroke-width="1.5"/>`;
  }).join("\n");

  const svg = `<svg width="${zone.width}" height="${zone.height}" xmlns="http://www.w3.org/2000/svg">${markers}</svg>`;

  const resvg = await Resvg.async(svg);
  const overlayBytes = resvg.render().asPng();

  const base = PhotonImage.new_from_byteslice(baseBytes);
  const overlay = PhotonImage.new_from_byteslice(overlayBytes);
  watermark(base, overlay, BigInt(0), BigInt(0));
  const result = base.get_bytes();
  base.free();
  overlay.free();

  const outputPath = join(import.meta.dirname, "output", `calibrate-${zoneId}.png`);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, result);
  console.log(`saved to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
