export interface BannerData {
  location: string;
  depthLabel: string;
  dateTime: string;
  magnitudeLabel: string;
  magType?: string;
}

export const BANNER_WIDTH = 600;
export const BANNER_HEIGHT = 116;

const LOCATION_X = 164;
const LOCATION_MAX_WIDTH = BANNER_WIDTH - LOCATION_X - 20;
const LOCATION_BASE_FONT_SIZE = 24;
const LOCATION_MIN_FONT_SIZE = 14;
// Empirically measured with Resvg for Arimo Bold at 24px, letter-spacing 0.5
// (mixed-case Italian toponyms average ~12.5px/char; all-caps ones go up to
// ~15px/char). Padded to 15 so the estimate stays conservative either way.
const LOCATION_PX_PER_CHAR = 15;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// The renderer (resvg) has no text-measurement API available at build time, so
// width is estimated from character count. Long location names first get a
// smaller font to fit LOCATION_MAX_WIDTH; if even the minimum font size can't
// fit them, they're truncated as a last resort so the banner never overflows.
function fitLocation(location: string): { text: string; fontSize: number } {
  const minSizeScale = LOCATION_MIN_FONT_SIZE / LOCATION_BASE_FONT_SIZE;
  const maxCharsAtMinSize = Math.floor(LOCATION_MAX_WIDTH / (LOCATION_PX_PER_CHAR * minSizeScale));
  const text = location.length > maxCharsAtMinSize ? `${location.slice(0, maxCharsAtMinSize - 1)}…` : location;

  const estimatedWidth = text.length * LOCATION_PX_PER_CHAR;
  const fontSize =
    estimatedWidth <= LOCATION_MAX_WIDTH
      ? LOCATION_BASE_FONT_SIZE
      : Math.max(
          LOCATION_MIN_FONT_SIZE,
          Math.floor(LOCATION_BASE_FONT_SIZE * (LOCATION_MAX_WIDTH / estimatedWidth)),
        );

  return { text, fontSize };
}

export function buildBannerFragment(data: BannerData): string {
  const { text: locationText, fontSize: locationFontSize } = fitLocation(data.location);
  const location = escapeXml(locationText);
  const depth = escapeXml(data.depthLabel);
  const dateTime = escapeXml(data.dateTime);
  const magnitude = escapeXml(data.magnitudeLabel);
  const magType = data.magType ? escapeXml(data.magType) : "";

  return `<svg x="0" y="0" width="${BANNER_WIDTH}" height="${BANNER_HEIGHT}" viewBox="0 0 ${BANNER_WIDTH} ${BANNER_HEIGHT}">
<defs>
  <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#e8a23a"/>
    <stop offset="50%" stop-color="#e07a1f"/>
    <stop offset="100%" stop-color="#d9601a"/>
  </linearGradient>
</defs>
<rect x="0" y="0" width="600" height="116" fill="#ffffff"/>
<polyline points="0,96 35,96 53,82 71,104 88,90 106,97 132,96 265,96 282,85 295,101 309,90 321,96 344,96 600,96"
  fill="none" stroke="url(#wave)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.15"/>
<text x="70" y="58" font-family="Arimo, sans-serif" font-size="46" font-weight="bold" fill="url(#wave)" text-anchor="middle">${magnitude}</text>
<text x="70" y="86" font-family="Arimo, sans-serif" font-size="13" fill="#8a8a8a" text-anchor="middle" letter-spacing="0.5">MAGNITUDO${magType ? ` (${magType})` : ""}</text>
<line x1="140" y1="16" x2="140" y2="100" stroke="#e2e2e2" stroke-width="1"/>
<text x="${LOCATION_X}" y="44" font-family="Arimo, sans-serif" font-size="${locationFontSize}" font-weight="bold" fill="url(#wave)" letter-spacing="0.5">${location}</text>
<text x="164" y="76" font-family="Arimo, sans-serif" font-size="16" fill="#6b6b6b">
  <tspan font-weight="bold" fill="#6b6b6b">Profondità:</tspan>
  <tspan font-weight="600" fill="#1a1a1a"> ${depth}</tspan>
  <tspan fill="#c9c9c9"> · </tspan>
  <tspan font-weight="bold" fill="#6b6b6b">Data/ora:</tspan>
  <tspan font-weight="600" fill="#1a1a1a"> ${dateTime}</tspan>
</text>
</svg>`;
}
