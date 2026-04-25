# Badge Storage Strategy

Last updated: 2026-04-25

## Short Answer

Users should not need to upload raw TLSNotary proofs to the cloud to share badges.

## Recommended Model

1. Keep proof generation and sensitive transcript material local by default.
2. Publish only minimal, signed claim metadata needed for verification.
3. Use share links (for example, `/cases/<handle>?badges=...`) to render badge views from badge IDs and attestations.
4. Treat cloud as optional sync for encrypted attestations and profile settings, not a mandatory source of truth.

## What To Store In Cloud (Optional)

- Public profile handle and display settings
- Badge references (template IDs)
- Signed claim payloads and signatures
- Revocation and freshness timestamps

## What Not To Store In Cloud

- Full TLS transcripts
- Raw page captures or sensitive account fields
- Secrets, session cookies, or auth tokens

## Why This Works

- Better privacy posture and lower liability
- Smaller payloads and cheaper infra
- Easier compliance story
- Still supports shareable and verifiable badge pages
