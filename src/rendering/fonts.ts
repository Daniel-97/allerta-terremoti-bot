import regularFont from "@/rendering/fonts/LiberationSans-Regular.ttf";
import boldFont from "@/rendering/fonts/LiberationSans-Bold.ttf";

export interface Fonts {
  regular: Uint8Array;
  bold: Uint8Array;
}

export function getFonts(): Fonts {
  return { regular: new Uint8Array(regularFont), bold: new Uint8Array(boldFont) };
}
