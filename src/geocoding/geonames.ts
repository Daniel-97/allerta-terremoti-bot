import { createLogger } from "../util/log";

const log = createLogger("geonames");
const ENDPOINT = "https://secure.geonames.org/findNearbyPlaceNameJSON";
const TIMEOUT_MS = 4000;

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
      log.warn({ status: res.status, lat, lon }, "geonames http error");
      return null;
    }
    const data = (await res.json()) as { geonames?: GeoName[] };
    const g = data.geonames?.[0];
    if (!g) {
      log.info({ lat, lon }, "geonames: no results");
      return null;
    }
    return g.adminCode2
      ? `${g.toponymName} (${g.adminCode2})`
      : g.toponymName;
  } catch (err) {
    log.warn({ err: String(err), lat, lon }, "geonames request failed");
    return null;
  } finally {
    clearTimeout(tid);
  }
}
