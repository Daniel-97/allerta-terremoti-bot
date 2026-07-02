import { createLogger } from "../util/log";
import { captureWarning } from "../util/error-handler";
import { ITALY_BBOX } from "../util/geo-bbox";
import { parseFdsnText } from "./parser";
import type { ParsedEvent } from "./types";

const log = createLogger("ingv");
const ENDPOINT = "https://webservices.ingv.it/fdsnws/event/1/query";
const TIMEOUT_MS = 10000;

function buildUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `${ENDPOINT}?${qs}`;
}

export async function fetchItalyEvents(lookbackWindowMin: number): Promise<ParsedEvent[]> {
  const startTime = new Date(Date.now() - lookbackWindowMin * 60_000)
    .toISOString()
    .replace(/\.\d{3}Z$/, '');
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

export async function fetchWorldEvents(lookbackWindowMin: number, minMagnitude: number): Promise<ParsedEvent[]> {
  const startTime = new Date(Date.now() - lookbackWindowMin * 60_000)
    .toISOString()
    .replace(/\.\d{3}Z$/, '');
  const url = buildUrl({
    format: "text",
    starttime: startTime,
    minmagnitude: String(minMagnitude),
  });
  return fetchText(url);
}

async function fetchText(url: string): Promise<ParsedEvent[]> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().then((t) => t.slice(0, 500)).catch(() => "");
      log.warn({ status: res.status, body, url }, "ingv http error");
      return [];
    }
    const text = await res.text();
    const parsed = parseFdsnText(text);
    log.info({ count: parsed.length }, "ingv events fetched");
    return parsed;
  } catch (err) {
    captureWarning(log, err, { url, action: "ingv fetch" });
    throw err;
  } finally {
    clearTimeout(tid);
  }
}
