# Verified Person - SG: what goes over the network

The technical companion to the privacy page (`/singpass/privacy`). It lists every
network message in a unique-person proof (`identity/singpass-unique-person`),
what each one contains, who can read it, and what is stored. Then it explains
why the hashes of your NRIC/FIN and mobile number can't be reversed.

**In short:** your NRIC/FIN and mobile number **never leave your device**.
Outside your browser there are only salted hashes of them, which can't be
reversed without random values that never leave your device, and a
zero-knowledge proof (with a derived code, H) that only the attested enclave
can decrypt.

## Who's involved

| Party | What it is |
| --- | --- |
| **Extension** | The TLSNotary browser extension (the prover), on your machine |
| **Page** | The zeroknowledger site in your browser |
| **Singpass** | `portal.singpass.gov.sg` |
| **Enclave** | `enclave.zeroknowledger.com`: a Google Confidential Space VM (Intel TDX) running the TLSNotary verifier (MPC mode) and the enclave issuer. Reached through a Cloudflare Tunnel |
| **Worker** | `api.zeroknowledger.com`: the registry API on Cloudflare Workers, with the D1 database |
| **App** | The third-party app you're linking an account in, if any |

## Step by step

### 0. Wake the enclave (Page → Worker)

`POST /enclave/wake` with `{ proof_id }`, a random id the page makes for this
proof. If the VM is stopped, the Worker starts it. Nothing personal.

### 1. MPC-TLS with Singpass (Extension ↔ Enclave ↔ Singpass)

The extension and the enclave's verifier jointly run one TLS connection to
Singpass, relayed through the enclave (`/proxy`). The TLS session keys are
**split between the two** (MPC), so neither can read or forge the traffic
alone.

| What travels | Who can read it |
| --- | --- |
| Your request to Singpass, including your `SP-PORTAL-SESSION-ID` cookie, and Singpass's response with your profile | **Nobody but you.** Encrypted by TLS to Singpass, and the enclave holds only half the key |
| The MPC protocol messages (Extension ↔ Enclave, over WebSocket) | The enclave (it's the other party), and Cloudflare (it terminates the tunnel's outer TLS). They contain no plaintext |

### 2. Selective disclosure (Extension → Enclave's verifier)

After you approve the extension's disclosure screen, it proves to the verifier:

