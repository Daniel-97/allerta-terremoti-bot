import { describe, it, expect } from "vitest";
import { composeProximity, composeNational, composeWorld, formatTime, formatTitle } from "@/notify/compose";
import type { ParsedEvent } from "@/services/ingv/types";

const EVENT: ParsedEvent = {
  eventId: "ev1", zone: "Roma", time: "2026-06-30T12:00:00",
  lat: 41.9, lon: 12.5, depth: 10, author: "INGV", catalog: "INGV",
  contributor: "INGV", contributorId: "I1", magType: "ML",
  magnitude: 4.2, magAuthor: "INGV",
};

function buttonCount(kb: { inline_keyboard: unknown[][] }): number {
  return kb.inline_keyboard.flat().length;
}

describe("composeProximity", () => {
  const msg = composeProximity(EVENT, 15, "Roma");

  it("includes magnitude and zone in a single title line", () => {
    expect(msg.text).toContain("⚠️ Terremoto *M4.2* - Roma");
  });

  it("includes location name and distance", () => {
    expect(msg.text).toContain("📍 *Roma* — 15 km");
  });

  it("includes depth and time", () => {
    expect(msg.text).toContain("📏 Profondità: 10.0 km");
    expect(msg.text).toContain(formatTime(EVENT.time));
  });

  it("includes INGV source line", () => {
    expect(msg.text).toContain("_Fonte: INGV_");
  });

  it("has inline keyboard with INGV and Mappa buttons", () => {
    expect(buttonCount(msg.keyboard)).toBe(2);
  });
});

describe("composeNational", () => {
  it("includes location and distance when present", () => {
    const msg = composeNational(EVENT, 200, "Milano");
    expect(msg.text).toContain("📍 *Milano* — 200 km");
  });

  it("falls back to event.zone when no location", () => {
    const msg = composeNational(EVENT, null, null);
    expect(msg.text).not.toContain("📍");
    expect(msg.text).toContain("⚠️ Terremoto *M4.2* - Roma");
  });

  it("includes magnitude and zone in a single title line", () => {
    const msg = composeNational(EVENT, 200, "Milano");
    expect(msg.text).toContain("⚠️ Terremoto *M4.2* - Roma");
  });
});

describe("composeWorld", () => {
  it("uses event.zone with no location line", () => {
    const msg = composeWorld(EVENT);
    expect(msg.text).toContain("⚠️ Terremoto *M4.2* - Roma");
    expect(msg.text).not.toContain("📍");
  });

  it("includes magnitude and zone in a single title line", () => {
    const msg = composeWorld(EVENT);
    expect(msg.text).toContain("⚠️ Terremoto *M4.2* - Roma");
  });
});

describe("keyboard eventId guard", () => {
  it("omits both buttons when eventId is empty", () => {
    const noIdEvent = { ...EVENT, eventId: "" };
    const msg = composeWorld(noIdEvent);
    expect(buttonCount(msg.keyboard)).toBe(0);
  });

  it("includes both buttons when eventId is present", () => {
    const msg = composeWorld(EVENT);
    expect(buttonCount(msg.keyboard)).toBe(2);
  });
});

describe("formatTitle", () => {
  it("wraps the magnitude in markdown bold by default", () => {
    expect(formatTitle(4.2, "Roma")).toBe("⚠️ Terremoto *M4.2* - Roma");
  });

  it("omits markdown when markdown is false", () => {
    expect(formatTitle(4.2, "Roma", false)).toBe("⚠️ Terremoto M4.2 - Roma");
  });

  it("omits the 'Terremoto' label when includeLabel is false", () => {
    expect(formatTitle(4.2, "Roma", false, false)).toBe("⚠️ M4.2 - Roma");
  });
});

describe("formatTime", () => {
  it("returns Italian locale time", () => {
    const f = formatTime("2026-06-30T12:00:00");
    expect(f).toContain("30/06/2026");
  });
});
