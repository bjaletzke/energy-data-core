/**
 * Project-defined geographic groups, not official bidding zones. A region is
 * a plain list of country codes. Consumers can supply their own Region lists.
 */
export interface Region {
  code: string;
  name: string;
  countries: readonly string[];
}

export const REGIONS: readonly Region[] = [
  { code: "nordics", name: "Nordics", countries: ["NO", "SE", "DK", "FI"] },
  { code: "baltics", name: "Baltics", countries: ["EE", "LV", "LT"] },
  { code: "central-west", name: "Central-West", countries: ["DE", "FR", "NL", "BE", "LU", "AT", "CH"] },
  { code: "iberia", name: "Iberia", countries: ["ES", "PT"] },
  { code: "italy", name: "Italy", countries: ["IT"] },
  { code: "central-east", name: "Central-East", countries: ["PL", "CZ", "SK", "HU"] },
  { code: "south-east", name: "South-East", countries: ["RO", "BG", "GR", "HR", "SI", "RS"] },
  { code: "uk-ie", name: "UK & Ireland", countries: ["GB", "UK", "IE"] },
  { code: "ukraine", name: "Ukraine", countries: ["UA"] },
];

const BY_COUNTRY = new Map<string, Region>();
for (const region of REGIONS) for (const c of region.countries) BY_COUNTRY.set(c, region);

/** The region a country belongs to, or undefined for codes outside the groups. */
export function regionOf(countryCode: string): Region | undefined {
  return BY_COUNTRY.get(countryCode.toUpperCase());
}

/** Sum a numeric field over rows, treating "no data" as absent rather than zero; null when nothing contributed. */
export function sumOrNull<T>(rows: readonly T[], pick: (row: T) => number | null): number | null {
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const v = pick(r);
    if (v !== null && Number.isFinite(v)) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? null : sum;
}

/** Weighted average with the same "absent, not zero" rule; null when no weight contributed. */
export function weightedAverage<T>(rows: readonly T[], value: (row: T) => number | null, weight: (row: T) => number | null): number | null {
  let acc = 0;
  let w = 0;
  for (const r of rows) {
    const v = value(r);
    const wt = weight(r);
    if (v === null || wt === null || !Number.isFinite(v) || !Number.isFinite(wt) || wt <= 0) continue;
    acc += v * wt;
    w += wt;
  }
  return w === 0 ? null : acc / w;
}