| Part | Revealed or hashed |
| --- | --- |
| Request line (`GET /home/api/secured/profile-update-details HTTP/1.1`) | Revealed |
| `Host` header | Revealed (the cookie is **not**) |
| Response status line, `date` header | Revealed (to check it's a fresh, successful response) |
| `"status":"SUCCESS"` | Revealed |
| `"singpass_id":"S1234567D"` | **Hashed:** `SHA256(those bytes ‖ 16 random bytes)` |
| `"mobile_number":"91234567"` | **Hashed:** `SHA256(those bytes ‖ 16 random bytes)` |
| Everything else (name, email, address, …) | Neither: never leaves the extension |

The 16 random bytes ("blinders") are made fresh by the extension for each field
and each proof, and never leave your device.

The session data also carries:
- `holder`: your browser's holder secret. The Worker hashes it to your holder id. The enclave and Worker see it in transit; only the hash is stored.
- `proof`: the proof id.
- `challenge` and `app`: the account-link code and its app, when linking an app account.
- `mode`: `Mpc`.

### 3. Verified result (Enclave issuer → Worker)

The verifier's webhook goes to the enclave issuer next to it. The issuer keeps
the two hashes **in memory** for 10 minutes, keyed by proof id, and forwards
the result to `POST /enclave/webhook`, signed with its attested key. The result
contains the server name, the session data, the revealed transcript bytes
(unrevealed bytes are zeroed) and the two hashes.

The Worker checks the signature and the template's rules, then stores:
- **`pending_proofs`:** proof id, template, holder id, challenge, the two hashes, the time. Deleted when the proof finishes, or after 10 minutes.
- **`attempts`:** session id, server name, and the outcome text, for debugging. No values.

### 4. Zero-knowledge proof, on your device (Extension → Page)

The extension returns the proof result to the page, **including the plaintext
of the two hashed fields and their blinders** (this is what the patched
extension adds). This stays inside your browser, where the page proves with
the Noir circuit `verifier/circuits/singpass_person` (UltraHonk, bb.js):

- **Private inputs** (never leave the device): the two committed key-value byte strings and their blinders.
- **Public inputs:** the two commitments, and `H = Poseidon2(domain, NRIC, mobile)`.
- **What it proves:** each commitment is `SHA256(bytes ‖ blinder)` of a well-formed `"singpass_id":"…"` / `"mobile_number":"…"` field, and H is computed from those values.

### 5. Attestation check (Page → Enclave, Page → Google)

- `GET /enclave/attestation` (public) returns the enclave's signing key, its encryption key, and a Google-signed attestation token.
- `GET` Google's public signing keys (JWKS).

The page checks Google's signature on the token and the claims: Confidential
Space, a production image, Intel TDX, debugging off, an image digest from
`verifier/gcp/published-digests.txt`, and a nonce equal to
`sha256(signing key ‖ encryption key)`. Nothing personal is sent.

### 6. Sealed proof (Page → Worker → Enclave)

The page encrypts `{ proof, publicInputs }` (the public inputs carry the two
commitments and H) with **HPKE** (X25519, HKDF-SHA256, AES-256-GCM) to the
attested encryption key. The proof id is bound in as associated data, so the
ciphertext can't be replayed for another proof.

- `POST /proofs/<proof_id>` with `{ sealed: { enc, ct } }`.
- The Worker relays it unopened to `POST /enclave/person`, adding `{ proof_id, circuit, scope, app }`.

| Who sees it | What they see |
| --- | --- |
| Cloudflare, the Worker | Ciphertext only. The private key was generated inside the enclave and never leaves it |
| The enclave | The proof, the two commitments and H. **Not** your NRIC/FIN or mobile |

### 7. Person id (Enclave → Worker)

The enclave checks the proof's commitments are exactly the two its own verifier
recorded for that proof (one attempt per TLS session), and verifies the proof
(bb.js). It then returns, signed:

```
person = HMAC-SHA256(person_key, scope ‖ app ‖ H)
```

`person_key` is 256 bits, generated inside the enclave and stored only as a
Cloud KMS ciphertext that KMS decrypts solely for the published enclave image.
`app` is the app from the enclave's own session record, so the same person gets
an unrelated id in every app.

### 8. Stored, and told to the app (Worker → D1, Worker → App)

| Table | Contents |
| --- | --- |
| `badges` | holder id, template, issue time, Singpass response time, session id |
| `bindings` (when linking an app) | app id, `person` (per app), the app's account id, `pairwise_id = HMAC(NULLIFIER_KEY, app ‖ person)` (truncated) |
| `challenges` | the link code, app, account id, status, the resulting `pairwise_id` |

The app receives (by webhook, or by looking up its account): `bound`, its
account id, `pairwise_id`, and the public check URL. **Never** the NRIC/FIN,
mobile, name, holder id or person id.

### 9. Later: listing your badges (Page → Worker)

`POST /holders/me/badges` with `{ secret }`. The Worker hashes it to the holder
id and returns that holder's badges. There's no public lookup by holder id.

## Where your NRIC/FIN and mobile exist

| Place | Form |
| --- | --- |
| Your browser (extension and page) | Plaintext (it's your own data); the proof is made here |
| Network, Cloudflare, Worker | Salted hashes, or HPKE ciphertext |
| Enclave | **Not there.** It sees the proof and H (a derived code), briefly, in memory |
| D1, logs, the app | **Nowhere.** Only keyed, per-app ids derived from H |

## Why the hashes can't be reversed

A hash on its own is **not** enough here. The inputs are tiny:

- An NRIC/FIN is a prefix letter (S, T, F, G, M), 7 digits and a check letter computed from the rest: about **50 million** possibilities.
- A Singapore mobile is 8 digits starting with 8 or 9: about **20 million**.

A plain `SHA256("S1234567D")` could be reversed by trying every NRIC: 50
million hashes take well under a second on a laptop. That's why every
commitment includes a **blinder**:

```
commitment = SHA256( "singpass_id":"S1234567D" ‖ blinder )    blinder = 16 random bytes
```

- **The blinder is unguessable.** It comes from a cryptographically secure random generator, fresh for every field of every proof, so there are 2¹²⁸ (about 3.4 × 10³⁸) possible values. Testing even one candidate NRIC means trying blinders, and at a trillion hashes per second that would take about 10¹⁹ years.
- **The blinder never leaves your device.** It's used only inside the zero-knowledge proof, as a private input (step 4).
- **SHA-256 is preimage-resistant.** Without the full input, there's no known way to get from the hash back to it, or to find a different input with the same hash (so the commitment also can't be "re-opened" to another NRIC).
- **The hashes are short-lived.** They exist in enclave memory and in D1 `pending_proofs` only until the proof finishes (at most 10 minutes).

**H is different: it has no blinder.** `H = Poseidon2(domain, NRIC, mobile)` is
the same for the same person every time (that's what makes uniqueness work),
so whoever reads H could test guesses: about 10¹⁵ combinations, or 2 × 10⁷
with a known NRIC. That's why H is only ever sent sealed to the enclave (step
6), is never stored, and is immediately keyed into a per-app id.

The same reasoning covers the ids that are kept:

- **`person`** is an HMAC with a 256-bit key that exists only in the enclave. Without the key, a `person` value can't be tested against guesses.
- **`pairwise_id`** is an HMAC of `person` with the Worker's `NULLIFIER_KEY`.

**The honest limit:** whoever holds `person_key`, or sees H, *could*
brute-force: with one known NRIC, about 20 million guesses (seconds) find the
phone number. With neither known, about 10¹⁵ tries (days on GPUs). That's why
the key is generated in the enclave, sealed with Cloud KMS, and released only
to the published, attested enclave image (`verifier/gcp/README.md`), and why H
is only ever decrypted there.

## What you still trust

- **Your browser:** the extension and the page see your values in plaintext, to make the proof.
- **The enclave image:** the published code, attested by Google Confidential Space on Intel TDX.
- **Singpass's response format:** the person id is derived from the exact committed bytes.
