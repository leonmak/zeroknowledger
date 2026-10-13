# Identity sources

An identity source is where a "unique person" comes from: today, Singpass. The
app-facing half (per-app bindings, moves and cooldowns, pairwise ids, webhooks,
`/singpass/verified/…` style check pages) and the enclave that keys person ids
are shared. Each source supplies four things.

| Piece | Where | Singpass example |
| --- | --- | --- |
| Template | `docs/tlsnotary/templates/<name>.json` | `singpass-unique-person.json` |
| Circuit | `verifier/circuits/<circuit>/` (Noir) | `singpass_person` |
| Site adapter | `src/lib/identity/<source>.ts`, listed in `src/lib/identity/index.ts` | `singpass.ts` |
| Privacy page | `src/pages/…` | `/singpass/privacy` |

## The contract

**Template.** Hash-commit the identifying fields, never reveal them:

- `prove_params.commit_fields`: JSON paths to commit, in order, e.g.
  `["result.singpass_id", "result.mobile_number"]`.
- `issue_when.person_proof`: `{ "circuit": "<circuit>", "scope": "<scope>" }`.
  `scope` separates people across sources: the same H under two scopes gives
  two unrelated person ids.
- The usual `issue_when` checks (status, `max_age_seconds`, revealed `json`
  values) still apply.

**Circuit.** Its public inputs must be, in order:

1. each commitment in `commit_fields` order, as 32 byte-sized inputs
   (`[u8; 32]`, the SHA-256 TLSNotary produced: `SHA256(bytes || 16-byte blinder)`),
2. then H as its single return value.

So `parsePublicInputs` in `proof-verifier/lib.mjs` reads 32×N + 1 inputs. Inside,
the circuit must open each commitment, check the committed bytes are the
expected field (fixed key prefix, value format), and derive H from values that
are **stable** for a person. A value that can change (e.g. a phone number)
makes uniqueness per current value; say so on the privacy page. The enclave
keys `HMAC(enclave key, scope || app || H)`.

**Site adapter.** Maps the extension's openings (`{ hash, blinder, plaintext }`
per committed range, hex, re-paired by `openingsFrom`) to the circuit's input
names, and lazy-loads the compiled circuit. `openingFor(openings, '"key":"', label)`
finds a field by its committed key.

## Adding one

1. Find the endpoint that returns the identifier (DevTools on the portal), and
   write the template with `commit_fields` and `issue_when.person_proof`.
2. Write the circuit in `verifier/circuits/<circuit>/` with `nargo test`
   cases (wrong blinder, wrong field, bad format), then `nargo compile`.
3. Add `circuits/<circuit>/fixture-inputs.mjs` exporting `inputs()` (a
   synthetic witness), then:
   ```sh
   node scripts/circuit.mjs vk <circuit>        # verification key + public input count
   node scripts/circuit.mjs fixture <circuit>   # proves + verifies; the enclave image checks it at build
   ```
4. Copy `circuits/<circuit>/target/<circuit>.json` to the site's
   `src/lib/circuits/`, write the adapter and add it to `src/lib/identity/index.ts`.
5. Add the host to the enclave's `ALLOWED_HOSTS` (`gcp/deploy.sh` reads the
   templates), rebuild and roll out the enclave (`gcp/deploy.sh build`, `allow`,
   `vm`), then deploy the Worker and the site.

## Before you start: is this the right route?

- **Law first.** Some national identifiers can't be collected or used by
  private services at all, even hashed (e.g. Japan's My Number). Get local
  advice before building on one.
- **Prefer government-signed data when it exists.** Proving over a signature
  the government already made (an ePassport chip, India's signed Aadhaar QR,
  Japan's JPKI certificate on the My Number Card) needs no TLSNotary verifier
  or portal session. That's a different kind of source: a circuit that checks
  the signature instead of TLS commitments, with a phone app to read the chip.
  TLSNotary portal sources suit places where only a logged-in portal exists.
