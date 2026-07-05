import worldPng from "./world.png";
import italyFullPng from "./italy_full.png";
import italyNordPng from "./italy_nord.png";
import italyCenterPng from "./italy_center.png";
import italySudPng from "./italy_sud.png";
import italySicilyPng from "./italy_sicily.png";
import italySardiniaPng from "./italy_sardinia.png";

const imageMap: Record<string, ArrayBuffer> = {
  "world.png": worldPng,
  "italy_full.png": italyFullPng,
  "italy_nord.png": italyNordPng,
  "italy_center.png": italyCenterPng,
  "italy_sud.png": italySudPng,
  "italy_sicily.png": italySicilyPng,
  "italy_sardinia.png": italySardiniaPng,
};

export function getBaseImage(imageName: string): Uint8Array {
  const buffer = imageMap[imageName];
  if (!buffer) throw new Error(`Image not found: ${imageName}`);
  return new Uint8Array(buffer);
}
