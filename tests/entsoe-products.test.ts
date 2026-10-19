import { describe, expect, test } from "bun:test";
import { movingAverage, records, rollingCorrelation, seasonalAnomaly, seasonBand } from "../src/entsoe/products.ts";

const D = (day: string, value: number | null) => ({ day, value });
const days = (from: string, values: (number | null)[]) => {
  const start = Date.parse(from);
  return values.map((value, i) => D(new Date(start + i * 86_400_000).toISOString().slice(0, 10), value));
};

describe("analytical window validation", () => {
  test("rejects nonpositive, fractional and nonfinite windows even for empty input", () => {
    for (const size of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => movingAverage([], size)).toThrow(RangeError);
      expect(() => rollingCorrelation([], [], size)).toThrow(RangeError);
      expect(() => seasonalAnomaly([], size)).toThrow(RangeError);
      expect(() => seasonBand([], 2026, size)).toThrow(RangeError);
    }
  });
  test("a one-observation mean preserves values including reported zero", () => {
    const values = days("2026-01-01", [0, null, 2]);
    expect(movingAverage(values, 1)).toEqual(values);
  });
});

describe("movingAverage", () => {
  test("trailing window, null until full, nulls in the data break the window", () => {
    const s = days("2026-01-01", [1, 2, 3, 4, null, 6, 7, 8]);
    expect(movingAverage(s, 3).map((d) => d.value)).toEqual([null, null, 2, 3, null, null, null, 7]);
  });
});

describe("seasonalAnomaly", () => {
  test("a day minus the mean of the same slot in the previous years", () => {
    const s = [D("2024-03-01", 10), D("2025-03-01", 20), D("2026-03-01", 30), D("2026-03-02", 5)];
    const out = seasonalAnomaly(s, 5);
    expect(out.find((d) => d.day === "2026-03-01")?.value).toBe(15); // 30 - mean(10, 20)
    expect(out.find((d) => d.day === "2026-03-02")?.value).toBeNull(); // fewer than 2 reference years
    expect(out.find((d) => d.day === "2024-03-01")?.value).toBeNull();
  });
});

describe("records", () => {
  test("all-time high and low with their days", () => {
    expect(records(days("2026-01-01", [3, 9, null, 1, 9]))).toEqual([
      { day: "2026-01-02", value: 9, kind: "high" },
      { day: "2026-01-04", value: 1, kind: "low" },
    ]);
  });
});

describe("seasonBand", () => {
  test("366 slots with this year, last year and the band of the previous years", () => {
    const s = [D("2023-06-01", 10), D("2024-06-01", 30), D("2025-06-01", 20), D("2026-06-01", 25)];
    const band = seasonBand(s, 2026, 5);
    expect(band.length).toBe(366);
    const june1 = band.find((b) => b.value === 25)!;
    expect(june1).toMatchObject({ value: 25, min: 10, max: 30, last: 20 });
    expect(band[0]).toEqual({ slot: 0, value: null, min: null, max: null, last: null });
  });
});

describe("rollingCorrelation", () => {
  test("Pearson over the trailing window where both series are present", () => {
    const a = days(
      "2026-01-01",
      Array.from({ length: 12 }, (_, i) => i),
    );
    const b = days(
      "2026-01-01",
      Array.from({ length: 12 }, (_, i) => 2 * i + 1),
    );
    const out = rollingCorrelation(a, b, 10);
    expect(out[8]).toEqual({ day: "2026-01-09", r: null, n: 9 });
    expect(out[9]?.n).toBe(10);
    expect(out[9]?.r).toBeCloseTo(1, 10);
    const c = days(
      "2026-01-01",
      Array.from({ length: 12 }, (_, i) => -i),
    );
    expect(rollingCorrelation(a, c, 10)[11]?.r).toBeCloseTo(-1, 10);
  });
});
