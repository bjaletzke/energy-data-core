/**
 * LNG model and parsing helpers for the GIE ALSI+ field shapes.
 *
 * ALSI is the same API family as AGSI (GIE API manual v007): the same paging
 * envelope, the same parameters, the same single-day tree call, numbers as
 * strings. Fields differ: the LNG in the tanks and the declared total maximum
 * inventory come as `inventory: { lng, gwh }` and `dtmi: { lng, gwh }` (1000 m³
 * LNG and its energy content; the manual's flat `lngInventory` / `dtmi` strings
 * are accepted too), `sendOut` (GWh/d), `dtrs` (declared total reference
 * send-out, GWh/d), and `full` (%) and `trend` (points of DTMI per day) when
 * published; `full` is derived from the volumes otherwise. `status` C/E/N.
 * Reporting starts in 2012.
 */
import type { Group, RawRow, Status } from "./model.ts";
import { tidyName, toIsoDate, toNumber, toStatus } from "./model.ts";
import type { Region } from "./regions.ts";
import { sumOrNull, weightedAverage } from "./regions.ts";

/** ALSI history begins in 2012. */
export const LNG_EARLIEST = "2012-01-01";

export interface LngRow {
  name: string;
  code: string;
  url: string;
  /** Gas day start, ISO date (YYYY-MM-DD). */
  gasDayStart: string;
  /** LNG in the tanks, 1000 m³ LNG. */
  lngInventory: number | null;
  /** Send-out (regasified gas into the grid), GWh/d. */
  sendOut: number | null;
  /** Declared total maximum inventory, 1000 m³ LNG. */
  dtmi: number | null;
  /** Declared total reference send-out, GWh/d. */
  dtrs: number | null;
  status: Status;
  /** Daily change in the fill percentage, points per day. */
  trend: number | null;
  /** lngInventory over dtmi, %. */
  full: number | null;
  info: string[];
  /** EU or non-EU, set by the snapshot builder for country rows. */
  group?: Group;
  /** Countries under a group, operators under a country, terminals under an operator. */
  children?: LngRow[];
}

/** A compact daily point for histories. */
export interface LngHistoryPoint {
  date: string;
  full: number | null;
  lngInventory: number | null;
  sendOut: number | null;
  dtmi: number | null;
  dtrs: number | null;
  trend: number | null;
  status: Status;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v)));
}

/** A volume field: the flat string of the manual, or ALSI's `{ lng, gwh }` object, of which the LNG side is the one in 1000 m³. */
function toVolume(value: unknown): number | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return toNumber((value as { lng?: unknown }).lng);
  return toNumber(value);
}

export function parseLngRow(raw: RawRow): LngRow {
  const row: LngRow = {
    name: typeof raw.name === "string" ? tidyName(raw.name) : "",
    code: typeof raw.code === "string" ? raw.code : "",
    url: typeof raw.url === "string" ? raw.url : "",
    gasDayStart: toIsoDate(raw.gasDayStart),
    lngInventory: toVolume(raw.lngInventory ?? raw.inventory),
    sendOut: toNumber(raw.sendOut),
    dtmi: toVolume(raw.dtmi),
    dtrs: toNumber(raw.dtrs),
    status: toStatus(raw.status),
    trend: toNumber(raw.trend),
    full: toNumber(raw.full),
    info: toStringArray(raw.info),
  };
  if (Array.isArray(raw.children) && raw.children.length > 0) {
    row.children = raw.children.filter((c): c is RawRow => !!c && typeof c === "object").map(parseLngRow);
  }
  // `full` is published; derive it only when it is missing and both parts are there.
  if (row.full === null && row.lngInventory !== null && row.dtmi !== null && row.dtmi > 0) {
    row.full = Math.round((row.lngInventory / row.dtmi) * 10000) / 100;
  }
  return row;
}

export function parseLngRows(rows: unknown): LngRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r): r is RawRow => !!r && typeof r === "object").map(parseLngRow);
}

export function toLngHistoryPoint(row: LngRow): LngHistoryPoint {
  return {
    date: row.gasDayStart,
    full: row.full,
    lngInventory: row.lngInventory,
    sendOut: row.sendOut,
    dtmi: row.dtmi,
    dtrs: row.dtrs,
    trend: row.trend,
    status: row.status,
  };
}

/** Ascending by gas day, de-duplicated on date (last one wins). */
export function sortLngHistory(points: LngHistoryPoint[]): LngHistoryPoint[] {
  const byDate = new Map<string, LngHistoryPoint>();
  for (const p of points) if (p.date) byDate.set(p.date, p);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Send-out as a share of the declared reference send-out, in %; null when either side is missing. */
export function sendOutShare(row: { sendOut: number | null; dtrs: number | null }): number | null {
  if (row.sendOut === null || row.dtrs === null || row.dtrs <= 0) return null;
  return (row.sendOut / row.dtrs) * 100;
}

/**
 * A region's LNG row: sums for volumes and flows, fill as the summed inventory
 * over the summed DTMI, a DTMI-weighted trend. "No data" stays absent, never
 * zero; the status is C only when every member confirmed.
 */
export function lngRegionRow(region: Region, members: readonly LngRow[], gasDay: string): LngRow {
  const lngInventory = sumOrNull(members, (r) => r.lngInventory);
  const dtmi = sumOrNull(members, (r) => r.dtmi);
  const reported = members.filter((r) => r.status !== "N");
  const status: Status =
    reported.length === 0 ? "N" : reported.every((r) => r.status === "C") && reported.length === members.length ? "C" : "E";
  return {
    name: region.name,
    code: region.code,
    url: "",
    gasDayStart: gasDay,
    lngInventory,
    sendOut: sumOrNull(members, (r) => r.sendOut),
    dtmi,
    dtrs: sumOrNull(members, (r) => r.dtrs),
    status,
    trend: weightedAverage(
      members,
      (r) => r.trend,
      (r) => r.dtmi,
    ),
    full: lngInventory !== null && dtmi !== null && dtmi > 0 ? (lngInventory / dtmi) * 100 : null,
    info: [],
  };
}

/** The countries of a region that ALSI reports, in the snapshot's order. */
export function lngRegionMembers(region: Region, countries: readonly LngRow[]): LngRow[] {
  const codes = new Set(region.countries.map((c) => c.toUpperCase()));
  return countries.filter((c) => codes.has(c.code.toUpperCase()));
}
