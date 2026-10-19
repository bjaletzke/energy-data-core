/**
 * Aggregation of member series into timestamp-aligned groups: physical quantities
 * are summed by timestamp with a coverage count; prices are load-weighted;
 * a sum with too few members present is marked partial, never silently short.
 */
import type { Point } from "./series.ts";

export interface Coverage {
  present: number;
  of: number;
}

/** Members representing less than this share of the group are drawn hatched as partial. */
export const PARTIAL_SHARE = 0.8;

/** Identical repeated observations collapse; conflicting observations require the caller to choose a revision. */
function uniquePoints(points: Point[]): Point[] {
  const byTimestamp = new Map<number, Point>();
  for (const point of points) {
    if (byTimestamp.has(point.ts) && byTimestamp.get(point.ts)!.value !== point.value)
      throw new Error(`Conflicting values at timestamp ${point.ts}`);
    byTimestamp.set(point.ts, point);
  }
  return [...byTimestamp.values()];
}

/**
 * Sum member series by timestamp. A timestamp with no value anywhere is null;
 * coverage counts members with a value, once per member. Identical duplicates
 * collapse and conflicting values within a member throw. of must cover every supplied member.
 */
export function sumPoints(series: Point[][], of = series.length): { points: Point[]; coverage: Coverage[] } {
  if (!Number.isSafeInteger(of) || of < series.length) throw new RangeError("of must be an integer at least equal to the number of supplied members");
  const acc = new Map<number, { sum: number; present: number }>();
  for (const s of series) {
    for (const p of uniquePoints(s)) {
      const a = acc.get(p.ts) ?? { sum: 0, present: 0 };
      if (p.value !== null) {
        a.sum += p.value;
        a.present += 1;
      }
      acc.set(p.ts, a);
    }
  }
  const ts = [...acc.keys()].sort((x, y) => x - y);
  return {
    points: ts.map((t) => {
      const a = acc.get(t) as { sum: number; present: number };
      return { ts: t, value: a.present ? a.sum : null };
    }),
    coverage: ts.map((t) => ({ present: (acc.get(t) as { present: number }).present, of })),
  };
}

/** Weighted mean by timestamp (prices weighted by load). Null where no weight is present. Duplicates follow sumPoints' rule. */
export function weightedMean(values: Point[][], weights: Point[][]): Point[] {
  const acc = new Map<number, { num: number; den: number }>();
  values.forEach((s, i) => {
    const w = new Map(uniquePoints(weights[i] ?? []).map((p) => [p.ts, p.value]));
    for (const p of uniquePoints(s)) {
      const weight = w.get(p.ts) ?? null;
      const a = acc.get(p.ts) ?? { num: 0, den: 0 };
      if (p.value !== null && weight !== null) {
        a.num += p.value * weight;
        a.den += weight;
      }
      acc.set(p.ts, a);
    }
  });
  return [...acc.keys()]
    .sort((x, y) => x - y)
    .map((t) => {
      const a = acc.get(t) as { num: number; den: number };
      return { ts: t, value: a.den > 0 ? a.num / a.den : null };
    });
}

export function partialAbove(coverage: Coverage[], share: number): boolean[] {
  return coverage.map((c) => c.of > 0 && c.present / c.of < share);
}
