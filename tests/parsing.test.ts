import { describe, expect, test } from "bun:test";
import { storage, lng, regions, entsoe } from "../src/index.ts";

describe("authored storage and LNG inputs", () => {
  test("a reported zero remains distinct from a missing number", () => {
    const row = storage.parseRow({ name: "Synthetic storage", code: "ZZ", gasDayStart: "2026-01-01", gasInStorage: "0", withdrawal: "6", injection: "2", status: "C" });
    expect(row.gasInStorage).toBe(0);
    expect(row.workingGasVolume).toBeNull();
    expect(row.netWithdrawal).toBe(4);
    expect(storage.toNumber(Number.POSITIVE_INFINITY)).toBeNull();
  });
  test("LNG fill uses volume rather than the energy equivalent", () => {
    const row = lng.parseLngRow({ name: "Synthetic terminal", inventory: { lng: "20", gwh: "100" }, dtmi: { lng: "80", gwh: "900" }, sendOut: "0", status: "E" });
    expect(row.lngInventory).toBe(20);
    expect(row.full).toBe(25);
    expect(row.sendOut).toBe(0);
    expect(row.status).toBe("E");
    expect(lng.parseLngRow({}).full).toBeNull();
  });
  test("null totals and positive-weight means", () => {
    expect(regions.sumOrNull([null, null], value => value)).toBeNull();
    expect(regions.sumOrNull([0, null], value => value)).toBe(0);
    expect(regions.weightedAverage([{ price: -20, load: 2 }, { price: 10, load: 1 }], r => r.price, r => r.load)).toBe(-10);
  });
  test("calendar slots keep March aligned across leap years", () => {
    expect(storage.calendarIndex("2024-03-01")).toBe(storage.calendarIndex("2025-03-01"));
    expect(storage.addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});

// Authored miniature document. Identifiers describe the schema, quantities are invented.
const loadDocument = `<GL_MarketDocument><mRID>synthetic-load</mRID><createdDateTime>2026-01-01T02:00Z</createdDateTime><TimeSeries><outBiddingZone_Domain.mRID>synthetic-zone-A</outBiddingZone_Domain.mRID><Period><timeInterval><start>2026-01-01T00:00Z</start><end>2026-01-01T02:00Z</end></timeInterval><resolution>PT60M</resolution><Point><position>1</position><quantity>0</quantity></Point></Period></TimeSeries></GL_MarketDocument>`;

describe("authored ENTSO-E documents", () => {
  test("retains publication identity, zero and an absent interval", () => {
    const doc = entsoe.parseEntsoeResponse(loadDocument, "load");
    expect(doc.mRID).toBe("synthetic-load");
    expect(doc.createdAt).toBe("2026-01-01T02:00Z");
    expect(doc.series[0]?.zone).toBe("synthetic-zone-A");
    expect(doc.series[0]?.eic).toBe("synthetic-zone-A");
    expect(doc.series[0]?.points.map(p => p.value)).toEqual([0, null]);
  });
  test("caller-owned mappings preserve the source identifier and reject unmapped zones", () => {
    const registry = entsoe.createZoneRegistry([{ code: "A", eic: "synthetic-zone-A", countries: ["ZZ"] }]);
    const doc = entsoe.parseEntsoeResponse(loadDocument, "load", { zoneCodeForEic: eic => registry.byEic(eic)?.code });
    expect(doc.series[0]).toMatchObject({ zone: "A", eic: "synthetic-zone-A" });
    expect(() => entsoe.parseEntsoeResponse(loadDocument, "load", { zoneCodeForEic: () => undefined })).toThrow("Unknown zone");
    expect(() => entsoe.parseEntsoeResponse(loadDocument, "load", { zoneCodeForEic: () => " " })).toThrow("Unknown zone");
  });
  test("a refused query is not treated as an empty successful period", () => {
    const noData = new entsoe.AcknowledgementError("999", "No matching data found");
    const refused = new entsoe.AcknowledgementError("999", "Requested interval too long");
    expect(noData.noData).toBe(true);
    expect(refused.noData).toBe(false);
    expect(() => entsoe.parseEntsoeResponse('<Acknowledgement_MarketDocument><Reason><code>999</code><text>No matching data found</text></Reason></Acknowledgement_MarketDocument>', "load")).toThrow(entsoe.AcknowledgementError);
  });
  test("net physical flow is missing when a direction is missing", () => {
    expect(entsoe.netFlows([{ ts: 0, value: 10 }, { ts: 3600000, value: null }], [{ ts: 0, value: 3 }, { ts: 3600000, value: 2 }])).toEqual([{ ts: 0, value: 7 }, { ts: 3600000, value: null }]);
  });
  test("physical flows require the requested direction, MW units and complete hourly coverage", () => {
    const flow = `<Publication_MarketDocument><type>A11</type><TimeSeries><out_Domain.mRID>synthetic-A</out_Domain.mRID><in_Domain.mRID>synthetic-B</in_Domain.mRID><quantity_Measure_Unit.name>MAW</quantity_Measure_Unit.name><businessType>A66</businessType><Period><timeInterval><start>2026-01-01T00:00Z</start><end>2026-01-01T01:00Z</end></timeInterval><resolution>PT15M</resolution><Point><position>1</position><quantity>0</quantity></Point><Point><position>2</position><quantity>20</quantity></Point><Point><position>3</position><quantity>40</quantity></Point><Point><position>4</position><quantity>60</quantity></Point></Period></TimeSeries></Publication_MarketDocument>`;
    const parse = (xml: string) => entsoe.parseFlowDocument(xml, "synthetic-A", "synthetic-B", "2026-01-01");
    expect(parse(flow)[0]?.value).toBe(30);
    expect(parse(flow)[1]?.value).toBeNull();
    expect(parse(flow.replace('<Point><position>4</position><quantity>60</quantity></Point>', ''))[0]?.value).toBeNull();
    expect(() => parse(flow.replace('>MAW<', '>MWH<'))).toThrow("Flow unit must be MW");
    expect(() => parse(flow.replace('>synthetic-B<', '>synthetic-C<'))).toThrow("another border");
  });
});
