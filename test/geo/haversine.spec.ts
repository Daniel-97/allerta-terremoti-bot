import { describe, it, expect } from "vitest";
import { haversineKm } from "../../src/geo/haversine";

describe("haversineKm", () => {
  it("zero distance for same point", () => {
    expect(haversineKm(41.9, 12.5, 41.9, 12.5)).toBeCloseTo(0, 0);
  });

  it("Roma to Milano ≈ 480 km", () => {
    const d = haversineKm(41.9, 12.5, 45.46, 9.19);
    expect(d).toBeGreaterThan(470);
    expect(d).toBeLessThan(500);
  });

  it("symmetric", () => {
    const d1 = haversineKm(41.9, 12.5, 45.46, 9.19);
    const d2 = haversineKm(45.46, 9.19, 41.9, 12.5);
    expect(d1).toBeCloseTo(d2, 2);
  });

  it("Roma to New York ≈ 6900 km", () => {
    const d = haversineKm(41.9, 12.5, 40.71, -74.01);
    expect(d).toBeGreaterThan(6800);
    expect(d).toBeLessThan(7100);
  });
});
