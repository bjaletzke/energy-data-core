// tests/entsoe-series.test.ts
import { describe, expect, test } from "bun:test";
import {
  expandPeriod,
  fuelGroupOf,
  inferResolution,
  isCompleteDay,
  isResolution,
  modalResolution,
  resolutionMs,
  toDaily,
  toDailyMixed,
  toHourly,
} from "../src/entsoe/series.ts";

const T = (iso: string) => Date.parse(iso);

describe("expandPeriod", () => {
  test("resolution validation accepts only declared own keys", () => {
    expect(isResolution("PT15M")).toBe(true);
    expect(isResolution("P7D")).toBe(true);
    for (const invalid of ["P1M", "toString", "constructor", "__proto__"]) expect(isResolution(invalid)).toBe(false);
  });
  test("a full hourly day gives 24 points at the interval starts", () => {
    const positions = Array.from({ length: 24 }, (_, i) => ({ position: i + 1, value: 100 + i }));
    const points = expandPeriod({ start: "2026-09-06T22:00Z", end: "2026-09-07T22:00Z", resolution: "PT60M", positions });
    expect(points.length).toBe(24);
    expect(points[0]).toEqual({ ts: T("2026-09-06T22:00Z"), value: 100 });
    expect(points[23]).toEqual({ ts: T("2026-09-07T21:00Z"), value: 123 });
  });
  test("omitted positions: carried forward for A03 curves, null otherwise", () => {
    const positions = [
      { position: 1, value: 10 },
      { position: 3, value: 30 },
    ];
    const a03 = expandPeriod({ start: "2026-09-07T00:00Z", end: "2026-09-07T04:00Z", resolution: "PT60M", positions, curveType: "A03" });
    expect(a03.map((p) => p.value)).toEqual([10, 10, 30, 30]);
    const a01 = expandPeriod({ start: "2026-09-07T00:00Z", end: "2026-09-07T04:00Z", resolution: "PT60M", positions });
    expect(a01.map((p) => p.value)).toEqual([10, null, 30, null]);
  });
  test("quarter hours and weeks", () => {
    expect(resolutionMs("PT15M")).toBe(900_000);
    expect(resolutionMs("P7D")).toBe(7 * 86_400_000);
    const q = expandPeriod({
      start: "2026-09-07T00:00Z",
      end: "2026-09-07T01:00Z",
      resolution: "PT15M",
      positions: [{ position: 4, value: 1 }],
    });
    expect(q.map((p) => p.ts)).toEqual([T("2026-09-07T00:00Z"), T("2026-09-07T00:15Z"), T("2026-09-07T00:30Z"), T("2026-09-07T00:45Z")]);
    expect(q.map((p) => p.value)).toEqual([null, null, null, 1]);
  });
});

