import { describe, it, expect } from "vitest";
import { parseFdsnText } from "@/services/ingv/parser";

const FIXTURE = [
  "#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType",
  "11541241|2026-06-30T12:00:00|41.9|12.5|10.0|INGV|INGV|INGV|INGV_1|ML|4.2|INGV|Roma|earthquake",
  "11541242|2026-06-30T12:05:00|45.46|9.19|8.0|INGV|INGV|INGV|INGV_2|MW|5.1|INGV|Milano|earthquake",
  "11541243|2026-06-30T12:10:00|38.12|13.35|12.0|INGV|INGV|INGV|INGV_3|ML|3.8|INGV|Palermo|earthquake",
].join("\n");

describe("parseFdsnText", () => {
  it("parses fixture correctly", () => {
    const events = parseFdsnText(FIXTURE);
    expect(events).toHaveLength(3);
    expect(events[0]!.eventId).toBe("11541241");
    expect(events[0]!.lat).toBe(41.9);
    expect(events[0]!.lon).toBe(12.5);
    expect(events[0]!.magnitude).toBe(4.2);
    expect(events[0]!.magType).toBe("ML");
    expect(events[0]!.zone).toBe("Roma");
    expect(events[0]!.depth).toBe(10.0);
  });

  it("handles empty input", () => {
    expect(parseFdsnText("")).toEqual([]);
  });

  it("handles header-only input", () => {
    expect(parseFdsnText("#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType")).toEqual([]);
  });

  it("ignores extra EventType column", () => {
    const input = [
      "#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType",
      "1|2026-06-30T12:00:00|41.9|12.5|10.0|INGV|INGV|INGV|ID|ML|4.2|INGV|Roma|explosion",
    ].join("\n");
    const events = parseFdsnText(input);
    expect(events).toHaveLength(1);
    expect(events[0]!.eventId).toBe("1");
  });

  it("accepts case-insensitive header (depth/km)", () => {
    const input = [
      "#EventID|Time|Latitude|Longitude|Depth/km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType",
      "1|2026-06-30T12:00:00|41.9|12.5|10.0|INGV|INGV|INGV|ID|ML|4.2|INGV|Roma|earthquake",
    ].join("\n");
    const events = parseFdsnText(input);
    expect(events).toHaveLength(1);
    expect(events[0]!.magnitude).toBe(4.2);
  });

  it("throws on invalid header", () => {
    expect(() => parseFdsnText("wrong")).toThrow();
  });
});
