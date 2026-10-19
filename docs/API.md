# API and assumptions

The root ESM entry exports namespaces. Subpath imports expose each namespace's
members directly: `energy-data-core/storage`, `/lng`, `/regions`, `/countries`,
and `/entsoe`. The name is provisional until publication. There is no CommonJS build.

| Namespace | Main operations |
| --- | --- |
| `storage` | `parseRow`, `parseRows`, `toNumber`, history sorting, date/season helpers |
| `lng` | `parseLngRow`, history sorting, `sendOutShare`, `lngRegionRow` |
| `regions` | `REGIONS`, `regionOf`, `sumOrNull`, `weightedAverage` |
| `countries` | `countryNameOf`, `knownCountryCodes`, `isEuMember` |
| `entsoe` | XML/documents, intervals, hourly/daily reduction, aggregation, flow netting and analytics |

Read the TypeScript declarations and source comments for exact fields. The initial
API is provisional and is not a promise of compatibility with a hosted site's API.

## Missing values and coverage

`null` means absent, unknown or unparseable. A reported zero is valid.
`sumPoints` returns the sum of the available member values and a matching
`{ present, of }` member count. A partial sum is not an estimate of the full group.
Coverage counts members, not their share of capacity or demand.

Use `sumPoints(series, expectedMembers)` if entire members are absent. The
default expected count is the number of supplied series. `partialAbove` uses a
caller-provided minimum share; pass `1` to require every expected member.
The inherited `PARTIAL_SHARE = 0.8` is an optional display convention, not a
statistical guarantee or an industry standard.

Input timestamps use Unix milliseconds, with each timestamp denoting the start
of an interval. Supply finite numbers or `null`; arrays of member series should
refer to the same measurement and compatible units. Read source function
comments for duplicate and parameter validation behaviour.

## Units and intervals

- Storage energy/volume and injection/withdrawal units are recorded on the fields.
- LNG inventory is in 1,000 m³ LNG; send-out is GWh/day. The volume branch of nested
  LNG objects is used for fill percentages.
- ENTSO-E power values are generally MW; averaging MW preserves power units.
  Integrating interval mean power over hours yields MWh. Reservoir values are
  energy quantities and must not be integrated as if they were power.
- Daily reductions use UTC calendar days. They do not implement local market
  days, which can contain 23 or 25 hours around daylight-saving transitions.
- `toDaily` requires the correct interval duration. `toDailyMixed` infers interval
  cadence from timestamps. Missing intervals should be explicit `null` entries;
  sparse timestamps alone cannot always distinguish missing data from a change
  in resolution. Complete input grids are recommended.

Document parsing supports GL market documents for load/generation/reservoirs and
A11 physical flows. It is not a complete IEC XML implementation or a general XML
validator. The small XML reader drops namespace prefixes and does not implement
DTD expansion. Consumers accepting untrusted inputs should also set request-size
and resource limits. Day-ahead price document parsing is outside this release.

The inherited GL parser does not fully validate requested document type, unit,
date range, revision ordering or auction semantics. Callers must establish those
constraints before treating returned quantities as a validated provider dataset.

## Caller-supplied zone mappings

No production zone catalogue is bundled. `parseEntsoeResponse(xml, item)` preserves
the input EIC as both `Series.zone` and `Series.eic`. With an explicit resolver,
`zone` becomes the application code while `eic` retains the source identifier.
An unmapped EIC throws when a resolver is supplied.

```js
// Fictional identifiers for illustration; supply metadata you have rights to use.
const registry = entsoe.createZoneRegistry([
  { code: "AB", eic: "synthetic-AB", countries: ["AA", "BB"], label: "Shared example" },
]);
const parsed = entsoe.parseEntsoeResponse(xml, "load", {
  zoneCodeForEic: eic => registry.byEic(eic)?.code,
});
```

Registries expose `zones`, `byEic`, `byCode` and `zonesOf`. Each instance copies
and freezes its records, rejects duplicate codes/EICs and has no global state.
The lookup does not verify EIC registration or grant metadata reuse rights.
A zone can span countries; a zone's observations must not automatically be
assigned to each country. Regional groups are project choices and can be replaced.

Analytical series should contain one sorted entry per UTC day, including explicit
nulls. Calendar-based helpers assume ISO date strings; they do not validate every
possible invalid date. Moving averages and correlations operate on ordered
observations; without a complete grid a window is a count of rows rather than
proof of elapsed days. Linear target outlooks are mechanical extrapolations,
not forecasts or regulatory targets.

`TARGET_FULL = 90` is an inherited optional calculation default, not a statement
of any current statutory requirement. `LNG_EARLIEST` records the original
implementation's historical coverage assumption, not a guarantee of availability.
