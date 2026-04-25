# TLSNotary Seed Template Library

This folder contains the first seed set of verification method templates for TLSNotary-based proofs.

## Goals

- Give users concrete templates they can browse and fork.
- Give contributors known-good structure and naming conventions.
- Build a review and monitoring baseline before scaling submissions.

## Status Model

- draft: shape is useful, selectors or extraction still unverified
- tested: validated with fixture and manual run
- production: stable and actively monitored
- deprecated: no longer recommended

## Naming

Template name format:

`<namespace>/<service>-<claim>`

Examples:

- `income/stripe-monthly-volume`
- `dev/github-account-age`
- `hospitality/airbnb-superhost`

Template filename format:

`<service>-<claim>.json`

## Review Checklist

- Target URL and auth mode are accurate.
- Selector and pattern are narrow enough to avoid false matches.
- Selector has been tested against current target site.
- Fallback selectors provided for known DOM fragility.
- Redact list removes account, token, and personal data fields.
- Disclose field reveals only minimum required information.
- Badge label is clear and user-facing.
- Freshness policy is defined.
- Locale handling documented (or single-locale assumption stated).
- Extraction logic can handle at least 2 variants of target DOM.

## TLSNotary-Specific Guidance

For templates to work with TLSNotary:

1. **Selector stability** — Must match target site within last 24 hours
2. **Fixtures required** — 2+ real captured HTML files for validation
3. **Redaction completeness** — All PII must be removed before proof submission
4. **Locale awareness** — Document language/region constraints
5. **Status progression** — draft → tested → production based on real notarizations

See [TLSNOTARY_WORKFLOW.md](./TLSNOTARY_WORKFLOW.md) for integration details.

## Next Work

- Add fixture captures for each seeded template.
- Add CI schema validation for all template files.
- Add template health monitor and stale-template alerts.
- Create fixture corpus with at least 2 examples per template.
