# Publication preparation

This is a local, unpublished library and demo. npm publication remains disabled
with `private: true`; this does not prevent sharing the Git repository publicly.

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

## Decisions still required

- Confirm the repository name and destination account before creating the public remote.

## Final publication steps

1. Review the staged initial tree and its scan evidence. Exclude local caches,
   generated builds and all private Git history from the public repository.
2. Verify the licence and notices in the final tree.
3. Run `bun install --frozen-lockfile`, `bun run check` and `bun run demo:build`.
4. Inspect `npm pack --dry-run --json --ignore-scripts` and test the archive in a
   clean consumer. Keep npm publication disabled unless separately requested.
5. Configure GitHub private vulnerability reporting and contribution channels on
   the new repository, then push the reviewed initial commit.
6. Verify GitHub CI and public rendering/links before announcing the repository.
   Tag the reviewed version and include the changelog as release notes.

The attribution review resolved this release's registry dependency by excluding
the catalogue, not by declaring its redistribution rights cleared. It makes no
change to the private site's provider access or data-use terms.
