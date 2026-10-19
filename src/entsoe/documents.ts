/**
 * ENTSO-E market documents to series. Only the GL_MarketDocument family is
 * needed in this slice (load, generation per type, reservoirs); acknowledgement
 * documents are turned into a typed error so callers can tell "no data for
 * this period" (code 999) from a real rejection.
 */
import type { ItemId } from "./items.ts";
import { expandPeriod, isResolution, resolutionMs, type Series } from "./series.ts";
import { child, children, readXml, textOf, type XmlNode } from "./xml.ts";

export interface ParseDocumentOptions {
  /** Optional mapping to application-owned zone codes. Unmapped EICs throw when a resolver is supplied. */
  zoneCodeForEic?: (eic: string) => string | undefined;
}

export interface ParsedDocument {
  mRID: string;
  /** The document's createdDateTime: when ENTSO-E produced it, printed as "published". */
  createdAt: string;
  series: Series[];
}

export class AcknowledgementError extends Error {
  readonly code: string;
  readonly reason: string;
  constructor(code: string, reason: string) {
    super(`ENTSO-E acknowledgement ${code}: ${reason}`);
    this.name = "AcknowledgementError";
    this.code = code;
    this.reason = reason;
  }
  /**
   * Code 999 with "No matching data" is an empty period, not a failure. The platform uses the
   * same code for requests it refuses (a period longer than it allows, for one), and those are
   * failures: an empty answer to a refused request would be written as a settled empty window.
   */
  get noData(): boolean {
    return this.code === "999" && /no matching data/i.test(this.reason);
  }
}

export function parseEntsoeResponse(text: string, item: ItemId, options: ParseDocumentOptions = {}): ParsedDocument {
  const root = readXml(text);
  if (root.name === "Acknowledgement_MarketDocument") {
    const reason = child(root, "Reason");
    throw new AcknowledgementError(reason ? (textOf(reason, "code") ?? "") : "", reason ? (textOf(reason, "text") ?? "") : "");
  }
  if (root.name !== "GL_MarketDocument") throw new Error(`Unexpected ENTSO-E document ${root.name}`);
  return parseGlMarketDocument(root, item, options);
}

function parseGlMarketDocument(root: XmlNode, item: ItemId, options: ParseDocumentOptions): ParsedDocument {
  const series: Series[] = [];
  for (const ts of children(root, "TimeSeries")) {
    const inEic = textOf(ts, "inBiddingZone_Domain.mRID");
    const outEic = textOf(ts, "outBiddingZone_Domain.mRID");
    const eic = inEic ?? outEic;
    if (!eic) continue;
    const zoneCode = options.zoneCodeForEic ? options.zoneCodeForEic(eic) : eic;
    if (typeof zoneCode !== "string" || !zoneCode.trim()) throw new Error(`Unknown zone ${eic} in ${item} document`);
    const psr = child(ts, "MktPSRType") ? textOf(child(ts, "MktPSRType") as XmlNode, "psrType") : undefined;
    // In a generation document a series addressed by the out domain is consumption (pumping), kept apart.
    const psrType = item === "generation" ? (inEic ? psr : psr ? `${psr}-consumption` : undefined) : undefined;
    const curveType = textOf(ts, "curveType");
    const points: Series["points"] = [];
    let resolution: Series["resolution"] | undefined;
    for (const period of children(ts, "Period")) {
      const interval = child(period, "timeInterval");
      const res = textOf(period, "resolution") ?? "";
      if (!isResolution(res)) throw new Error(`Unsupported resolution ${res} in ${item} document`);
      // A zone that moved from hourly to quarter-hourly publication answers a window that
      // straddles the switch with one period per resolution. Every point carries its own
      // timestamp, so the periods are simply concatenated; the series records the finest
      // resolution seen, and the daily fold infers each day's own from its points.
      resolution = resolution === undefined || resolutionMs(res) < resolutionMs(resolution) ? res : resolution;
      const positions = children(period, "Point").map((p) => ({
        position: Number(textOf(p, "position")),
        value: numberOrNull(textOf(p, "quantity")),
      }));
      points.push(
        ...expandPeriod({
          start: interval ? (textOf(interval, "start") ?? "") : "",
          end: interval ? (textOf(interval, "end") ?? "") : "",
          resolution: res,
          positions,
          curveType,
        }),
      );
    }
    if (!resolution) continue;
    series.push({ item, zone: zoneCode, eic, ...(psrType ? { psrType } : {}), resolution, points });
  }
  return { mRID: textOf(root, "mRID") ?? "", createdAt: textOf(root, "createdDateTime") ?? "", series };
}

function numberOrNull(s: string | undefined): number | null {
  if (s === undefined || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
