# ZeroKnowledger Direction

Last updated: 2026-04-25

## Strategic Call

Build in this order:

1. Seed TLSNotary template library (content supply)
2. Add validation and health monitoring (quality and reliability)
3. Build lightweight method editor (creator activation)
4. Build dedicated extension flow only after usage data proves need

Reasoning:

- Registry products fail without initial content.
- Seed templates create immediate utility for users and contributors.
- Real template breakage and contribution patterns should shape editor UX.
- Extension work is expensive and should follow proof-flow bottleneck evidence.

## Current Execution Focus

Phase 1 scope for this repo:

- Publish a starter set of TLSNotary method templates in draft status.
- Define a stable template schema and contribution checklist.
- Tag each template with risk, auth mode, and data redaction assumptions.
- Track template maturity from draft -> tested -> production.

## Success Criteria For Seed Library

- At least 12 high-value templates available for browsing.
- Every template validates against the schema.
- Every template includes privacy-safe disclose and redact intent.
- Every template includes owner, review status, and freshness metadata.

## Decision Gate Before Editor

Build editor only after any two are true:

- 10+ external contribution attempts
- 30%+ template PRs fail due to schema or selector mistakes
- Repeated contributor feedback about JSON authoring friction

## Decision Gate Before Extension

Build a dedicated extension only after any two are true:

- Proof completion drop-off exceeds 40% in generation step
- Existing TLSNotary integration cannot support key target workflows
- At least 3 integration partners request smoother end-user proof UX
