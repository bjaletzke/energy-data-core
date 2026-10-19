/**
 * Time series: one value per interval start, in UTC
 * epoch milliseconds, null where the source published nothing. Helpers turn
 * ENTSO-E's positional periods into points, fold quarter hours into hours,
 * hours into UTC days, and the twenty production types into eight fuel groups.
 */
import type { ItemId } from "./items.ts";

export type Resolution = "PT15M" | "PT30M" | "PT60M" | "P1D" | "P7D";

export interface Point {
  ts: number;
  value: number | null;
}

export interface Series {
  item: ItemId;
  /** Caller-defined zone code, or the source EIC when parsing without a resolver. */
  zone: string;
  /** Original identifier, preserved by document parsing even when zone is mapped. */
  eic?: string;
  /** Production type for generation series (B01..B20); absent for load and reservoirs. */
  psrType?: string;
  resolution: Resolution;
  points: Point[];
}

const MS: Record<Resolution, number> = { PT15M: 900_000, PT30M: 1_800_000, PT60M: 3_600_000, P1D: 86_400_000, P7D: 7 * 86_400_000 };

export function resolutionMs(r: Resolution): number {
  return MS[r];
}

export function resolutionHours(r: Resolution): number {
  return MS[r] / 3_600_000;
}

export function isResolution(s: string): s is Resolution {
  return Object.hasOwn(MS, s);
}

export interface PeriodInput {
  start: string;
  end: string;
  resolution: Resolution;
  positions: { position: number; value: number | null }[];
  /** ENTSO-E's curve type; A03 means an omitted position repeats the previous value. */
  curveType?: string;
}

/**
 * Positions to points. The number of intervals comes from the period, not
 * from the positions present: since 2024 a publisher may omit positions whose
 * value did not change (curve type A03), and other gaps mean "not published".
 */
export function expandPeriod(p: PeriodInput): Point[] {
  const start = Date.parse(p.start);
  const end = Date.parse(p.end);
  const step = resolutionMs(p.resolution);
  const count = Math.max(0, Math.round((end - start) / step));
  const byPosition = new Map(p.positions.map((x) => [x.position, x.value]));
  const carry = p.curveType === "A03";
  const out: Point[] = [];
  let last: number | null = null;
  for (let i = 0; i < count; i++) {
    const has = byPosition.has(i + 1);
    const value: number | null = has ? (byPosition.get(i + 1) ?? null) : carry ? last : null;
    if (has) last = value;
    out.push({ ts: start + i * step, value });
  }
  return out;
}

/** Mean of the points inside each hour; null when an hour has no value. */
export function toHourly(points: Point[], resolution: Resolution): Point[] {
  if (resolution === "P1D" || resolution === "P7D") return points;
  // Hourly points fold to themselves; folding them anyway means a range that straddles a zone's
  // move from hourly to quarter-hourly publication is right on both sides of the switch.
  const hours = new Map<number, { sum: number; n: number }>();
  const order: number[] = [];
  for (const p of points) {
    const h = Math.floor(p.ts / 3_600_000) * 3_600_000;
    if (!hours.has(h)) {
      hours.set(h, { sum: 0, n: 0 });
      order.push(h);
    }
    if (p.value !== null) {
      const acc = hours.get(h) as { sum: number; n: number };
      acc.sum += p.value;
      acc.n += 1;
    }
  }
  return order.map((h) => {
    const acc = hours.get(h) as { sum: number; n: number };
    return { ts: h, value: acc.n ? acc.sum / acc.n : null };
  });
}

export interface DailyRow {
  day: string;
  mean: number | null;
  sum: number | null;
  min: number | null;
  max: number | null;
  n: number;
  /** The count a full UTC day would have at this row's resolution (24 hourly, 96 quarter-hourly); null when unknown. */
  expected: number | null;
  /** Hours with a reported value, inferred by toDailyMixed; omitted by count-only aggregators. */
  coveredHours?: number;
}

