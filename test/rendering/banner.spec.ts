import { describe, it, expect } from "vitest";
import { buildBannerFragment } from "@/rendering/banner";

const BASE_DATA = {
  location: "Roma",
  depthLabel: "10.0 km",
  dateTime: "30/06/2026, 12:00",
  magnitudeLabel: "M4.2",
};

describe("buildBannerFragment", () => {
  it("shows magType in parentheses next to MAGNITUDO when present", () => {
    const svg = buildBannerFragment({ ...BASE_DATA, magType: "ML" });
    expect(svg).toContain("MAGNITUDO (ML)");
  });

  it("omits the parentheses when magType is empty", () => {
    const svg = buildBannerFragment({ ...BASE_DATA, magType: "" });
    expect(svg).toContain(">MAGNITUDO<");
  });

  it("omits the parentheses when magType is not provided at all", () => {
    const svg = buildBannerFragment(BASE_DATA);
    expect(svg).toContain(">MAGNITUDO<");
  });

  it("escapes XML special characters in magType", () => {
    const svg = buildBannerFragment({ ...BASE_DATA, magType: "M<w>" });
    expect(svg).toContain("MAGNITUDO (M&lt;w&gt;)");
  });

  it("still renders the magnitude number label unchanged", () => {
    const svg = buildBannerFragment({ ...BASE_DATA, magType: "ML" });
    expect(svg).toContain(">M4.2<");
  });

  it("keeps the base font size for short location names", () => {
    const svg = buildBannerFragment({ ...BASE_DATA, location: "Roma" });
    expect(svg).toContain('font-size="24" font-weight="bold" fill="url(#wave)" letter-spacing="0.5">Roma<');
  });

  it("shrinks the font size for a long location name instead of overflowing", () => {
    const longLocation = "Costa Siciliana nord-orientale (Messina)";
    const svg = buildBannerFragment({ ...BASE_DATA, location: longLocation });
    const match = svg.match(/<text x="164" y="44"[^>]*font-size="(\d+)"[^>]*>([^<]*)<\/text>/);
    expect(match).not.toBeNull();
    const [, fontSize, text] = match!;
    expect(Number(fontSize)).toBeLessThan(24);
    expect(text).toBe(longLocation);
  });

  it("truncates with an ellipsis when even the minimum font size would overflow", () => {
    const veryLongLocation = "A".repeat(200);
    const svg = buildBannerFragment({ ...BASE_DATA, location: veryLongLocation });
    const match = svg.match(/<text x="164" y="44"[^>]*font-size="(\d+)"[^>]*>([^<]*)<\/text>/);
    expect(match).not.toBeNull();
    const [, fontSize, text] = match!;
    expect(Number(fontSize)).toBe(14);
    expect(text!.endsWith("…")).toBe(true);
    expect(text!.length).toBeLessThan(veryLongLocation.length);
  });

  it("escapes XML special characters in a truncated location", () => {
    const veryLongLocation = `${"A".repeat(200)}<script>`;
    const svg = buildBannerFragment({ ...BASE_DATA, location: veryLongLocation });
    expect(svg).not.toContain("<script>");
  });
});
