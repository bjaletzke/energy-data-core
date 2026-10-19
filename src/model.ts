/**
 * Gas storage data model and parsing helpers.
 *
 * The shapes follow the GIE AGSI+ API manual (v007, October 2022):
 * `GET https://agsi.gie.eu/api` returns `{ last_page, total, dataset, gas_day, data: [...] }`
 * where every numeric field arrives as a string ("853.4219"). Units:
 * gasInStorage / workingGasVolume / consumption in TWh, injection / withdrawal /
 * capacities in GWh per day, full and consumptionFull in %, trend in
 * percentage points of working gas volume per day.
 */

export type Status = "C" | "E" | "N";

export const STATUS_LABEL: Record<Status, string> = {
  C: "Confirmed",
  E: "Estimated",
  N: "No data",
};

export type RawRow = Record<string, unknown>;

export interface AgsiPage<T = RawRow> {
  last_page: number;
  total: number;
  dataset: string;
  gas_day: string;
  data: T[];
}

export type Group = "EU" | "NE";

export interface StorageRow {
  name: string;
  code: string;
  url: string;
  /** Gas day start, ISO date (YYYY-MM-DD). */
  gasDayStart: string;
  gasInStorage: number | null;
  consumption: number | null;
  consumptionFull: number | null;
  injection: number | null;
  withdrawal: number | null;
  netWithdrawal: number | null;
  workingGasVolume: number | null;
  injectionCapacity: number | null;
  withdrawalCapacity: number | null;
  status: Status;
  trend: number | null;
  full: number | null;
  info: string[];
  /** EU or non-EU, set by the snapshot builder for country rows. */
  group?: Group;
  children?: StorageRow[];
}

/** A compact daily point for histories (keeps payloads small). */
export interface HistoryPoint {
  date: string;
  full: number | null;
  gasInStorage: number | null;
  injection: number | null;
  withdrawal: number | null;
  workingGasVolume: number | null;
  trend: number | null;
  status: Status;
}

// ---------------------------------------------------------------------------
// Country codes
// ---------------------------------------------------------------------------

/**
 * GIE publishes two United Kingdom rows: "United Kingdom (Pre-Brexit)" as GB
 * (a retired dataset, always N) and "United Kingdom (Post-Brexit)" as "GB*".
 * The site shows one UK, coded GB, and talks to GIE with its own code.
 */
export function normaliseCountryCode(code: string): string {
  const upper = code.toUpperCase();
  return upper === "GB*" ? "GB" : upper;
}

export function upstreamCountryCode(code: string): string {
  const upper = code.toUpperCase();
  return upper === "GB" ? "GB*" : upper;
}

/** GIE suffixes the post-Brexit UK rows, down to its operators and terminals; one UK needs no suffix. */
export function tidyName(name: string): string {
  return name.replace(/\s*\(post-brexit\)\s*$/i, "");
}

/** Rows of datasets GIE keeps for history only; they carry no figures and are dropped from snapshots. */
export function isRetiredRow(row: { name: string }): boolean {
  return /\(pre-brexit\)/i.test(row.name);
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Parse an AGSI numeric string. Returns null for missing or unparsable values, never 0. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s || s === "-" || s.toUpperCase() === "N/A") return null;
  // AGSI JSON uses "." decimals. Be tolerant of "1,234.56" and "12,5".
  const normalised = s.includes(",") && !s.includes(".") ? s.replace(",", ".") : s.replace(/,/g, "");
  const n = Number(normalised);
  return Number.isFinite(n) ? n : null;
}

export function toStatus(value: unknown): Status {
  return value === "C" || value === "E" || value === "N" ? value : "N";
}

export function toIsoDate(value: unknown): string {
  if (typeof value !== "string") return "";
  // Accept "2022-04-04", "2022-04-04 06:00:00" and "2022-04-04T06:00:00Z".
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v)));
}

export function parseRow(raw: RawRow): StorageRow {
  const row: StorageRow = {
    name: typeof raw.name === "string" ? tidyName(raw.name) : "",
    code: typeof raw.code === "string" ? raw.code : "",
    url: typeof raw.url === "string" ? raw.url : "",
    gasDayStart: toIsoDate(raw.gasDayStart),
    gasInStorage: toNumber(raw.gasInStorage),
    consumption: toNumber(raw.consumption),
    consumptionFull: toNumber(raw.consumptionFull),
    injection: toNumber(raw.injection),
    withdrawal: toNumber(raw.withdrawal),
    netWithdrawal: toNumber(raw.netWithdrawal),
    workingGasVolume: toNumber(raw.workingGasVolume),
    injectionCapacity: toNumber(raw.injectionCapacity),
    withdrawalCapacity: toNumber(raw.withdrawalCapacity),
    status: toStatus(raw.status),
    trend: toNumber(raw.trend),
    full: toNumber(raw.full),
    info: toStringArray(raw.info),
  };
  if (Array.isArray(raw.children) && raw.children.length > 0) {
    row.children = raw.children.filter((c): c is RawRow => !!c && typeof c === "object").map(parseRow);
  }
  if (row.netWithdrawal === null && row.withdrawal !== null && row.injection !== null) {
    row.netWithdrawal = row.withdrawal - row.injection;
  }
  return row;
}

