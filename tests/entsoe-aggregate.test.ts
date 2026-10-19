// tests/entsoe-aggregate.test.ts
import { describe, expect, test } from "bun:test";
import { PARTIAL_SHARE, partialAbove, sumPoints, weightedMean } from "../src/entsoe/aggregate.ts";

const P = (ts: number, value: number | null) => ({ ts, value });

describe("sumPoints", () => {
  test("identical duplicates count once per member and conflicting revisions throw", () => {
    const result = sumPoints([[P(0, 10), P(0, 10)], [P(0, 5)]]);
    expect(result.points).toEqual([P(0, 15)]);
    expect(result.coverage).toEqual([{ present: 2, of: 2 }]);
    expect(sumPoints([[P(0, null), P(0, null)]])).toEqual({ points: [P(0, null)], coverage: [{ present: 0, of: 1 }] });
    expect(() => sumPoints([[P(0, 10), P(0, 20)]])).toThrow("Conflicting");
    expect(() => sumPoints([[P(0, null), P(0, 0)]])).toThrow("Conflicting");
  });
  test("rejects impossible member totals", () => {
    for (const of of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => sumPoints([[P(0, 5)]], of)).toThrow(RangeError);
    expect(sumPoints([])).toEqual({ points: [], coverage: [] });
  });
  test("aligns members by timestamp, sums what is present, counts coverage", () => {
    const a = [P(0, 10), P(1, 20), P(2, null)];
    const b = [P(0, 1), P(2, 3)];
    const { points, coverage } = sumPoints([a, b]);
    expect(points).toEqual([P(0, 11), P(1, 20), P(2, 3)]);
    expect(coverage).toEqual([
      { present: 2, of: 2 },
      { present: 1, of: 2 },
      { present: 1, of: 2 },
    ]);
  });
  test("a timestamp where no member has a value is null, not zero", () => {
    const { points, coverage } = sumPoints([[P(0, null)], [P(0, null)]]);
    expect(points).toEqual([P(0, null)]);
    expect(coverage).toEqual([{ present: 0, of: 2 }]);
  });
  test("the expected member count can be stated when some members have no series at all", () => {
    const { coverage } = sumPoints([[P(0, 5)]], 3);
    expect(coverage).toEqual([{ present: 1, of: 3 }]);
  });
});

describe("weightedMean", () => {
  test("duplicate member prices and weights follow the same revision rule", () => {
    expect(weightedMean([[P(0, 10), P(0, 10)], [P(0, 20)]], [[P(0, 1), P(0, 1)], [P(0, 1)]])).toEqual([P(0, 15)]);
    expect(() => weightedMean([[P(0, 10), P(0, 20)]], [[P(0, 1)]])).toThrow("Conflicting");
    expect(() => weightedMean([[P(0, 10)]], [[P(0, 1), P(0, 2)]])).toThrow("Conflicting");
  });
  test("load-weighted price across zones; null when no weight is present", () => {
    const prices = [
      [P(0, 100), P(1, 50)],
      [P(0, 200), P(1, null)],
    ];
    const loads = [
      [P(0, 1), P(1, 3)],
      [P(0, 3), P(1, 1)],
    ];
    expect(weightedMean(prices, loads)).toEqual([P(0, 175), P(1, 50)]);
    expect(weightedMean([[P(0, 100)]], [[P(0, null)]])).toEqual([P(0, null)]);
  });
});

describe("partialAbove", () => {
  test("flags the hours where coverage is below the stated share", () => {
    expect(PARTIAL_SHARE).toBe(0.8);
    expect(
      partialAbove(
        [
          { present: 5, of: 5 },
          { present: 3, of: 5 },
          { present: 4, of: 5 },
        ],
        0.8,
      ),
    ).toEqual([false, true, false]);
  });
});