export function utcDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * UTC-day aggregates over the values present: mean (MW), sum as energy
 * (MWh: each value times the interval's hours), min, max, and the count,
 * against the count a full day would have at this resolution (so a caller
 * can tell a day that stopped partway through from one the source omitted).
 */
export function toDaily(points: Point[], resolutionHours = 1): DailyRow[] {
  const days = new Map<string, number[]>();
  const order: string[] = [];
  for (const p of points) {
    const d = utcDay(p.ts);
    if (!days.has(d)) {
      days.set(d, []);
      order.push(d);
    }
    if (p.value !== null) (days.get(d) as number[]).push(p.value);
  }
  const expected = Math.round(24 / resolutionHours);
  return order.map((day) => {
    const v = days.get(day) as number[];
    if (v.length === 0) return { day, mean: null, sum: null, min: null, max: null, n: 0, expected };
    const total = v.reduce((a, b) => a + b, 0);
    return { day, mean: total / v.length, sum: total * resolutionHours, min: Math.min(...v), max: Math.max(...v), n: v.length, expected };
  });
}

/**
 * The resolution of a run of points, from the most common spacing between neighbours (hourly
 * when there is only one point). Unlike `inferResolution`, which reads the first two points,
 * this survives a day that mixes two resolutions because the zone switched publication mid-day.
 */
export function modalResolution(points: Point[]): Resolution {
  const counts = new Map<number, number>();
  for (let i = 1; i < points.length; i++) {
    const gap = (points[i] as Point).ts - (points[i - 1] as Point).ts;
    counts.set(gap, (counts.get(gap) ?? 0) + 1);
  }
  let best = MS.PT60M;
  let bestN = 0;
  for (const [gap, n] of counts) if (n > bestN || (n === bestN && gap < best)) [best, bestN] = [gap, n];
  return best <= MS.PT15M ? "PT15M" : best <= MS.PT30M ? "PT30M" : best <= MS.PT60M ? "PT60M" : best <= MS.P1D ? "P1D" : "P7D";
}

/**
 * Daily rows for hourly/subhourly points whose resolution may change. Means are duration
 * weighted and coveredHours records the time represented by non-null values. Durations
 * are inferred from the following timestamp, capped at one hour; the final point uses
 * the preceding gap, or one hour when alone. Intervals stop at UTC midnight.
 * Preserve missing intervals as explicit null points: timestamps alone cannot distinguish
 * a resolution change from an omitted reading. Identical duplicates collapse; conflicting
 * values at the same timestamp throw. expected remains the modal count for comparison,
 * while isCompleteDay uses coveredHours for these rows.
 */
export function toDailyMixed(points: Point[]): DailyRow[] {
  const byDay = new Map<string, Point[]>();
  const order: string[] = [];
  const unique = new Map<number, Point>();
  for (const p of points) {
    if (unique.has(p.ts) && unique.get(p.ts)!.value !== p.value) throw new Error(`Conflicting values at timestamp ${p.ts}`);
    unique.set(p.ts, p);
  }
  for (const p of [...unique.values()].sort((a, b) => a.ts - b.ts)) {
    const d = utcDay(p.ts);
    if (!byDay.has(d)) {
      byDay.set(d, []);
      order.push(d);
    }
    (byDay.get(d) as Point[]).push(p);
  }
  return order.map((day) => {
    const dayPoints = (byDay.get(day) as Point[]).slice().sort((a, b) => a.ts - b.ts);
    const modal = resolutionMs(modalResolution(dayPoints));
    const expected = Math.round(86_400_000 / modal);
    const values: number[] = [];
    let energyHours = 0;
    let coveredHours = 0;
    const dayEnd = Date.parse(`${day}T00:00:00Z`) + 86_400_000;
    for (let i = 0; i < dayPoints.length; i++) {
      const p = dayPoints[i] as Point;
      if (p.value === null) continue;
      const next = dayPoints[i + 1];
      const prev = dayPoints[i - 1];
      const gap = next ? next.ts - p.ts : prev ? p.ts - prev.ts : modal;
      const hours = Math.min(gap, 3_600_000, dayEnd - p.ts) / 3_600_000;
      values.push(p.value);
      coveredHours += hours;
      energyHours += p.value * hours;
    }
    if (values.length === 0) return { day, mean: null, sum: null, min: null, max: null, n: 0, expected, coveredHours: 0 };
    return {
      day,
      mean: energyHours / coveredHours,
      sum: energyHours,
      min: Math.min(...values),
      max: Math.max(...values),
      n: values.length,
      expected,
      coveredHours,
    };
  });
}

/** Prefer duration coverage for mixed days; count-only rows retain their historical count/unknown-count rule. */
export function isCompleteDay(row: { n: number; expected: number | null; coveredHours?: number }): boolean {
  if (row.coveredHours !== undefined) return row.coveredHours >= 24;
  return row.expected == null || row.n >= row.expected;
}

/**
 * The resolution of a stored series, guessed from the spacing between its
 * first two points (hourly when unknown, or coarser than a quarter or half
 * hour). Shared by ingest's recompute and the read paths' hourly folding so
 * the two never drift into different guesses for the same points.
 */
export function inferResolution(points: Point[]): Resolution {
  if (points.length < 2) return "PT60M";
  const gap = (points[1] as Point).ts - (points[0] as Point).ts;
  return gap <= MS.PT15M ? "PT15M" : gap <= MS.PT30M ? "PT30M" : "PT60M";
}

export type FuelGroup = "nuclear" | "gas" | "coal" | "oil" | "hydro" | "wind" | "solar" | "other";
export const FUEL_GROUPS: readonly FuelGroup[] = ["nuclear", "gas", "coal", "oil", "hydro", "wind", "solar", "other"];

/** ENTSO-E production types (psrType) folded into the eight groups the stack draws. */
const GROUP_OF: Record<string, FuelGroup> = {
  B14: "nuclear",
  B03: "gas",
  B04: "gas",
  B02: "coal",
  B05: "coal",
  B07: "coal",
  B08: "coal",
  B06: "oil",
  B10: "hydro",
  B11: "hydro",
  B12: "hydro",
  B13: "hydro",
  B18: "wind",
  B19: "wind",
  B16: "solar",
};

export function fuelGroupOf(psrType: string): FuelGroup {
  return Object.hasOwn(GROUP_OF, psrType) ? GROUP_OF[psrType]! : "other";
}

/** The names ENTSO-E gives its production types, for tables and the twenty-type toggle. */
export const PSR_NAMES: Record<string, string> = {
  B01: "Biomass",
  B02: "Lignite",
  B03: "Coal-derived gas",
  B04: "Natural gas",
  B05: "Hard coal",
  B06: "Oil",
  B07: "Oil shale",
  B08: "Peat",
  B09: "Geothermal",
  B10: "Pumped storage",
  B11: "Run-of-river hydro",
  B12: "Reservoir hydro",
  B13: "Marine",
  B14: "Nuclear",
  B15: "Other renewable",
  B16: "Solar",
  B17: "Waste",
  B18: "Wind offshore",
  B19: "Wind onshore",
  B20: "Other",
};
