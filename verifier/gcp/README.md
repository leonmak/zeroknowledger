# Enclave deployment (Google Confidential Space, Intel TDX)

The person key, the TLSNotary verifier and the zero-knowledge proof check move
into an attested TEE, so the operator (us) can't compute person ids for guessed
NRIC/mobile pairs. The NRIC/mobile values never leave the user's device.

```
extension ── MPC-TLS ──► enclave.<domain> ─┐   Cloudflare Tunnel, no inbound ports
                                           ▼
   ┌──────────── Confidential Space VM (Intel TDX, c3-standard-4) ───────────┐
   │ tlsn-verifier-server  MPC_ONLY=1, ALLOWED_HOSTS                          │
   │        │ webhook (localhost)                                             │
   │        ▼                                                                 │
   │ enclave issuer        person key: generated here, sealed with Cloud KMS  │
   │                       Ed25519 signing + X25519 HPKE keys, both bound     │
   │                       into the attestation                               │
   └────────┬────────────────────────────────▲────────────────────────────────┘
            │ signed webhook                  │ sealed ZK proof ▲  │ signed person id
            ▼                                 │                 │  ▼
   Cloudflare Worker (registry): verifies the attestation + signatures, runs the
   template rules, relays the browser's sealed proof unopened, stores
   bindings in D1. It never sees the person key, H or the values.
```

## What it guarantees

| Property | How |
| --- | --- |
| Nobody outside the enclave can read the person key | Generated inside on first boot; stored only as a Cloud KMS ciphertext in GCS; KMS decrypts only for a token from Confidential Space, production image, Intel TDX, debug off, and an image digest in `published-digests.txt` |
| The enclave isn't a guessing oracle | It only computes a person id for commitments its own TLSNotary verifier authenticated from a real TLS session to an allowed host, once per session |
| Proofs can't be forged by the operator | MPC-TLS only (`MPC_ONLY=1`): the host controls the enclave's network, which proxy mode would have to trust |
| The Worker only trusts that exact code | Signatures are checked against a key bound (`eat_nonce`) into a Google attestation token whose image digest must be in the Worker's `ENCLAVE_IMAGE_DIGESTS` |
| Only the enclave reads H | The browser proves on-device that H = Poseidon2(NRIC, mobile) opens the commitments, checks the same attestation itself (digests from `published-digests.txt`, built into the site) and HPKE-seals the proof and H to the bound key, with the proof id as associated data; the Worker and Cloudflare only relay ciphertext. The enclave verifies the proof (bb.js) |
| The enclave's clock is right | Confidential Space doesn't sync time; the verifier runs under libfaketime, offset by Google's HTTPS `Date` (`enclave/clock.mjs`), since MPC-TLS allows 5 s of skew |

Still to come: proving inside the extension, so the site's JavaScript never
sees the values either.

## Deploy

One-time, as you (these can't be automated):

```sh
gcloud billing projects link zeroknowledger --billing-account=<account>
cloudflared tunnel login      # pick zeroknowledger.com
```

Then:

```sh
gcp/deploy.sh tunnel   # enclave.zeroknowledger.com -> tunnel
gcp/deploy.sh setup    # APIs, registry, KMS, bucket, identity pool, service account
gcp/deploy.sh build    # image + digest -> gcp/published-digests.txt
gcp/deploy.sh allow    # only published digests may unseal the key
gcp/deploy.sh vm       # Confidential Space VM on the latest digest
```

Then point the Worker at it (`wrangler.jsonc` vars) and redeploy:
`ENCLAVE_URL=https://enclave.zeroknowledger.com`,
`ENCLAVE_IMAGE_DIGESTS=<the digests file, comma-separated>`. And build the site
with `VITE_VERIFIER_URL=https://enclave.zeroknowledger.com`,
`VITE_REGISTRY_URL=<the Worker URL>`, `VITE_TLSN_MODE=Mpc`.

## Upgrading without losing the key

The key only unseals for published digests, so a new build must be allowed
before it runs: `build` (adds the new digest), `allow` (old and new may
unseal), `vm` (switch), add the digest to the Worker's list, rebuild and
deploy the site (it embeds `published-digests.txt` to check the attestation),
and later remove the old digest from the file and run `allow` again. A digest removed while
still running locks that VM out of the key on its next restart. Rotating the
key itself resets uniqueness: every person looks new.

## Cost

The VM is billed by the second while running, so it only runs on demand
(`gcp/deploy.sh control`, once): before a unique-person proof the site calls
`POST /enclave/wake`, which queues the proof and has the Worker start the VM
(ready in about 70 s); a cron trigger checks every minute and stops it once no
proof is queued or awaiting its sealed openings (`src/enclaveControl.ts`). A
proving session costs a few minutes of a `c3-standard-4`; idle, only the boot
disk (about USD 1/month) is billed. A VM started by hand is stopped by the same
check within a minute or two unless a proof is queued. KMS, GCS and Artifact
Registry are cents. Estimates; check current pricing for `asia-southeast1`.
