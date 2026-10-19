/**
 * Country names for every code the three sources use, so a place has one
 * name whichever dataset mentions it first. The library's GIE code helper
 * normalises the provider-specific "GB*" alias to GB before name lookup.
 */
const NAMES: Record<string, string> = {
  AT: "Austria",
  BE: "Belgium",
  BG: "Bulgaria",
  CH: "Switzerland",
  CZ: "Czech Republic",
  DE: "Germany",
  DK: "Denmark",
  EE: "Estonia",
  ES: "Spain",
  FI: "Finland",
  FR: "France",
  GB: "United Kingdom",
  GR: "Greece",
  HR: "Croatia",
  HU: "Hungary",
  IE: "Ireland",
  IT: "Italy",
  LT: "Lithuania",
  LU: "Luxembourg",
  LV: "Latvia",
  MT: "Malta",
  NL: "Netherlands",
  NO: "Norway",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  RS: "Serbia",
  SE: "Sweden",
  SI: "Slovenia",
  SK: "Slovakia",
  TR: "Türkiye",
  UA: "Ukraine",
};

export function countryNameOf(code: string, fallback?: string): string {
  return NAMES[code.toUpperCase()] ?? fallback ?? code.toUpperCase();
}

/** Every code with a known name, for directories. */
export function knownCountryCodes(): string[] {
  return Object.keys(NAMES);
}

/** EU member states among the codes above (for the "European Union" / "Outside the EU" grouping). */
const EU = new Set([
  "AT",
  "BE",
  "BG",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
]);

export function isEuMember(code: string): boolean {
  return EU.has(code.toUpperCase());
}
