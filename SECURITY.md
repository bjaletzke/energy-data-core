# Security reporting

Please use [GitHub private vulnerability reporting](https://github.com/bjaletzke/energy-data-core/security/advisories/new)
to report security issues. Private reporting is enabled for this repository.
Do not include credentials, production responses or sensitive data in public issues.

Include the affected commit/version, a minimal synthetic reproduction, expected
behaviour and the impact. The latest default-branch source is the initial supported
version. No response-time guarantee is offered.

The library performs no provider requests and stores no credentials. Applications
that accept untrusted XML or data must set suitable input-size/resource limits and
validate requested units, document types and periods. See docs/API.md for format
and validation limits. Provider data rights are separate from the code licence.
