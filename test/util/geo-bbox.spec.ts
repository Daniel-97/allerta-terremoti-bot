import { describe, it, expect } from "vitest";
import { isAllowedArea } from "../../src/util/geo-bbox";

describe("isAllowedArea", () => {
  it("Roma inside", () => expect(isAllowedArea(41.9, 12.5)).toBe(true));
  it("Milano inside", () => expect(isAllowedArea(45.46, 9.19)).toBe(true));
  it("Vienna inside (AT)", () => expect(isAllowedArea(48.2, 16.37)).toBe(true));
  it("Zurich inside (CH)", () => expect(isAllowedArea(47.37, 8.54)).toBe(true));
  it("San Marino inside", () => expect(isAllowedArea(43.94, 12.45)).toBe(true));
  it("Paris outside", () => expect(isAllowedArea(48.85, 2.35)).toBe(false));
  it("New York outside", () => expect(isAllowedArea(40.71, -74.0)).toBe(false));
  it("Barcelona outside", () => expect(isAllowedArea(41.39, 2.15)).toBe(false));
  it("London outside", () => expect(isAllowedArea(51.5, -0.12)).toBe(false));
});
