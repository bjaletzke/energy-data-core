# Local validation — 19 October 2026

Validated with Bun 1.4.2, Node.js 22.23.0 and TypeScript 5.9.3 on macOS.

- 46 unit tests passed, with 188 assertions.
- Strict TypeScript checks passed for source, tests and scripts.
- ESM JavaScript and declaration build passed.
- The 14-file source allowlist and zero-runtime-dependency boundary passed.
- Emitted JavaScript imported and executed under Node.js.
- npm dry-run package contents matched the explicit public file allowlist.
- An isolated copy installed with an empty Bun package cache and credential-like
  environment variables removed, then passed checks and built the static demo.
- A real package archive installed into a separate temporary Node.js consumer;
  both root and storage subpath imports executed successfully.
- Desktop browser acceptance passed the complete-day and gapped-day controls,
  24-row table, real-zero observation and missing-observation examples. The UI
  showed 19 complete, four partial and one missing hour in the gapped scenario;
  24 complete hours in the complete scenario. The page exposed no load error.
- The demo server returned 404 for `.env` and `package.json` requests.
- A targeted scan found no personal absolute paths, production-site endpoints or
  private runtime imports. Gitleaks 8.30.1 (official binary, release checksum
  verified) then scanned the exact staged source export and unpacked npm archive
  with default rules, no per-finding exclusions and fully redacted output: zero
  findings in both. Dependency caches were outside the release scan scope.
- The inherited 41-zone catalogue is absent from source, tests, compiled JS and
  the static demo. Production-format EIC literals were checked across the staged
  public source and packed files. Caller-provided mappings, preservation of source
  identifiers, unknown mappings and cross-country zones have behavioural tests.
- The current staged source installed with an empty package cache and passed the
  full checks and static demo build after the registry change.
- The private source worktree remained clean after extraction.

Not established: mobile browser acceptance, Cloudflare Worker runtime acceptance,
current provider schema conformance.
The registry attribution review is complete for this release: the catalogue is
excluded, and no claim to redistribution permission is made. MIT was selected by
the owner and applied consistently to the project-owned code, demo and docs. The repository is public at
[bjaletzke/energy-data-core](https://github.com/bjaletzke/energy-data-core). GitHub
runs the complete check/build workflow on pushes and pull requests; inspect the
[workflow results](https://github.com/bjaletzke/energy-data-core/actions/workflows/check.yml)
for the current commit. Local evidence above is distinct from those CI results.
No npm publication or hosted application deployment is part of source publication.
