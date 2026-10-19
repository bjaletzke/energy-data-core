# Changes

## 0.1.0 — initial public source (19 October 2026)

MIT licensed; provider data rights remain separate. Source publication does not
include an npm package or hosted demo deployment.

Extracted storage/LNG parsing, ENTSO-E formats, time-series calculations, coverage
and a synthetic browser demo into a runtime-neutral library. Excluded provider
clients, application API payloads, refresh policy, storage and deployment code.

Changes from the inherited implementation:

- Mixed-resolution daily means are duration-weighted. These rows expose
  `coveredHours`, used by `isCompleteDay` instead of a potentially misleading
  observation count. Timestamp-based inference remains ambiguous for omitted
  intervals; preserve explicit null readings and complete grids.
- Identical duplicates collapse during aggregation and mixed daily reduction;
  conflicting observations within a member throw rather than inflating coverage
  or silently selecting a revision.
- Expected aggregation member counts must be valid integers covering all supplied members.
- Analytical windows and reference-year counts must be positive safe integers.
- Resolution and fuel lookups no longer accept inherited object properties.
- Removed the inherited 41-zone catalogue after attribution review. Registry
  helpers now index caller-supplied records only. Document parsing preserves
  source EICs by default or accepts an explicit zone-code resolver, retaining
  the original EIC separately. This supersedes the initial candidate's globals.

These changes have not been applied to the private hosted application.
