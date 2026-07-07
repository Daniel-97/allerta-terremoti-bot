import { describe, it, expect } from "vitest";
import { buildBannerFragment } from "@/rendering/banner";

const BASE_DATA = {
  location: "Roma",
  depthLabel: "10.0 km",
  dateTime: "30/06/2026, 12:00",
  magnitudeLabel: "4.2",
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
    expect(svg).toContain(">4.2<");
  });

  it("defaults the location font size to 24 when not specified", () => {
    const svg = buildBannerFragment({ ...BASE_DATA, location: "Roma" });
    expect(svg).toContain(
      'font-size="24" font-weight="bold" fill="url(#wave)" letter-spacing="0.5">Roma<',
    );
  });

  it("uses the given locationFontSize for the location text", () => {
    const svg = buildBannerFragment({
      ...BASE_DATA,
      location: "Costa Siciliana nord-orientale",
      locationFontSize: 18,
    });
    expect(svg).toContain(
      'font-size="18" font-weight="bold" fill="url(#wave)" letter-spacing="0.5">Costa Siciliana nord-orientale<',
    );
  });

  it("escapes XML special characters in the location", () => {
    const svg = buildBannerFragment({ ...BASE_DATA, location: "Test <script>" });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("Test &lt;script&gt;");
  });
});
