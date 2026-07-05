import worldPng from "./world.png";
import italyFullPng from "./italy_full.png";
import italyNordPng from "./italy_nord.png";
import italyCenterPng from "./italy_center.png";
import italySudPng from "./italy_sud.png";
import italySicilyPng from "./italy_sicily.png";
import italySardiniaPng from "./italy_sardinia.png";

const imageMap: Record<string, string> = {
  "world.png": worldPng,
  "italy_full.png": italyFullPng,
  "italy_nord.png": italyNordPng,
  "italy_center.png": italyCenterPng,
  "italy_sud.png": italySudPng,
  "italy_sicily.png": italySicilyPng,
  "italy_sardinia.png": italySardiniaPng,
};

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Invalid data URL");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function getBaseImage(imageName: string): Uint8Array {
  const dataUrl = imageMap[imageName];
  if (!dataUrl) throw new Error(`Image not found: ${imageName}`);
  return dataUrlToBytes(dataUrl);
}