describe("toHourly and toDaily", () => {
  test("hourly means of quarter hours, null when the hour has no points", () => {
    const points = [
      { ts: T("2026-09-07T00:00Z"), value: 100 },
      { ts: T("2026-09-07T00:15Z"), value: 200 },
      { ts: T("2026-09-07T00:30Z"), value: null },
      { ts: T("2026-09-07T00:45Z"), value: 300 },
      { ts: T("2026-09-07T01:00Z"), value: null },
    ];
    expect(toHourly(points, "PT15M")).toEqual([
      { ts: T("2026-09-07T00:00Z"), value: 200 },
      { ts: T("2026-09-07T01:00Z"), value: null },
    ]);
    expect(toHourly([{ ts: T("2026-09-07T00:00Z"), value: 5 }], "PT60M")).toEqual([{ ts: T("2026-09-07T00:00Z"), value: 5 }]);
  });
  test("daily rows in UTC with mean, sum, min, max and the count present", () => {
    const points = [
      { ts: T("2026-09-06T23:00Z"), value: 10 },
      { ts: T("2026-09-07T00:00Z"), value: 20 },
      { ts: T("2026-09-07T01:00Z"), value: 40 },
      { ts: T("2026-09-07T02:00Z"), value: null },
    ];
    expect(toDaily(points)).toEqual([
      { day: "2026-09-06", mean: 10, sum: 10, min: 10, max: 10, n: 1, expected: 24 },
      { day: "2026-09-07", mean: 30, sum: 60, min: 20, max: 40, n: 2, expected: 24 },
    ]);
    expect(toDaily([{ ts: T("2026-09-07T00:00Z"), value: null }])).toEqual([
      { day: "2026-09-07", mean: null, sum: null, min: null, max: null, n: 0, expected: 24 },
    ]);
    // Quarter hours: the sum is energy, a quarter of the MW values; a full quarter-hourly day expects 96.
    expect(
      toDaily(
        [
          { ts: T("2026-09-07T00:00Z"), value: 100 },
          { ts: T("2026-09-07T00:15Z"), value: 300 },
        ],
        0.25,
      )[0],
    ).toMatchObject({ mean: 200, sum: 100, n: 2, expected: 96 });
  });
  test("isCompleteDay: n against expected, an unknown expected treated as complete", () => {
    expect(isCompleteDay({ n: 24, expected: 24 })).toBe(true);
    expect(isCompleteDay({ n: 2, expected: 24 })).toBe(false);
    expect(isCompleteDay({ n: 2, expected: null })).toBe(true);
  });
  test("inferResolution guesses from the gap between the first two points, hourly when unknown", () => {
    expect(inferResolution([])).toBe("PT60M");
    expect(inferResolution([{ ts: 0, value: 1 }])).toBe("PT60M");
    expect(
      inferResolution([
        { ts: 0, value: 1 },
        { ts: 900_000, value: 1 },
      ]),
    ).toBe("PT15M");
    expect(
      inferResolution([
        { ts: 0, value: 1 },
        { ts: 1_800_000, value: 1 },
      ]),
    ).toBe("PT30M");
    expect(
      inferResolution([
        { ts: 0, value: 1 },
        { ts: 3_600_000, value: 1 },
      ]),
    ).toBe("PT60M");
  });
});

describe("fuel groups", () => {
  test("the twenty psrTypes fold into eight groups", () => {
    expect(fuelGroupOf("B14")).toBe("nuclear");
    expect(fuelGroupOf("B04")).toBe("gas");
    expect(fuelGroupOf("B03")).toBe("gas");
    expect(["B02", "B05", "B07", "B08"].map(fuelGroupOf)).toEqual(["coal", "coal", "coal", "coal"]);
    expect(fuelGroupOf("B06")).toBe("oil");
    expect(["B10", "B11", "B12", "B13"].map(fuelGroupOf)).toEqual(["hydro", "hydro", "hydro", "hydro"]);
    expect(["B18", "B19"].map(fuelGroupOf)).toEqual(["wind", "wind"]);
    expect(fuelGroupOf("B16")).toBe("solar");
    expect(fuelGroupOf("constructor")).toBe("other");
    expect(["B01", "B09", "B15", "B17", "B20", "B99"].map(fuelGroupOf)).toEqual(["other", "other", "other", "other", "other", "other"]);
  });
});

