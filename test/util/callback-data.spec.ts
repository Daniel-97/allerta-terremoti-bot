import { describe, it, expect } from "vitest";
import {
  encodeRadius,
  decodeRadius,
  encodeMagnitude,
  decodeMagnitude,
  encodeRadiusMenu,
  decodeRadiusMenu,
  encodeMagnitudeMenu,
  decodeMagnitudeMenu,
  encodeDelete,
  encodeDeleteOk,
  isDelete,
  isDeleteOk,
  encodeToggle,
  decodeToggle,
  encodeNav,
  decodeNav,
  encodeLoc,
  decodeLoc,
  encodeEventDetail,
  decodeEvDetail,
  decode,
} from "../../src/util/callback-data";

describe("callback-data radius", () => {
  it("round-trips", () => {
    const s = encodeRadius(42, 100);
    expect(s).toBe("l;42;r;100");
    expect(decodeRadius(s)).toEqual({ kind: "radius", locId: 42, radius: 100 });
    expect(s.length).toBeLessThanOrEqual(64);
  });

  it("decode returns null for malformed", () => {
    expect(decodeRadius("x")).toBeNull();
    expect(decodeRadius("l;42;r;abc")).toBeNull();
  });
});

describe("callback-data magnitude", () => {
  it("round-trips", () => {
    const s = encodeMagnitude(7, 45);
    expect(s).toBe("l;7;m;45");
    expect(decodeMagnitude(s)).toEqual({ kind: "magnitude", locId: 7, magnitude: 45 });
    expect(s.length).toBeLessThanOrEqual(64);
  });

  it("decode rejects invalid magnitude", () => {
    expect(decodeMagnitude("l;7;m;999")).toBeNull();
  });
});

describe("callback-data radius menu", () => {
  it("encodes and decodes", () => {
    const s = encodeRadiusMenu(42);
    expect(s).toBe("l;42;r");
    expect(decodeRadiusMenu(s)).toEqual({ kind: "radiusMenu", locId: 42 });
    expect(s.length).toBeLessThanOrEqual(64);
  });

  it("does not collide with radius value", () => {
    expect(decodeRadiusMenu("l;5;r;100")).toBeNull();
  });
});

describe("callback-data magnitude menu", () => {
  it("encodes and decodes", () => {
    const s = encodeMagnitudeMenu(42);
    expect(s).toBe("l;42;m");
    expect(decodeMagnitudeMenu(s)).toEqual({ kind: "magnitudeMenu", locId: 42 });
    expect(s.length).toBeLessThanOrEqual(64);
  });

  it("does not collide with magnitude value", () => {
    expect(decodeMagnitudeMenu("l;5;m;45")).toBeNull();
  });
});

describe("callback-data event detail", () => {
  it("encodes and decodes", () => {
    const s = encodeEventDetail("INGV_20260630_1234");
    expect(s).toBe("ev;INGV_20260630_1234;det");
    expect(decodeEvDetail(s)).toEqual({ kind: "evDetail", eventId: "INGV_20260630_1234" });
    expect(s.length).toBeLessThanOrEqual(64);
  });
});

describe("callback-data delete", () => {
  it("encodeDelete", () => {
    expect(encodeDelete(3)).toBe("l;3;del");
    expect(encodeDeleteOk(3)).toBe("l;3;del;ok");
    expect(isDelete("l;3;del")).toBe(true);
    expect(isDelete("l;3;del;ok")).toBe(false);
    expect(isDeleteOk("l;3;del;ok")).toBe(true);
    expect(isDeleteOk("l;3;del")).toBe(false);
  });
});

describe("callback-data toggle", () => {
  it("round-trips", () => {
    expect(encodeToggle("ita", true)).toBe("set;ita;1");
    expect(encodeToggle("ita", false)).toBe("set;ita;0");
    expect(encodeToggle("wld", true)).toBe("set;wld;1");
    expect(decodeToggle("set;ita;1")).toEqual({ kind: "toggle", flag: "ita", value: true });
    expect(decodeToggle("set;wld;0")).toEqual({ kind: "toggle", flag: "wld", value: false });
  });

  it("rejects invalid", () => {
    expect(decodeToggle("x")).toBeNull();
    expect(decodeToggle("set;ita;2")).toBeNull();
  });
});

describe("callback-data nav", () => {
  it("round-trips", () => {
    expect(encodeNav("back")).toBe("nav;back");
    expect(encodeNav("home")).toBe("nav;home");
    expect(decodeNav("nav;back")).toEqual({ kind: "nav", target: "back" });
    expect(decodeNav("nav;home")).toEqual({ kind: "nav", target: "home" });
  });
});

describe("callback-data loc select", () => {
  it("round-trips", () => {
    expect(encodeLoc(5)).toBe("l;5");
    expect(decodeLoc("l;5")).toEqual({ kind: "loc", locId: 5 });
  });
});

describe("decode generic", () => {
  it("returns null for unknown format", () => {
    expect(decode("")).toBeNull();
    expect(decode("foo")).toBeNull();
  });

  it("dispatches correctly", () => {
    expect(decode("l;1;r;100")!.kind).toBe("radius");
    expect(decode("l;2;m;45")!.kind).toBe("magnitude");
    expect(decode("l;3;del")!.kind).toBe("delete");
    expect(decode("l;3;del;ok")!.kind).toBe("deleteOk");
    expect(decode("set;ita;1")!.kind).toBe("toggle");
    expect(decode("nav;home")!.kind).toBe("nav");
    expect(decode("l;5")!.kind).toBe("loc");

    expect(decode("l;5;r;100")!.kind).toBe("radius");
    expect(decode("l;5;r")!.kind).toBe("radiusMenu");
    expect(decode("l;5;m")!.kind).toBe("magnitudeMenu");
    expect(decode("ev;id123;det")!.kind).toBe("evDetail");
  });

  it("always ≤ 64 bytes", () => {
    for (const [fn, args] of [
      [encodeRadius, [100000, 300]],
      [encodeMagnitude, [100000, 50]],
      [encodeRadiusMenu, [100000]],
      [encodeMagnitudeMenu, [100000]],
      [encodeDelete, [100000]],
      [encodeDeleteOk, [100000]],
      [encodeToggle, ["ita", true]],
      [encodeToggle, ["wld", false]],
      [encodeNav, ["back"]],
      [encodeNav, ["home"]],
      [encodeLoc, [100000]],
      [encodeEventDetail, ["INGV_20260630_123456"]],
    ] as const) {
      const s = (fn as (...a: unknown[]) => string)(...args);
      expect(s.length).toBeLessThanOrEqual(64);
    }
  });
});
