# Sources and third-party material

The library contains project-owned code extracted and adapted from the owner's
energy-data application, plus authored tests and a synthetic browser demo. The
project-owned code, demo and documentation are MIT licensed, credited to Energy
Data Core contributors. See LICENSE and [licensing](docs/LICENSING.md).

## Formats and source names

Storage and LNG parsers implement GIE AGSI+/ALSI+ field shapes. Their original
implementation references GIE API manual v007 (October 2022). Refer to
[AGSI+](https://agsi.gie.eu/) and [ALSI+](https://alsi.gie.eu/) for the services and
their documentation and access terms. No manuals, production API responses,
snapshots or credentials are distributed here.

ENTSO-E document and field names, document-type codes and fuel-category names
refer to the [Transparency Platform](https://transparency.entsoe.eu/). This is
source identification, not a grant of rights to provider observations or an
assertion of current schema conformance. No provider observation dataset is
included. The demo's quantities and miniature test documents are authored
synthetic examples. Their fictional identifiers are not usable EIC registrations.

The country-name lookup is a small project-authored helper; regional groups are
application-defined choices, not official bidding-zone boundaries.

## Zone registry review — 19 October 2026

The first local candidate inherited a 41-zone catalogue whose source comment
credited [euenergy.live](https://euenergy.live/). That catalogue has been removed
from the public source, tests, JavaScript build and static demo. The library
now preserves input EICs or maps them using caller-supplied metadata. The registry
helper includes no production records and performs no provider requests.

The review did not establish a redistribution licence for the inherited catalogue.
euenergy's published CC-BY-4.0 statement expressly addresses price data; it was
not treated as a licence for all metadata or code. ENTSO-E's published EIC list
was not treated as unrestricted merely because it is publicly downloadable.
See [the review evidence and disposition](docs/REGISTRY.md).

This release therefore does not depend on permission to redistribute that
catalogue. Supplying one's own mapping does not waive any third-party conditions
on that mapping. Attribution alone does not grant redistribution rights.

## Development dependencies

The library has no third-party runtime package dependencies. TypeScript is a
development tool under Apache-2.0; Bun type definitions and their transitive type
dependencies carry their respective upstream licences in the installation.
They are not bundled in the library's JavaScript output. The lockfile records
the development dependencies.

## Rights boundary

The project source-code licence does not grant rights to provider datasets, API
access, documentation, logos or brands. Consumers supply inputs and must establish
their own rights to use and redistribute them. No ENTSO-E/GIE endorsement is claimed.
