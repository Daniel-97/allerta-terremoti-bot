import { describe, it, expect } from "vitest";
import { composeProximity, composeNational, composeWorld, formatTime } from "../../src/notify/compose";
import type { ParsedEvent } from "../../src/ingv/types";

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

  it("uses event coordinates for the venue", () => {
    expect(msg.latitude).toBe(41.9);
    expect(msg.longitude).toBe(12.5);
  });

  it("includes magnitude, zone and alert emoji in title", () => {
    expect(msg.title).toContain("4.2");
    expect(msg.title).toContain(EVENT.zone);
    expect(msg.title).toContain("⚠️");
  });

  it("includes location name and distance in address", () => {
    expect(msg.address).toContain("Roma");
    expect(msg.address).toContain("15 km");
  });

  it("has inline keyboard with details and source buttons", () => {
    expect(buttonCount(msg.keyboard)).toBe(2);
  });
});

describe("composeNational", () => {
  it("includes location and distance in address when present", () => {
    const msg = composeNational(EVENT, 200, "Milano");
    expect(msg.address).toContain("Milano");
    expect(msg.address).toContain("200 km");
  });

  it("falls back to event.zone when no location", () => {
    const msg = composeNational(EVENT, null, null);
    expect(msg.address).toContain(EVENT.zone);
    expect(msg.address).not.toMatch(/\d+ km da/);
  });

  it("includes zone and alert emoji in title", () => {
    const msg = composeNational(EVENT, 200, "Milano");
    expect(msg.title).toContain(EVENT.zone);
    expect(msg.title).toContain("⚠️");
  });
});

describe("composeWorld", () => {
  it("uses event.zone in address with no distance phrase", () => {
    const msg = composeWorld(EVENT);
    expect(msg.address).toContain("Roma");
    expect(msg.address).not.toMatch(/\d+ km da/);
  });

  it("includes zone and alert emoji in title", () => {
    const msg = composeWorld(EVENT);
    expect(msg.title).toContain(EVENT.zone);
    expect(msg.title).toContain("⚠️");
  });
});

describe("source url guard", () => {
  it("omits the source button when eventId is empty", () => {
    const noIdEvent = { ...EVENT, eventId: "" };
    const msg = composeWorld(noIdEvent);
    expect(buttonCount(msg.keyboard)).toBe(1);
  });
});

describe("title/address length limits", () => {
  it("truncates address when location name is very long", () => {
    const longName = "A".repeat(200);
    const msg = composeProximity(EVENT, 15, longName);
    expect(msg.address.length).toBeLessThanOrEqual(100);
  });
});

describe("formatTime", () => {
  it("returns Italian locale time", () => {
    const f = formatTime("2026-06-30T12:00:00");
    expect(f).toContain("30/06/2026");
  });
});
