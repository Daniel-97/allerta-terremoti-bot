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
  encodeAiuto,
  decodeAiuto,
  decode,
} from "@/util/callback-data";

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
    expect(encodeNav("add")).toBe("nav;add");
    expect(decodeNav("nav;back")).toEqual({ kind: "nav", target: "back" });
    expect(decodeNav("nav;add")).toEqual({ kind: "nav", target: "add" });
    expect(decodeNav("nav;home")).toBeNull();
  });
});

describe("callback-data loc select", () => {
  it("round-trips", () => {
    expect(encodeLoc(5)).toBe("l;5");
    expect(decodeLoc("l;5")).toEqual({ kind: "loc", locId: 5 });
  });
});

describe("callback-data aiuto", () => {
  it("round-trips each target", () => {
    for (const target of ["posizioni", "impostazioni", "credits", "menu"] as const) {
      const s = encodeAiuto(target);
      expect(s).toBe(`aiuto;${target}`);
      expect(decodeAiuto(s)).toEqual({ kind: "aiuto", target });
      expect(s.length).toBeLessThanOrEqual(64);
    }
  });

  it("decode rejects invalid target", () => {
    expect(decodeAiuto("aiuto;foo")).toBeNull();
    expect(decodeAiuto("aiuto")).toBeNull();
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
    expect(decode("nav;back")!.kind).toBe("nav");
    expect(decode("l;5")!.kind).toBe("loc");
    expect(decode("aiuto;posizioni")!.kind).toBe("aiuto");

    expect(decode("l;5;r;100")!.kind).toBe("radius");
    expect(decode("l;5;r")!.kind).toBe("radiusMenu");
    expect(decode("l;5;m")!.kind).toBe("magnitudeMenu");
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
      [encodeNav, ["add"]],
      [encodeLoc, [100000]],
      [encodeAiuto, ["impostazioni"]],
    ] as const) {
      const s = (fn as (...a: unknown[]) => string)(...args);
      expect(s.length).toBeLessThanOrEqual(64);
    }
  });
});
