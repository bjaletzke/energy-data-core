# Zone registry attribution review

Reviewed 19 October 2026. Scope: the inherited 41-zone code/EIC/country/label
catalogue, distinct from this library's parsing code and from price observations.

## Evidence

| Source | Finding | Consequence |
| --- | --- | --- |
| [euenergy privacy policy, Data licence](https://euenergy.live/privacy) | Expressly identifies day-ahead price data under CC-BY-4.0. | No explicit grant for the separate zone catalogue was established. |
| [euenergy About, Data and licence](https://euenergy.live/about) | Describes ENTSO-E price republishing and an attribution header. | Does not establish a blanket licence for metadata or source code. |
| [ENTSO-E EIC page](https://www.entsoe.eu/data/energy-identification-codes-eic/) | Makes approved EIC lists and an XML download available. | Public access was not treated as an open redistribution licence. |
| [ENTSO-E disclaimer, sections 2–3](https://www.entsoe.eu/about/legal-and-regulatory/disclaimer/) | Reserves content rights and restricts reuse absent permission or an applicable exception. | No blanket commercial redistribution clearance was inferred. |
| [EIC Reference Manual 5.5, page 2](https://www.entsoe.eu/Documents/EDI/Library/EIC_Reference_Manual_Release_5_5.pdf) | Permits certain manual/implementation-related copies with retained notices. | This was not treated as a licence to the separate registry dataset. No manual text is bundled here. |

These are observed source statements and a conservative release decision, not a
finding that every individual identifier is protected or that every possible use
is prohibited. No rights-holder permission was requested or received. The review
does not decide the separate rights to observations served by the private site.

## Release disposition

Exclude the inherited catalogue entirely. Do not relabel it MIT, replace its
attribution with a different source, or treat independently checking its values
as removing its inherited provenance.

`createZoneRegistry(records)` indexes only caller-provided metadata. By default,
the document parser retains the input EIC as `Series.zone` and `Series.eic`.
An explicit resolver can map it to a caller-owned application code; unmapped
identifiers then throw. Zones can name multiple countries without assigning all
observations to one country.

All registry-specific tests use fictional identifiers. The release check rejects
production-format EIC literals in source, tests and demo files. Build output and
static demo output are rebuilt from the reviewed source. The exact Git index and
npm package contents are inspected before publication.

The private application can keep its existing catalogue and supply a resolver
when it adopts the library. That is an integration option, not redistribution
clearance for the private catalogue. A future bundled catalogue needs its own
documented source/licence review or explicit permission.
