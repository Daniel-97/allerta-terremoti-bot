import { createLogger } from "../util/log";
import { ITALY_BBOX } from "../util/geo-bbox";
import { WORLD_ALERT_THRESHOLD, LOOKBACK_WINDOW_MIN } from "../util/constants";
import { parseFdsnText } from "./parser";
import type { ParsedEvent } from "./types";

const log = createLogger("ingv");
const ENDPOINT = "https://webservices.ingv.it/fdsnws/event/1/query";
const TIMEOUT_MS = 10000;

function buildUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `${ENDPOINT}?${qs}`;
}

export async function fetchItalyEvents(): Promise<ParsedEvent[]> {
  const startTime = new Date(Date.now() - LOOKBACK_WINDOW_MIN * 60_000).toISOString();
  const url = buildUrl({
    format: "text",
    starttime: startTime,
    minlatitude: String(ITALY_BBOX.minLat),
    maxlatitude: String(ITALY_BBOX.maxLat),
    minlongitude: String(ITALY_BBOX.minLon),
    maxlongitude: String(ITALY_BBOX.maxLon),
  });
  return fetchText(url);
}

export async function fetchWorldEvents(): Promise<ParsedEvent[]> {
  const startTime = new Date(Date.now() - LOOKBACK_WINDOW_MIN * 60_000).toISOString();
  const url = buildUrl({
    format: "text",
    starttime: startTime,
    minmagnitude: String(WORLD_ALERT_THRESHOLD),
  });
  return fetchText(url);
}

async function fetchText(url: string): Promise<ParsedEvent[]> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      log.warn({ status: res.status, url }, "ingv http error");
      throw new Error(`INGV HTTP ${res.status}`);
    }
    const text = await res.text();
    const parsed = parseFdsnText(text);
    log.info({ count: parsed.length }, "ingv events fetched");
    return parsed;
  } catch (err) {
    const errName = err instanceof Error ? err.name : "unknown";
    const errMsg = err instanceof Error ? err.message : String(err);
    log.warn({ errName, errMsg, url }, "ingv fetch error");
    throw err;
  } finally {
    clearTimeout(tid);
  }
}
