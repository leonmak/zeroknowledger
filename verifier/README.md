# Verifier

The TLSNotary verifier that badge proofs run against, deployed as a Cloudflare
Container behind a Worker.

It's the upstream server from
[tlsn-extension/servers/verifier](https://github.com/tlsnotary/tlsn-extension/tree/main/servers/verifier),
built at a pinned commit with `verifier-server.patch`. The patch stops the
server logging revealed transcript data, and adds switches:

- `PROXY_ONLY=1` rejects MPC-TLS, so only
  [proxy mode](https://tlsnotary.org/blog/2026/04/22/proxy-mode) runs. The
  verifier forwards the TLS traffic itself, so there is no separate proxy.
- `ALLOWED_HOSTS` limits which servers it will connect to, in both modes
  (including the MPC-mode `/proxy` relay). It comes from
  `docs/tlsnotary/templates` (via `npm run templates`), so adding a template
  allows its host on the next deploy.
- `MPC_ONLY=1` rejects proxy mode. The enclave deployment (`gcp/`) uses it,
  because an enclave's host controls its network.

The Worker also blocks `/proxy`, the server's MPC-mode TCP relay.

## Issuing badges

After each verified proof the server posts a webhook (`config.yaml`) to
`http://issuer.internal/webhook`. The Container's outbound handler routes that
to `src/issuer.ts` in the Worker, so it never touches the internet and nothing
outside the container can call it. The issuer checks the template's
`issue_when` rules against the revealed transcript (host, request line, status,
the server's `Date` within `max_age_seconds`, and JSON values), then records the
badge in D1 against the holder: a hash of a secret the site keeps in the
browser and sends as session data. Templates without `issue_when` never issue.

### Linking app accounts to unique people

`identity/singpass-unique-person` never reveals the NRIC/FIN or mobile number,
and they never leave the user's device. It only works with the attested enclave
verifier ([gcp/README.md](gcp/README.md)):

1. The TLSNotary proof **hash-commits** `singpass_id` and `mobile_number`
   (`SHA256(bytes || 16-byte blinder)`); the enclave's verifier only gets the
   digests. Its webhook stores them as a pending proof under an id the browser
   chose, in the enclave and (signed) in the Worker.
2. The browser gets each commitment's opening from the extension and proves in
   zero knowledge (`circuits/singpass_person`, Noir) that
   `H = Poseidon2(domain, NRIC, mobile)` comes from exactly those commitments.
   It checks the enclave's attestation and HPKE-seals the proof (and H) to the
   enclave's key, then posts the ciphertext to `POST /proofs/<id>`.
3. The Worker relays it unopened. The enclave checks the proof is for the
   commitments its own verifier authenticated (once per session), verifies it
   (`proof-verifier/`, bb.js), and returns a signed
   `person = HMAC(enclave key, scope || app || H)`.

So neither value leaves the device, H reaches only the enclave, and the person
key only exists there. Uniqueness is per (NRIC, current mobile number): a new
number counts as a new person, a documented trade-off (see tests). Without
`ENCLAVE_URL`, unique-person badges can't be issued.

Opening access needs a TLSNotary extension that returns openings to plugins:
`extension-openings.patch` against tlsn-extension (upstream PR pending).

Singpass is one identity source; adding another (a template, a circuit, a
site adapter) is described in [IDENTITY_SOURCES.md](IDENTITY_SOURCES.md).
Circuit workflow: `cd circuits/singpass_person && nargo test && nargo compile`,
then `node scripts/circuit.mjs vk singpass_person` and
`node scripts/circuit.mjs fixture singpass_person`, and copy
`target/singpass_person.json` to the site's `src/lib/circuits/`.

Apps link their accounts ("subjects") to people through `src/apps.ts`:

1. An admin registers the app: `POST /apps` → API key and webhook secret.
   `app_id` is whatever counts as one app, e.g. `discord:<guild_id>` for one
   server or `discord` for all of them.
2. The app creates a one-time link for one of its users:
   `POST /apps/<app_id>/challenges {subject}` → `https://<site>/bind?code=…`.
3. The user opens it, sees what the app gets, and proves Singpass there.
4. Per app, a person holds one subject and a subject one person. If the
   person is linked to another subject, the bind page asks before moving it;
   moves are limited to one per `cooldown_days`. A subject proved by a
   different person switches to that person.
5. The app gets `bound` / `unbound` webhooks (`X-ZK-Signature: sha256=<HMAC
   of the body>`), and can always re-check with
   `GET /apps/<app_id>/subjects/<subject>`.

Apps only see a pairwise id, `HMAC(key, app_id ‖ person)`, so two apps can't
tell they share a user. `scripts/app.mjs` plays an app for testing:

```sh
node scripts/app.mjs register discord:123 "My server" --cooldown 0
node scripts/app.mjs link discord:123 user:456     # prints the /bind link, waits
node scripts/app.mjs check discord:123 user:456
```

`ADMIN_TOKEN` (for registering apps) is a Worker secret, also kept in the
gitignored `.admin-token` for the script.

`NULLIFIER_KEY` is a Worker secret (`wrangler secret put NULLIFIER_KEY`).
Keep it out of the container and D1: with the key and the `bindings` table,
NRICs could be recovered by trying them all. Rotating it resets uniqueness:
every person looks new.

`GET /holders/<id>/badges` lists a holder's badges; the site's
`/cases/<id>` page reads it. `npm test` covers the rules.

Why a container and not a plain Worker: tlsn runs its protocol on a thread
pool, and Worker isolates can't spawn threads.

## Develop and deploy

Needs Docker running and a Workers Paid plan.

```sh
npm install
npm run dev      # builds the image, serves on http://localhost:8787
npm run deploy
```

Point the site at it with `VITE_VERIFIER_URL=https://<worker-host>` when
building. The extension must be 0.1.0.1500 or newer, whose prover matches the
tlsn version here (v0.1.0-alpha.15). When upgrading, bump
`TLSN_EXTENSION_REV` in the Dockerfile and `MIN_EXTENSION_VERSION` in
`src/lib/tlsn.ts` together.

Sessions live in the server's memory, so the Worker sends everything to a
single container instance (`max_instances: 1`).
