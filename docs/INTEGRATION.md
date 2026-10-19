# Private application integration plan

The hosted application is unchanged. This package is a standalone candidate.

1. Review the exported modules, code ownership and licence.
   Keep application presentation rules and scheduling policy in the private repo.
2. Test the packed archive in an isolated application branch. Use a pinned package
   release or immutable source revision; do not point production at a floating branch.
3. Replace private model/parser imports with the public package. Temporary private
   re-export wrappers can preserve call sites while the dependency changes.
4. Keep hosted API payloads, source refresh settings and progress state private.
   The public `items` module supplies source schema metadata only.
   Keep the private zone catalogue there too. Pass a `zoneCodeForEic` resolver
   when parsing to preserve current application codes; the library no longer
   bundles that catalogue and otherwise returns source EICs as zone identifiers.
5. Compare the package's behaviour with existing ingestion fixtures and stored-data
   expectations. This extraction fixes some inherited edge cases, so importing it
   is a behaviour change requiring application-level tests.
6. Run the private application's full checks and build. Exercise sample mode and
   the existing live-data checks in the intended environment before deployment.
7. Merge and deploy through the private application's normal release process.
   Public library CI or a package tag alone does not validate the hosted site.

Maintain domain logic in the public package after adoption; accept external
contributions there and upgrade the private application's pinned version deliberately.
Avoid a permanent copy-and-sync workflow between the repositories.
