import { describe, it, expect } from "vitest";
import { composeProximity, composeGeneral, formatTime, formatTitle, formatMagType } from "@/notify/compose";
import { encodeLoc } from "@/util/callback-data";
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
  const msg = composeProximity(EVENT, 15, "Roma", 42);

  it("starts with the proximity reason label", () => {
    expect(msg.text.startsWith("🔔 *Allerta di prossimità*\n\n")).toBe(true);
  });

  it("includes magnitude and zone in a single title line", () => {
    expect(msg.text).toContain("⚠️ *Magnitudo:* 4.2 (ML) - Roma");
  });

  it("includes location name and distance", () => {
    expect(msg.text).toContain("📍 *Roma* — 15 km");
  });

  it("includes depth and time", () => {
    expect(msg.text).toContain("📏 *Profondità:* 10.0 km");
    expect(msg.text).toContain(`🕐 *Ora:* ${formatTime(EVENT.time)}`);
  });

  it("includes INGV source line", () => {
    expect(msg.text).toContain("*Fonte:* INGV");
  });

  it("has inline keyboard with the INGV and soglie buttons", () => {
    expect(buttonCount(msg.keyboard)).toBe(2);
  });

  it("includes a soglie button with the encoded location id", () => {
    const buttons = msg.keyboard.inline_keyboard.flat() as { text: string; callback_data?: string }[];
    const soglieBtn = buttons.find((b) => b.callback_data === encodeLoc(42));
    expect(soglieBtn?.text).toBe("⚙️ Soglie per Roma");
  });
});

describe("composeGeneral", () => {
  it("starts with the general reason label", () => {
    const msg = composeGeneral(EVENT, 200, "Milano");
    expect(msg.text.startsWith("📢 *Terremoto rilevante*\n\n")).toBe(true);
  });

  it("includes location and distance when present", () => {
    const msg = composeGeneral(EVENT, 200, "Milano");
    expect(msg.text).toContain("📍 *Milano* — 200 km");
  });

  it("falls back to event.zone when no location", () => {
    const msg = composeGeneral(EVENT, null, null);
    expect(msg.text).not.toContain("📍");
    expect(msg.text).toContain("⚠️ *Magnitudo:* 4.2 (ML) - Roma");
  });

  it("includes magnitude and zone in a single title line", () => {
    const msg = composeGeneral(EVENT, 200, "Milano");
    expect(msg.text).toContain("⚠️ *Magnitudo:* 4.2 (ML) - Roma");
  });
});

describe("keyboard eventId guard", () => {
  it("omits the button when eventId is empty", () => {
    const noIdEvent = { ...EVENT, eventId: "" };
    const msg = composeGeneral(noIdEvent, null, null);
    expect(buttonCount(msg.keyboard)).toBe(0);
  });

  it("includes the button when eventId is present", () => {
    const msg = composeGeneral(EVENT, null, null);
    expect(buttonCount(msg.keyboard)).toBe(1);
  });
});

describe("formatTitle", () => {
  it("wraps the 'Magnitudo' label in markdown bold by default", () => {
    expect(formatTitle(4.2, "Roma")).toBe("⚠️ *Magnitudo:* 4.2 - Roma");
  });

  it("omits markdown when markdown is false", () => {
    expect(formatTitle(4.2, "Roma", false)).toBe("⚠️ Magnitudo: 4.2 - Roma");
  });

  it("omits the 'Magnitudo' label when includeLabel is false", () => {
    expect(formatTitle(4.2, "Roma", false, false)).toBe("⚠️ 4.2 - Roma");
  });

  it("appends magType after the magnitude when provided", () => {
    expect(formatTitle(4.2, "Roma", true, true, "ML")).toBe("⚠️ *Magnitudo:* 4.2 (ML) - Roma");
  });

  it("omits the parenthesized magType when magType is empty", () => {
    expect(formatTitle(4.2, "Roma", true, true, "")).toBe("⚠️ *Magnitudo:* 4.2 - Roma");
  });
});

describe("formatMagType", () => {
  it("wraps a non-empty magType in parentheses with a leading space", () => {
    expect(formatMagType("ML")).toBe(" (ML)");
  });

  it("returns an empty string when magType is empty", () => {
    expect(formatMagType("")).toBe("");
  });
});

describe("formatTime", () => {
  it("returns Italian locale time", () => {
    const f = formatTime("2026-06-30T12:00:00");
    expect(f).toContain("30/06/2026");
  });
});
