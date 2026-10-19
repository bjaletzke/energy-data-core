# Energy Data Core

A small TypeScript library for European energy data: storage and LNG parsing,
ENTSO-E document parsing, time-series normalisation, aggregation and coverage.
The library has no runtime dependencies, provider requests or hosting requirements.
Its JavaScript build runs in browsers, Node.js and Bun and uses runtime-neutral APIs.
Cloudflare Worker compatibility is intended but has not yet been exercised in a Worker runtime.

**MIT licensed.** Project-owned library code, demo and documentation are available
under [MIT](LICENSE), credited to Energy Data Core contributors. Provider data
rights are separate. The [registry attribution review](docs/REGISTRY.md) is complete:
the inherited catalogue is excluded and zone mappings are caller-supplied.

This repository is prepared locally and has not yet been published. npm publication
is disabled; a public Git repository can retain that setting. See
[release preparation](docs/RELEASE.md) for the remaining publication steps.

## Try the demo

Requires Bun 1.4.2 (the validated development runtime), Node.js 22 or later and npm
(used only to inspect the package contents during `check`). No keys are needed.

```sh
bun install --frozen-lockfile
bun run check
bun run demo
```

Open http://127.0.0.1:4174/demo/. Set `DEMO_PORT` to use a different local port.
The demo compares complete and gapped hourly demand for three fictional regions.
It runs the library in your browser and shows the inputs, results and coverage.
All quantities are authored synthetic examples. A reported zero remains an
observation; a missing observation remains `null`.

`bun run demo:build` creates `demo-dist/`, a standalone static demo. Serve that
directory at the root of an HTTP origin. It contains no production configuration,
provider data, trackers, external fonts or external scripts.

## Use the library

Build first with `bun run build`. Within this repository:

```js
import { entsoe, storage } from "./dist/index.js";

const { points, coverage } = entsoe.sumPoints([
  [{ ts: 0, value: 100 }, { ts: 3600000, value: null }],
  [{ ts: 0, value: 0 }, { ts: 3600000, value: 40 }],
]);
// points:   [{ ts: 0, value: 100 }, { ts: 3600000, value: 40 }]
// coverage: [{ present: 2, of: 2 }, { present: 1, of: 2 }]
const partial = entsoe.partialAbove(coverage, 1); // [false, true]

storage.toNumber("0");   // 0
storage.toNumber("N/A"); // null
```

The package exports `storage`, `lng`, `regions`, `countries` and `entsoe`
namespaces. ESM subpaths are also available for each namespace when installed
from a local package archive. See [API and assumptions](docs/API.md).

## Scope

Included:

- GIE-shaped storage and LNG row parsing, units, status and date helpers.
- ENTSO-E load, generation and reservoir document parsing; physical flow parsing.
- Interval expansion, hourly/daily reduction, fuel grouping and analytical calculations.
- Timestamp-aligned sums, weighted means and explicit coverage counts.
- Country-name helpers, caller-supplied zone lookups, tests and a synthetic-data browser demo.

Excluded:

- Provider clients, authentication, ingestion, rate limits and scheduled refreshes.
- Queues, caches, databases, hosted APIs, administrative endpoints and deployment configuration.
- Production snapshots, bulk map inventories, research extracts and branded application assets.
- The inherited bidding-zone catalogue and any downloaded EIC registry.
- Day-ahead price document parsing (weighted-mean calculations are generic).

The library does not contact or use a hosted site's API. Consumers supply their own
inputs and must establish their rights to obtain and reuse upstream data.

ENTSO-E parsing preserves source EICs by default. To use application zone codes,
provide a resolver over your own metadata. See [the API example](docs/API.md) and
[completed registry review](docs/REGISTRY.md).

## Development

`bun run check` typechecks the source, tests and scripts; runs the unit tests;
builds JavaScript and declarations; checks the source dependency boundary; and
exercises the emitted package under Node.js while inspecting the npm file list.
`bun test tests` runs the focused unit tests only.

Build output is ignored by Git and regenerated from `src/`. The npm package file
allowlist includes only the compiled library, documentation and licence notices.
The demo is part of the repository and has its own static build.

This is an extraction candidate, so the hosted application has not yet been
changed to consume it. See [integration plan](docs/INTEGRATION.md). Data formats
and code provenance are documented in [third-party notices](THIRD_PARTY_NOTICES.md).
