export interface RadiusCb {
  kind: "radius";
  locId: number;
  radius: number;
}
export interface MagnitudeCb {
  kind: "magnitude";
  locId: number;
  magnitude: number;
}
export interface DeleteCb {
  kind: "delete";
  locId: number;
}
export interface DeleteOkCb {
  kind: "deleteOk";
  locId: number;
}
export interface ToggleCb {
  kind: "toggle";
  flag: "ita" | "wld";
  value: boolean;
}
export interface RadiusMenuCb {
  kind: "radiusMenu";
  locId: number;
}
export interface MagnitudeMenuCb {
  kind: "magnitudeMenu";
  locId: number;
}
export interface NavCb {
  kind: "nav";
  target: "back" | "home";
}
export interface LocCb {
  kind: "loc";
  locId: number;
}
export interface EvDetailCb {
  kind: "evDetail";
  eventId: string;
}
export interface EvMapCb {
  kind: "evMap";
  eventId: string;
}

export type Callback =
  | RadiusCb
  | MagnitudeCb
  | RadiusMenuCb
  | MagnitudeMenuCb
  | DeleteCb
  | DeleteOkCb
  | ToggleCb
  | NavCb
  | LocCb
  | EvDetailCb
  | EvMapCb;

// radius
export function encodeRadius(locId: number, radius: number): string {
  return `l;${locId};r;${radius}`;
}
export function decodeRadius(s: string): RadiusCb | null {
  const m = s.match(/^l;(\d+);r;(\d+)$/);
  if (!m) return null;
  const r = Number(m[2]);
  if (r < 1 || r > 300) return null;
  return { kind: "radius", locId: Number(m[1]), radius: r };
}

// magnitude
export function encodeMagnitude(locId: number, magnitude: number): string {
  return `l;${locId};m;${magnitude}`;
}
export function decodeMagnitude(s: string): MagnitudeCb | null {
  const m = s.match(/^l;(\d+);m;(\d+)$/);
  if (!m) return null;
  const v = Number(m[2]);
  if (v < 20 || v > 50) return null;
  return { kind: "magnitude", locId: Number(m[1]), magnitude: v };
}

// radius menu (open preset picker, no value)
export function encodeRadiusMenu(locId: number): string {
  return `l;${locId};r`;
}
export function decodeRadiusMenu(s: string): RadiusMenuCb | null {
  const m = s.match(/^l;(\d+);r$/);
  if (!m) return null;
  return { kind: "radiusMenu", locId: Number(m[1]) };
}

// magnitude menu (open preset picker, no value)
export function encodeMagnitudeMenu(locId: number): string {
  return `l;${locId};m`;
}
export function decodeMagnitudeMenu(s: string): MagnitudeMenuCb | null {
  const m = s.match(/^l;(\d+);m$/);
  if (!m) return null;
  return { kind: "magnitudeMenu", locId: Number(m[1]) };
}

// delete
export function encodeDelete(locId: number): string {
  return `l;${locId};del`;
}
export function encodeDeleteOk(locId: number): string {
  return `l;${locId};del;ok`;
}
export function isDelete(s: string): boolean {
  return /^l;\d+;del$/.test(s);
}
export function isDeleteOk(s: string): boolean {
  return /^l;\d+;del;ok$/.test(s);
}
export function decodeDelete(s: string): DeleteCb | null {
  if (!isDelete(s)) return null;
  const locId = Number(s.split(";")[1]);
  return { kind: "delete", locId };
}
export function decodeDeleteOk(s: string): DeleteOkCb | null {
  if (!isDeleteOk(s)) return null;
  const locId = Number(s.split(";")[1]);
  return { kind: "deleteOk", locId };
}

// toggle
export function encodeToggle(flag: "ita" | "wld", value: boolean): string {
  return `set;${flag};${value ? 1 : 0}`;
}
export function decodeToggle(s: string): ToggleCb | null {
  const m = s.match(/^set;(ita|wld);([01])$/);
  if (!m) return null;
  return { kind: "toggle", flag: m[1] as "ita" | "wld", value: m[2] === "1" };
}

// nav
export function encodeNav(target: "back" | "home"): string {
  return `nav;${target}`;
}
export function decodeNav(s: string): NavCb | null {
  const m = s.match(/^nav;(back|home)$/);
  if (!m) return null;
  return { kind: "nav", target: m[1] as "back" | "home" };
}

// loc select
export function encodeLoc(locId: number): string {
  return `l;${locId}`;
}
export function decodeLoc(s: string): LocCb | null {
  const m = s.match(/^l;(\d+)$/);
  if (!m) return null;
  return { kind: "loc", locId: Number(m[1]) };
}

// event detail
export function encodeEventDetail(eventId: string): string {
  return `ev;${eventId};det`;
}
export function decodeEvDetail(s: string): EvDetailCb | null {
  const m = s.match(/^ev;(.+);det$/);
  if (!m) return null;
  return { kind: "evDetail", eventId: m[1]! };
}

// event map
export function encodeEventMap(eventId: string): string {
  return `ev;${eventId};map`;
}
export function decodeEvMap(s: string): EvMapCb | null {
  const m = s.match(/^ev;(.+);map$/);
  if (!m) return null;
  return { kind: "evMap", eventId: m[1]! };
}

// generic decode dispatcher
export function decode(s: string): Callback | null {
  if (!s) return null;
  return (
    decodeRadius(s) ??
    decodeMagnitude(s) ??
    decodeRadiusMenu(s) ??
    decodeMagnitudeMenu(s) ??
    decodeDeleteOk(s) ??
    decodeDelete(s) ??
    decodeToggle(s) ??
    decodeNav(s) ??
    decodeLoc(s) ??
    decodeEvDetail(s) ??
    decodeEvMap(s) ??
    null
  );
}
