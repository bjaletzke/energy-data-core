# Source publication and releases

Public source repository: [bjaletzke/energy-data-core](https://github.com/bjaletzke/energy-data-core).
npm publication remains disabled with `private: true`. The private hosted application
and its deployment are separate from this repository.

## Completed

- MIT was selected by the owner, applied in LICENSE and package metadata, and
  credited to Energy Data Core contributors. Provider data rights remain separate.
- Registry attribution review and source links are recorded in REGISTRY.md.
- The inherited production catalogue is excluded. Zone metadata is caller-supplied;
  source EICs are preserved and resolver behaviour is tested.
- Source/dependency and package allowlists keep hosted-service code out of the release.
- Public CI is prepared with pinned actions, read-only permissions and no secrets.
- The library, synthetic demo, API documentation, integration notes and changelog
  are ready for review. Local validation is recorded in VALIDATION.md.

The owner authorised publication under `bjaletzke/energy-data-core`.
GitHub private vulnerability reporting is enabled, with public contribution and
private security-reporting instructions in the repository.

## Release process

1. Review the proposed tree and scan evidence. Exclude local caches,
   generated builds and all private application history.
2. Verify the licence and notices in the final tree.
3. Run `bun install --frozen-lockfile`, `bun run check` and `bun run demo:build`.
4. Inspect `npm pack --dry-run --json --ignore-scripts` and test the archive in a
   clean consumer. Keep npm publication disabled unless separately requested.
5. Push the reviewed commits through the public repository's normal workflow.
6. Verify the complete GitHub workflow on the final pushed commit before sharing.
   [Current workflow results](https://github.com/bjaletzke/energy-data-core/actions/workflows/check.yml)
   and the README badge show the live CI state.
7. For a tagged release, tag the reviewed version and include the changelog as
   release notes. Creating a source repository does not publish an npm package.

The attribution review resolved this release's registry dependency by excluding
the catalogue, not by declaring its redistribution rights cleared. It makes no
change to the private site's provider access or data-use terms.
