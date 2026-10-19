// tests/entsoe-xml.test.ts
import { describe, expect, test } from "bun:test";
import { child, children, readXml, textOf } from "../src/entsoe/xml.ts";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<GL_MarketDocument xmlns="urn:iec62325.351:tc57wg16:451-6:generationloaddocument:3:0">
  <mRID>abc</mRID>
  <TimeSeries>
    <mRID>1</mRID>
    <MktPSRType><psrType>B04</psrType></MktPSRType>
    <Period>
      <timeInterval><start>2026-09-06T22:00Z</start><end>2026-09-07T22:00Z</end></timeInterval>
      <resolution>PT60M</resolution>
      <Point><position>1</position><quantity>1234.5</quantity></Point>
      <Point><position>3</position><quantity>1200</quantity></Point>
    </Period>
  </TimeSeries>
  <TimeSeries><mRID>2</mRID></TimeSeries>
  <note>a &amp; b &lt;c&gt;</note>
  <empty/>
</GL_MarketDocument>`;

describe("readXml", () => {
  test("parses elements, text, entities and self-closing tags without namespace prefixes", () => {
    const root = readXml(SAMPLE);
    expect(root.name).toBe("GL_MarketDocument");
    expect(textOf(root, "mRID")).toBe("abc");
    const series = children(root, "TimeSeries");
    expect(series.length).toBe(2);
    const period = child(series[0]!, "Period")!;
    expect(textOf(period, "resolution")).toBe("PT60M");
    const points = children(period, "Point");
    expect(points.map((p) => textOf(p, "position"))).toEqual(["1", "3"]);
    expect(textOf(points[0]!, "quantity")).toBe("1234.5");
    expect(textOf(child(period, "timeInterval")!, "start")).toBe("2026-09-06T22:00Z");
    expect(textOf(root, "note")).toBe("a & b <c>");
    expect(child(root, "empty")?.children).toEqual([]);
  });
  test("prefixed names and attributes", () => {
    const root = readXml(`<ns:Doc xmlns:ns="x"><ns:Item code="B04" ns:kind="y">v</ns:Item></ns:Doc>`);
    expect(root.name).toBe("Doc");
    const item = child(root, "Item")!;
    expect(item.attrs).toEqual({ code: "B04", kind: "y" });
    expect(item.text).toBe("v");
  });
  test("rejects unbalanced documents", () => {
    expect(() => readXml("<a><b></a>")).toThrow();
  });
});
