# Contributing

The public contribution workflow will be enabled when the repository is published.
For this candidate, run `bun install --frozen-lockfile` and `bun run check`.

Use authored synthetic fixtures. Do not add production responses, credentials,
provider tokens or operational configuration. Document units, UTC/local-time
assumptions, missing-data handling and coverage for any new calculation. Changes
to the explicit source allowlist need a boundary review.

Keep provider access and hosted-service orchestration outside the library. Include
behavioural tests for meaningful format or calculation changes. The demo must run
without provider keys and must keep synthetic examples clearly labelled.

A private security-reporting destination must be configured before inviting public
reports. Do not post credentials or sensitive findings in a public issue.
