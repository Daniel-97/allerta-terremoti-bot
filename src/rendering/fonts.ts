import boldFont from "@/rendering/fonts/Arimo-Bold.woff2";

export interface Fonts {
  bold: Uint8Array;
}

export function getFonts(): Fonts {
  return { bold: new Uint8Array(boldFont) };
}
