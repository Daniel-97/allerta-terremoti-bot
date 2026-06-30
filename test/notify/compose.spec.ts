import { describe, it, expect } from "vitest";
import { composeProximity, composeNational, composeWorld, formatTime } from "../../src/notify/compose";
import type { ParsedEvent } from "../../src/ingv/types";

const EVENT: ParsedEvent = {
  eventId: "ev1", zone: "Roma", time: "2026-06-30T12:00:00",
  lat: 41.9, lon: 12.5, depth: 10, author: "INGV", catalog: "INGV",
  contributor: "INGV", contributorId: "I1", magType: "ML",
  magnitude: 4.2, magAuthor: "INGV",
};

describe("composeProximity", () => {
  const msg = composeProximity(EVENT, 15, "Roma");

  it("includes location name and distance", () => {
    expect(msg.text).toContain("Roma");
    expect(msg.text).toContain("15 km");
  });

  it("includes magnitude", () => {
    expect(msg.text).toContain("4.2");
  });

  it("has inline keyboard", () => {
    expect(msg.keyboard).toBeDefined();
  });
});

describe("composeNational", () => {
  it("includes location line when present", () => {
    const msg = composeNational(EVENT, 200, "Milano");
    expect(msg.text).toContain("Milano");
    expect(msg.text).toContain("200 km");
  });

  it("omits distance line when no location", () => {
    const msg = composeNational(EVENT, null, null);
    expect(msg.text).not.toContain("📍");
    expect(msg.text).toContain("km"); // depth line still present
  });
});

describe("composeWorld", () => {
  it("includes no location emoji in body", () => {
    const msg = composeWorld(EVENT);
    expect(msg.text).toContain("Roma");
    expect(msg.text).not.toContain("📍");
  });
});

describe("formatTime", () => {
  it("returns Italian locale time", () => {
    const f = formatTime("2026-06-30T12:00:00");
    expect(f).toContain("30/06/2026");
  });
});
