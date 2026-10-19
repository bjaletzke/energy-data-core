/** Build an isolated lookup over caller-owned metadata. No catalogue is bundled. */
export interface Zone {
  code: string;
  eic: string;
  /** A market zone may span multiple countries. */
  countries?: readonly string[];
  label?: string;
}

export interface ZoneRegistry {
  readonly zones: readonly Readonly<Zone>[];
  byEic(eic: string): Readonly<Zone> | undefined;
  byCode(code: string): Readonly<Zone> | undefined;
  zonesOf(country: string): readonly Readonly<Zone>[];
}

/** Exact identifier lookups; duplicate codes/EICs are rejected rather than silently overwritten. */
export function createZoneRegistry(records: readonly Zone[]): ZoneRegistry {
  const byEic = new Map<string, Readonly<Zone>>();
  const byCode = new Map<string, Readonly<Zone>>();
  const zones = records.map(record => {
    if (typeof record.code !== "string" || !record.code.trim() || typeof record.eic !== "string" || !record.eic.trim())
      throw new TypeError("Each zone needs a nonempty code and EIC");
    if (byEic.has(record.eic) || byCode.has(record.code)) throw new Error("Duplicate zone code or EIC");
    const countries = record.countries?.map(country => {
      if (typeof country !== "string" || !country.trim()) throw new TypeError("Country codes must be nonempty strings");
      return country.toUpperCase();
    });
    const zone = Object.freeze({ ...record, ...(countries ? { countries: Object.freeze([...new Set(countries)]) } : {}) });
    byEic.set(zone.eic, zone);
    byCode.set(zone.code, zone);
    return zone;
  });
  return Object.freeze({
    zones: Object.freeze(zones),
    byEic: (eic: string) => byEic.get(eic),
    byCode: (code: string) => byCode.get(code),
    zonesOf: (country: string) => zones.filter(zone => zone.countries?.includes(country.toUpperCase())),
  });
}
