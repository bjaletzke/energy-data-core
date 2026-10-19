# Contributing

Report bugs and propose changes through [GitHub issues](https://github.com/bjaletzke/energy-data-core/issues).
Pull requests are welcome. Run `bun install --frozen-lockfile`, `bun run check`
and `bun run demo:build` before submitting a change.

Use authored synthetic fixtures. Do not add production responses, credentials,
provider tokens or operational configuration. Document units, UTC/local-time
assumptions, missing-data handling and coverage for any new calculation. Changes
to the explicit source allowlist need a boundary review.

Keep provider access and hosted-service orchestration outside the library. Include
behavioural tests for meaningful format or calculation changes. The demo must run
without provider keys and must keep synthetic examples clearly labelled.

Use [private vulnerability reporting](https://github.com/bjaletzke/energy-data-core/security/advisories/new)
for security findings; see SECURITY.md. Do not post credentials or sensitive findings
in a public issue. Contributions to project-owned code use the MIT licence in LICENSE;
preserve relevant third-party notices.
