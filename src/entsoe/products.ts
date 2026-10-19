/**
 * Analytical calculations from daily series: trailing
 * moving averages, seasonal anomalies against the previous years' same slot,
 * all-time records, the 366-slot season band the fill curve already draws,
 * and rolling Pearson correlations on two series. Pure functions with the
 * window and the count carried in every result, so a view can print them.
 */
import { calendarIndex } from "../model.ts";

export interface DailyValue {
  day: string;
  value: number | null;
}

function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer`);
}

/** Trailing mean of the last `window` observations; supply daily rows with explicit nulls for missing days. window must be a positive integer. */
export function movingAverage(series: DailyValue[], window: number): DailyValue[] {
  positiveInteger(window, "window");
  return series.map((d, i) => {
    if (i + 1 < window) return { day: d.day, value: null };
    let sum = 0;
    for (let k = i + 1 - window; k <= i; k++) {
      const v = series[k]?.value;
      if (v === null || v === undefined) return { day: d.day, value: null };
      sum += v;
    }
    return { day: d.day, value: sum / window };
  });
}

function yearOf(day: string): number {
  return Number(day.slice(0, 4));
}

/** The same calendar slot (366-slot calendar) in the previous `years` years, averaged; a day minus that mean. years must be a positive integer. */
export function seasonalAnomaly(series: DailyValue[], years = 5): DailyValue[] {
  positiveInteger(years, "years");
  const bySlot = new Map<string, number>();
  for (const d of series) if (d.value !== null) bySlot.set(`${yearOf(d.day)}:${calendarIndex(d.day)}`, d.value);
  return series.map((d) => {
    if (d.value === null) return { day: d.day, value: null };
    const y = yearOf(d.day);
    const slot = calendarIndex(d.day);
    const refs: number[] = [];
    for (let k = 1; k <= years; k++) {
      const v = bySlot.get(`${y - k}:${slot}`);
      if (v !== undefined) refs.push(v);
    }
    if (refs.length < 2) return { day: d.day, value: null };
    return { day: d.day, value: d.value - refs.reduce((a, b) => a + b, 0) / refs.length };
  });
}

export function records(series: DailyValue[]): { day: string; value: number; kind: "high" | "low" }[] {
  let high: DailyValue | undefined;
  let low: DailyValue | undefined;
  for (const d of series) {
    if (d.value === null) continue;
    if (!high || d.value > (high.value as number)) high = d;
    if (!low || d.value < (low.value as number)) low = d;
  }
  const out: { day: string; value: number; kind: "high" | "low" }[] = [];
  if (high) out.push({ day: high.day, value: high.value as number, kind: "high" });
  if (low) out.push({ day: low.day, value: low.value as number, kind: "low" });
  return out;
}

export interface SeasonSlot {
  slot: number;
  value: number | null;
  min: number | null;
  max: number | null;
  last: number | null;
}

/**
 * This year's value per calendar slot, last year's, and the min/max band of the previous `years` years.
 * years must be a positive integer.
 *
 * `calendarIndex` returns 1 to 366 (1 January is slot 1), not 0 to 365, so
 * each lookup here is offset by one to land in the 0-indexed `slots` array;
 * the exported `slot` field itself stays 0-based (1 January is slot 0).
 */
export function seasonBand(series: DailyValue[], year: number, years = 5): SeasonSlot[] {
  positiveInteger(years, "years");
  const slots: SeasonSlot[] = Array.from({ length: 366 }, (_, slot) => ({ slot, value: null, min: null, max: null, last: null }));
  for (const d of series) {
    if (d.value === null) continue;
    const y = yearOf(d.day);
    const s = slots[calendarIndex(d.day) - 1] as SeasonSlot;
    if (y === year) s.value = d.value;
    else if (y === year - 1) s.last = d.value;
    if (y < year && y >= year - years) {
      s.min = s.min === null ? d.value : Math.min(s.min, d.value);
      s.max = s.max === null ? d.value : Math.max(s.max, d.value);
    }
  }
  return slots;
}

/** Pearson correlation over the trailing `window` observations of a where both series have a value; null below ten pairs. window must be a positive integer. */
export function rollingCorrelation(a: DailyValue[], b: DailyValue[], window: number): { day: string; r: number | null; n: number }[] {
  positiveInteger(window, "window");
  const bv = new Map(b.map((d) => [d.day, d.value]));
  return a.map((d, i) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = Math.max(0, i + 1 - window); k <= i; k++) {
      const x = a[k]?.value;
      const y = bv.get(a[k]?.day ?? "");
      if (x !== null && x !== undefined && y !== null && y !== undefined) {
        xs.push(x);
        ys.push(y);
      }
    }
    const n = xs.length;
    if (n < 10) return { day: d.day, r: null, n };
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let k = 0; k < n; k++) {
      const dx = (xs[k] as number) - mx;
      const dy = (ys[k] as number) - my;
      sxy += dx * dy;
      sxx += dx * dx;
      syy += dy * dy;
    }
    const den = Math.sqrt(sxx * syy);
    return { day: d.day, r: den === 0 ? null : sxy / den, n };
  });
}
