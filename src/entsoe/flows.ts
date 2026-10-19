import { AcknowledgementError } from "./documents.ts";
import { expandPeriod, resolutionMs } from "./series.ts";
import { child, children, readXml, textOf } from "./xml.ts";

export const FLOW_SOURCE_URL = "https://transparencyplatform.zendesk.com/hc/en-us/articles/16583889683476-Physical-Flows-12-1-G";
export interface FlowPoint {
  ts: number;
  value: number | null;
}
export interface BorderFlow {
  from: string;
  to: string;
  fromEic: string;
  toEic: string;
  date: string;
  fetchedAt: string;
  unit: "MW";
  resolution: "PT60M";
  forward: FlowPoint[];
  reverse: FlowPoint[];
  net: FlowPoint[];
  warnings: string[];
  source: string;
}

/** Strict A11 domain/unit validation. Only complete hourly means are exposed. */
export function parseFlowDocument(xml: string, fromEic: string, toEic: string, date: string): FlowPoint[] {
  const root = readXml(xml);
  if (root.name === "Acknowledgement_MarketDocument") {
    const reason = child(root, "Reason");
    throw new AcknowledgementError(reason ? (textOf(reason, "code") ?? "") : "", reason ? (textOf(reason, "text") ?? "") : "");
  }
  if (root.name !== "Publication_MarketDocument" || textOf(root, "type") !== "A11") throw new Error("Expected A11 physical flow document");
  const start = Date.parse(`${date}T00:00:00Z`);
  const slots = new Map<number, number | null>();
  let matched = false;
  for (const series of children(root, "TimeSeries")) {
    const from = textOf(series, "out_Domain.mRID");
    const to = textOf(series, "in_Domain.mRID");
    // Official examples contain both directions in one response. Never add them together.
    if (from === toEic && to === fromEic) continue;
    if (from !== fromEic || to !== toEic) throw new Error("Flow response belongs to another border");
    if (textOf(series, "quantity_Measure_Unit.name") !== "MAW") throw new Error("Flow unit must be MW");
    const business = textOf(series, "businessType");
    if (business && business !== "A66") throw new Error("Expected physical energy flow");
    const curveType = textOf(series, "curveType");
    if (curveType && curveType !== "A01" && curveType !== "A03") throw new Error("Unsupported flow curve type");
    matched = true;
    for (const period of children(series, "Period")) {
      const resolution = textOf(period, "resolution");
      if (resolution !== "PT15M" && resolution !== "PT30M" && resolution !== "PT60M") throw new Error("Unsupported flow resolution");
      const time = child(period, "timeInterval");
      const a = time ? (textOf(time, "start") ?? "") : "";
      const b = time ? (textOf(time, "end") ?? "") : "";
      const step = resolutionMs(resolution);
      const count = (Date.parse(b) - Date.parse(a)) / step;
      if (!Number.isInteger(count) || count <= 0 || count > 31 * 96 || Date.parse(a) % 900_000 !== 0)
        throw new Error("Invalid flow period");
      const positions = children(period, "Point").map((point) => {
        const position = Number(textOf(point, "position"));
        const raw = textOf(point, "quantity");
        const value = raw === undefined || raw === "" ? null : Number(raw);
        if (!Number.isInteger(position) || position < 1 || position > count || (value !== null && !Number.isFinite(value)))
          throw new Error("Invalid flow point");
        return { position, value };
      });
      if (new Set(positions.map((p) => p.position)).size !== positions.length) throw new Error("Duplicate flow position");
      for (const point of expandPeriod({ start: a, end: b, resolution, positions, curveType })) {
        for (let ts = point.ts; ts < point.ts + step; ts += 900_000) {
          if (ts < start || ts >= start + 86_400_000) continue;
          if (slots.has(ts) && slots.get(ts) !== point.value) throw new Error("Conflicting physical flow series");
          slots.set(ts, point.value);
        }
      }
    }
  }
  if (!matched) return [];
  return Array.from({ length: 24 }, (_, hour) => {
    const ts = start + hour * 3_600_000;
    const values = Array.from({ length: 4 }, (_, quarter) => slots.get(ts + quarter * 900_000));
    return {
      ts,
      value: values.every((value): value is number => value != null) ? values.reduce((sum, value) => sum + value, 0) / 4 : null,
    };
  });
}

/** No unreported reverse reading is treated as zero. */
export function netFlows(forward: FlowPoint[], reverse: FlowPoint[]): FlowPoint[] {
  const a = new Map(forward.map((p) => [p.ts, p.value]));
  const b = new Map(reverse.map((p) => [p.ts, p.value]));
  return [...new Set([...a.keys(), ...b.keys()])]
    .sort((x, y) => x - y)
    .map((ts) => ({ ts, value: a.get(ts) != null && b.get(ts) != null ? a.get(ts)! - b.get(ts)! : null }));
}
