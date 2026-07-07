export interface BannerData {
  location: string;
  locationFontSize?: number;
  depthLabel: string;
  dateTime: string;
  magnitudeLabel: string;
  magType?: string;
}

export const BANNER_WIDTH = 600;
export const BANNER_HEIGHT = 116;

export const LOCATION_X = 164;
export const LOCATION_MAX_WIDTH = BANNER_WIDTH - LOCATION_X - 20;
export const LOCATION_BASE_FONT_SIZE = 24;
export const LOCATION_MIN_FONT_SIZE = 14;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildBannerFragment(data: BannerData): string {
  const location = escapeXml(data.location);
  const locationFontSize = data.locationFontSize ?? LOCATION_BASE_FONT_SIZE;
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
