import worldPng from "./img/world.png";
import italyFullPng from "./img/italy_full.png";
import italyNordPng from "./img/italy_nord.png";
import italyCenterPng from "./img/italy_center.png";
import italySudPng from "./img/italy_sud.png";
import italySicilyPng from "./img/italy_sicily.png";
import italySardiniaPng from "./img/italy_sardinia.png";

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