export function parseRows(rows: unknown): StorageRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r): r is RawRow => !!r && typeof r === "object").map(parseRow);
}

export function toHistoryPoint(row: StorageRow): HistoryPoint {
  return {
    date: row.gasDayStart,
    full: row.full,
    gasInStorage: row.gasInStorage,
    injection: row.injection,
    withdrawal: row.withdrawal,
    workingGasVolume: row.workingGasVolume,
    trend: row.trend,
    status: row.status,
  };
}

/** Ascending by gas day, de-duplicated on date (last one wins). */
export function sortHistory(points: HistoryPoint[]): HistoryPoint[] {
  const byDate = new Map<string, HistoryPoint>();
  for (const p of points) if (p.date) byDate.set(p.date, p);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Dates and seasons
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export function isoToUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function utcToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return utcToIso(isoToUtc(iso) + days * DAY_MS);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((isoToUtc(toIso) - isoToUtc(fromIso)) / DAY_MS);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Day of year, 1-based (a raw count from 1 January, so leap years run one ahead after February). */
export function dayOfYear(iso: string): number {
  const y = Number(iso.slice(0, 4));
  return Math.round((isoToUtc(iso) - Date.UTC(y, 0, 1)) / DAY_MS) + 1;
}

// Cumulative days before each month in a fixed 366-day calendar (February always 29).
const CALENDAR_OFFSET = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

/**
 * Position of a date in a fixed 366-slot calendar, so 1 March is slot 61 and
 * 1 November slot 306 in every year. Use this to align years against each
 * other (the five-year band, season lines); 29 February takes slot 60 and is
 * simply absent in common years.
 */
export function calendarIndex(iso: string): number {
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return (CALENDAR_OFFSET[m - 1] ?? 0) + d;
}

/** The EU storage regulation's headline fill target, in percent. */
export const TARGET_FULL = 90;

export interface TargetOutlook {
  /** Days until the target at today's trend; null when the trend does not point there. */
  days: number | null;
  /** The projected date, when `days` is known. */
  date: string | null;
  /** Already at or above the target. */
  reached: boolean;
}

/**
 * How far away the fill target is at today's trend (percentage points per day).
 * Purely arithmetic: (target − full) / trend, rounded up to whole days.
 */
export function targetOutlook(full: number | null, trend: number | null, gasDay: string, target = TARGET_FULL): TargetOutlook {
  if (full === null) return { days: null, date: null, reached: false };
  if (full >= target) return { days: 0, date: gasDay, reached: true };
  if (trend === null || trend <= 0) return { days: null, date: null, reached: false };
  const days = Math.ceil((target - full) / trend);
  return { days, date: addDays(gasDay, days), reached: false };
}

export type Season = "injection" | "withdrawal";

export interface SeasonInfo {
  season: Season;
  /** 1-based day within the season. */
  dayOfSeason: number;
  /** Total days in the season. */
  seasonLength: number;
  /** The next boundary: 1 November for injection, 1 April for withdrawal. */
  targetDate: string;
  daysToTarget: number;
  /** "2026/27" style gas-year label (gas year starts 1 October per EU convention; label by injection year). */
  label: string;
}

/**
 * Injection season runs 1 April – 31 October (gas is put into storage for winter).
 * Withdrawal season runs 1 November – 31 March. These are the conventional
 * boundaries used across the European storage market and on AGSI's own charts.
 */
export function seasonInfo(iso: string): SeasonInfo {
  const y = Number(iso.slice(0, 4));
  const apr1 = `${y}-04-01`;
  const nov1 = `${y}-11-01`;
  if (iso >= apr1 && iso < nov1) {
    return {
      season: "injection",
      dayOfSeason: daysBetween(apr1, iso) + 1,
      seasonLength: daysBetween(apr1, nov1),
      targetDate: nov1,
      daysToTarget: daysBetween(iso, nov1),
      label: `${y}`,
    };
  }
  // Withdrawal: from 1 Nov of the previous or this year to 1 Apr of the next.
  const startYear = iso >= nov1 ? y : y - 1;
  const start = `${startYear}-11-01`;
  const end = `${startYear + 1}-04-01`;
  return {
    season: "withdrawal",
    dayOfSeason: daysBetween(start, iso) + 1,
    seasonLength: daysBetween(start, end),
    targetDate: end,
    daysToTarget: daysBetween(iso, end),
    label: `${startYear}/${String(startYear + 1).slice(2)}`,
  };
}
