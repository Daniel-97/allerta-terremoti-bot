import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reverseGeocode } from "../../src/geocoding/geonames";

function mockFetchOnce(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status }),
  );
}

describe("reverseGeocode", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 'Comune (PROV)' when adminCode2 present", async () => {
    mockFetchOnce({ geonames: [{ toponymName: "Roma", adminCode2: "RM" }] });
    const r = await reverseGeocode(41.9, 12.5, "user");
    expect(r).toBe("Roma (RM)");
  });

  it("returns 'Comune' without province when adminCode2 absent", async () => {
    mockFetchOnce({ geonames: [{ toponymName: "Trento" }] });
    const r = await reverseGeocode(46.07, 11.13, "user");
    expect(r).toBe("Trento");
  });

  it("returns null on empty geonames array", async () => {
    mockFetchOnce({ geonames: [] });
    expect(await reverseGeocode(0, 0, "user")).toBeNull();
  });

  it("returns null on http error", async () => {
    mockFetchOnce({}, 500);
    expect(await reverseGeocode(41.9, 12.5, "user")).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network"));
    expect(await reverseGeocode(41.9, 12.5, "user")).toBeNull();
  });

  // timeout test skipped: requires real timers and AbortController, fragile under fake timers
});
