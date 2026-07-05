import { describe, it, expect } from "vitest";
import { selectZone, latLonToPixel, buildOverlaySvg } from "../../src/img/pipeline";
import { zones } from "../../src/config";

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
    const svg = buildOverlaySvg(italia, 300, 300, 4.5);
    expect(svg).toContain(`width="${italia.width}"`);
    expect(svg).toContain(`height="${italia.height}"`);
  });

  it("includes a circle element", () => {
    const svg = buildOverlaySvg(italia, 300, 300, 4.5);
    expect(svg).toContain("<circle");
  });

  it("includes a text element with magnitude", () => {
    const svg = buildOverlaySvg(italia, 300, 300, 4.5);
    expect(svg).toContain("M4.5");
  });

  it("uses yellow for magnitude < 3", () => {
    const svg = buildOverlaySvg(italia, 300, 300, 2.5);
    expect(svg).toContain("#FFD700");
  });

  it("uses orange for magnitude 3-5", () => {
    const svg = buildOverlaySvg(italia, 300, 300, 4.0);
    expect(svg).toContain("#FF8C00");
  });

  it("uses red for magnitude >= 5", () => {
    const svg = buildOverlaySvg(italia, 300, 300, 5.5);
    expect(svg).toContain("#FF4444");
  });
});
