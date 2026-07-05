import { describe, it, expect } from "vitest";
import { selectZone, latLonToPixel, buildOverlaySvg, buildFrame, generateEarthquakeImage } from "@/rendering/map-renderer";
import { zones } from "@/config";
import { getBaseImage } from "@/rendering/images";
import { getFonts } from "@/rendering/fonts";
import type { ParsedEvent } from "@/services/ingv/types";

describe("selectZone", () => {
  it("selects centro for Roma (41.9, 12.5)", () => {
    const z = selectZone(41.9, 12.5);
    expect(z.id).toBe("centro");
  });

  it("selects nord for Milano (45.46, 9.19)", () => {
    const z = selectZone(45.46, 9.19);
    expect(z.id).toBe("nord");
  });

  it("selects sicilia for Palermo (38.12, 13.35)", () => {
    const z = selectZone(38.12, 13.35);
    expect(z.id).toBe("sicilia");
  });

  it("selects sardegna for Cagliari (39.22, 9.12)", () => {
    const z = selectZone(39.22, 9.12);
    expect(z.id).toBe("sardegna");
  });

  it("selects sud for Napoli (40.85, 14.27)", () => {
    const z = selectZone(40.85, 14.27);
    expect(z.id).toBe("sud");
  });

  it("selects world for Atlantic Ocean (0, -30)", () => {
    const z = selectZone(0, -30);
    expect(z.id).toBe("world");
  });

  it("selects world for Pacific Ocean (-10, -150)", () => {
    const z = selectZone(-10, -150);
    expect(z.id).toBe("world");
  });

  it("selects world for coordinates outside any Italian zone", () => {
    const z = selectZone(48, 10);
    expect(z.id).toBe("world");
  });
});

describe("latLonToPixel", () => {
  const centro = zones.find((z) => z.id === "centro")!;

  it("returns values within image bounds for Roma", () => {
    const { x, y } = latLonToPixel(41.9, 12.5, centro);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(centro.width);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(centro.height);
  });

  it("returns 0,0 for top-left corner of zone", () => {
    const { x, y } = latLonToPixel(centro.maxLatitude, centro.minLongitude, centro);
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it("returns width,height for bottom-right corner of zone", () => {
    const { x, y } = latLonToPixel(centro.minLatitude, centro.maxLongitude, centro);
    expect(x).toBe(centro.width);
    expect(y).toBe(centro.height);
  });
});

describe("buildOverlaySvg", () => {
  const italia = zones.find((z) => z.id === "italia")!;

  it("includes viewBox dimensions matching zone", () => {
    const svg = buildOverlaySvg(italia, 300, 300);
    expect(svg).toContain(`width="${italia.width}"`);
    expect(svg).toContain(`height="${italia.height}"`);
  });

  it("includes four concentric circles", () => {
    const svg = buildOverlaySvg(italia, 300, 300);
    expect(svg.match(/<circle/g)).toHaveLength(4);
  });

  it("does not include a text element", () => {
    const svg = buildOverlaySvg(italia, 300, 300);
    expect(svg).not.toContain("<text");
  });

  it("always uses red, regardless of magnitude context", () => {
    const svg = buildOverlaySvg(italia, 300, 300);
    expect(svg).toContain("#FF4444");
    expect(svg).not.toContain("#FFD700");
    expect(svg).not.toContain("#FF8C00");
  });
});

describe("buildFrame", () => {
  it("includes a stroked rect inset by half the stroke width", () => {
    const frame = buildFrame(600, 724);
    expect(frame).toContain("<rect");
    expect(frame).toContain('x="1.5"');
    expect(frame).toContain('y="1.5"');
    expect(frame).toContain('width="597"');
    expect(frame).toContain('height="721"');
  });
});

describe("generateEarthquakeImage", () => {
  const baseEvent: ParsedEvent = {
    eventId: "test-event",
    time: "2026-01-15T10:30:00Z",
    lat: 41.9028,
    lon: 12.4964,
    depth: 8.4,
    author: "test",
    catalog: "test",
    contributor: "test",
    contributorId: "test",
    magType: "ML",
    magnitude: 4.2,
    magAuthor: "test",
    zone: "Test Zone",
  };

  it("renders a valid PNG with banner, map and marker composited together", async () => {
    const result = await generateEarthquakeImage(baseEvent, getBaseImage, getFonts);

    expect(result).toBeInstanceOf(Uint8Array);
    // PNG magic bytes
    expect(Array.from(result.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(result.length).toBeGreaterThan(1000);
  });

  it("rejects invalid coordinates", async () => {
    const invalidEvent = { ...baseEvent, lat: 999 };
    await expect(generateEarthquakeImage(invalidEvent, getBaseImage, getFonts)).rejects.toThrow(
      "Invalid coordinates",
    );
  });
});