describe("toDailyMixed: a zone that switched resolution mid-window", () => {
  const T = (iso: string) => Date.parse(iso);
  test("a plain quarter-hourly day folds exactly as toDaily does", () => {
    const points = Array.from({ length: 96 }, (_, i) => ({ ts: T("2026-09-07T00:00Z") + i * 900_000, value: 100 + (i % 4) }));
    expect(toDailyMixed(points)).toEqual(toDaily(points, 0.25).map((row) => ({ ...row, coveredHours: 24 })));
    expect(modalResolution(points)).toBe("PT15M");
  });
  test("the switch day is summed with each point's own duration and counted complete", () => {
    // 23 hourly points, then the zone goes quarter-hourly at 23:00 UTC (midnight in Brussels): four quarter hours.
    const hourly = Array.from({ length: 23 }, (_, i) => ({ ts: T("2024-12-31T00:00Z") + i * 3_600_000, value: 1000 }));
    const quarters = Array.from({ length: 4 }, (_, i) => ({ ts: T("2024-12-31T23:00Z") + i * 900_000, value: 2000 }));
    const next = Array.from({ length: 8 }, (_, i) => ({ ts: T("2025-01-01T00:00Z") + i * 900_000, value: 3000 }));
    const rows = toDailyMixed([...hourly, ...quarters, ...next]);
    expect(rows.map((r) => r.day)).toEqual(["2024-12-31", "2025-01-01"]);
    const sw = rows[0]!;
    expect(sw.n).toBe(27);
    expect(sw.expected).toBe(24); // the day's modal spacing is hourly
    expect(isCompleteDay(sw)).toBe(true);
    // 23 hours at 1,000 MW plus four quarter hours at 2,000 MW: 23,000 + 2,000 MWh, not 27 hours' worth.
    expect(sw.sum).toBeCloseTo(25_000, 6);
    expect(sw.coveredHours).toBe(24);
    expect(sw.mean).toBeCloseTo(25_000 / 24, 6);
    expect(sw.max).toBe(2000);
    const after = rows[1]!;
    expect(after.expected).toBe(96);
    expect(after.n).toBe(8);
    expect(isCompleteDay(after)).toBe(false);
    expect(after.sum).toBeCloseTo(8 * 3000 * 0.25, 6);
  });
  test("a lone point in a day is hourly by default", () => {
    expect(toDailyMixed([{ ts: T("2026-09-07T05:00Z"), value: 10 }])).toEqual([
      { day: "2026-09-07", mean: 10, sum: 10, min: 10, max: 10, n: 1, expected: 24, coveredHours: 1 },
    ]);
  });
  test("a missing hour in a mixed day is partial even when the point count exceeds the modal count", () => {
    const start = T("2026-09-07T00:00Z");
    const hourly = Array.from({ length: 23 }, (_, i) => ({ ts: start + i * 3_600_000, value: 1000 })).filter((_, i) => i !== 2);
    const quarters = Array.from({ length: 4 }, (_, i) => ({ ts: start + 23 * 3_600_000 + i * 900_000, value: 2000 }));
    const row = toDailyMixed([...hourly, ...quarters])[0]!;
    expect(row.n).toBe(26);
    expect(row.coveredHours).toBe(23);
    expect(row.sum).toBe(24_000);
    expect(row.mean).toBeCloseTo(24_000 / 23, 6);
    expect(isCompleteDay(row)).toBe(false);
  });
  test("weights an hourly interval correctly when most of the day is quarter-hourly", () => {
    const start = T("2026-09-07T00:00Z");
    const quarters = Array.from({ length: 92 }, (_, i) => ({ ts: start + 3_600_000 + i * 900_000, value: 2000 }));
    const row = toDailyMixed([{ ts: start, value: 1000 }, ...quarters])[0]!;
    expect(row.coveredHours).toBe(24);
    expect(row.sum).toBe(47_000);
    expect(row.mean).toBeCloseTo(47_000 / 24, 6);
    expect(isCompleteDay(row)).toBe(true);
  });
  test("explicit null intervals remove coverage and duplicates cannot inflate it", () => {
    const points = Array.from({ length: 96 }, (_, i) => ({ ts: T("2026-09-07T00:00Z") + i * 900_000, value: i === 4 ? null : 100 }));
    const row = toDailyMixed([...points, points[0]!])[0]!;
    expect(row.n).toBe(95);
    expect(row.coveredHours).toBe(23.75);
    expect(isCompleteDay(row)).toBe(false);
    expect(() => toDailyMixed([...points, { ...points[0]!, value: 200 }])).toThrow("Conflicting");
    expect(toDailyMixed(points.map((point) => ({ ...point, value: null })))[0]).toMatchObject({ mean: null, sum: null, n: 0, coveredHours: 0 });
  });
  test("the final inferred interval stops at midnight", () => {
    const row = toDailyMixed([{ ts: T("2026-09-07T23:45Z"), value: 100 }])[0]!;
    expect(row.sum).toBe(25);
    expect(row.coveredHours).toBe(0.25);
    expect(isCompleteDay(row)).toBe(false);
  });
});
