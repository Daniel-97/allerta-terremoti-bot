import { createLogger } from "@/util/log";

const log = createLogger("geonames");
const ENDPOINT = "https://secure.geonames.org/findNearbyPlaceNameJSON";
const TIMEOUT_MS = 4000;
const MAX_BODY_LOG_LENGTH = 500;

export interface GeoName {
  toponymName: string;
  adminCode2?: string;
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  username: string,
): Promise<string | null> {
  const url = `${ENDPOINT}?lat=${lat}&lng=${lon}&username=${username}&maxRows=1&style=SHORT`;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      const body = await res
        .text()
        .then((t) => t.slice(0, MAX_BODY_LOG_LENGTH))
        .catch(() => "");
      const msg = res.status >= 500 ? "geonames server error" : "geonames client error";
      log.warn({ status: res.status, body, lat, lon }, msg);
      return null;
    }
    const data = (await res.json()) as { geonames?: GeoName[] };
    const g = data.geonames?.[0];
    if (!g) {
      log.info({ lat, lon }, "geonames: no results");
      return null;
    }
    return g.adminCode2 ? `${g.toponymName} (${g.adminCode2})` : g.toponymName;
  } catch (err) {
    const errName = err instanceof Error ? err.name : "unknown";
    const errMsg = err instanceof Error ? err.message : String(err);
    log.warn({ errName, errMsg, lat, lon }, "geonames network error");
    return null;
  } finally {
    clearTimeout(tid);
  }
}
