import { describe, expect, test } from "bun:test";
import * as entsoe from "../src/entsoe/index.ts";

describe("caller-supplied registry", () => {
  test("supports cross-country zones without assigning observations to one country", () => {
    const registry = entsoe.createZoneRegistry([{ code: "AB", eic: "synthetic-AB", countries: ["aa", "BB", "aa"], label: "Synthetic shared zone" }]);
    expect(registry.byEic("synthetic-AB")?.code).toBe("AB");
    expect(registry.byCode("AB")?.countries).toEqual(["AA", "BB"]);
    expect(registry.zonesOf("aa")).toEqual(registry.zonesOf("BB"));
    expect(registry.zonesOf("CC")).toEqual([]);
    expect(registry.byEic("unknown")).toBeUndefined();
  });
  test("has no bundled or global mutable registry", () => {
    expect("ZONES" in entsoe).toBe(false);
    const input = { code: "A", eic: "synthetic-A", countries: ["AA"] };
    const registry = entsoe.createZoneRegistry([input]);
    input.code = "changed";
    input.countries.push("BB");
    expect(registry.byEic("synthetic-A")?.code).toBe("A");
    expect(registry.zonesOf("BB")).toEqual([]);
    expect(Object.isFrozen(registry.zones[0])).toBe(true);
    expect(entsoe.createZoneRegistry([]).byEic("synthetic-A")).toBeUndefined();
  });
  test("rejects empty and conflicting identifiers", () => {
    expect(() => entsoe.createZoneRegistry([{ code: "", eic: "A" }])).toThrow();
    expect(() => entsoe.createZoneRegistry([{ code: "A", eic: " " }])).toThrow();
    expect(() => entsoe.createZoneRegistry([{ code: "A", eic: "1" }, { code: "B", eic: "1" }])).toThrow("Duplicate");
    expect(() => entsoe.createZoneRegistry([{ code: "A", eic: "1" }, { code: "A", eic: "2" }])).toThrow("Duplicate");
  });
});
