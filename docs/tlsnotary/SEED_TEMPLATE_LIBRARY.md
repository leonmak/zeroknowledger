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
- Redact list removes account, token, and personal data fields.
- Disclose field reveals only minimum required information.
- Badge label is clear and user-facing.
- Freshness policy is defined.

## Next Work

- Add fixture captures for each seeded template.
- Add CI schema validation for all template files.
- Add template health monitor and stale-template alerts.
