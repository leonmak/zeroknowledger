# Running zeroknowledger locally

Three pieces:

| Piece | Where | Runs on |
| --- | --- | --- |
| Site (Vite + React Router) | repo root | your machine (`npx vite`) |
| Registry / API Worker (badges, apps, OpenCerts, TLSNotary verifier container for proxy-mode badges) | `verifier/` | Cloudflare (production), or `wrangler dev` |
| Enclave (TLSNotary verifier in MPC mode + person key) for the unique-person badge | `verifier/gcp/` | Google Confidential Space, started on demand |

The site picks its backend at build time (`src/lib/config.ts`):

- `VITE_VERIFIER_URL`: the TLSNotary verifier the extension proves against.
- `VITE_REGISTRY_URL`: the registry Worker (defaults to `VITE_VERIFIER_URL`).
- `VITE_TLSN_MODE`: `Proxy` (Cloudflare container) or `Mpc` (the enclave).

You also need Chrome with the TLSNotary extension build that returns
commitment openings: load `verifier/.extension-build` unpacked
(`chrome://extensions` → Developer mode → Load unpacked).

## Testing the Singpass badge (Verified Person - SG)

Nothing runs locally except the site: it uses the enclave and the production
registry Worker, because the enclave reports verified sessions to the
production Worker (its `WORKER_URL`).

```sh
cd ~/projects/zeroknowledger
VITE_VERIFIER_URL=https://enclave.zeroknowledger.com \
VITE_REGISTRY_URL=https://api.zeroknowledger.com \
VITE_TLSN_MODE=Mpc npx vite --port 5179 --strictPort
```

Check it's all reachable:

```sh
curl -s -o /dev/null -w "site %{http_code}\n" http://localhost:5179/badges
curl -s -o /dev/null -w "registry %{http_code}\n" \
  https://api.zeroknowledger.com/holders/00000000000000000000000000000000/badges
gcloud compute instances describe zk-enclave --project zeroknowledger \
  --zone asia-southeast1-b --format='value(status)'   # TERMINATED is normal
```

The enclave VM is usually stopped. You don't start it: clicking Prove calls
`POST /enclave/wake`, the Worker starts the VM (about 70 s), and a per-minute
cron stops it again once no proof is queued (`verifier/src/enclaveControl.ts`).

Then:

1. Open <http://localhost:5179/badges> and click **Prove** on "Verified Person - SG".
   The button shows "Starting the secure enclave…" while the VM boots.
2. In the Singpass window, log in and complete the "Manage your Singpass
   account" step-up login, until your profile is on screen.
3. Click the floating **Verify** button, then **Generate Proof** once.

If it fails, the enclave's logs are on its serial console:

```sh
gcloud compute instances get-serial-port-output zk-enclave --project zeroknowledger \
  --zone asia-southeast1-b | tail -50
```

and the Worker's with `cd verifier && npx wrangler tail`. Issuance attempts and
their reasons are in D1's `attempts` table.

## Running the Worker locally (proxy-mode badges)

For the other badges (GitHub, Strava, …) the whole backend can run locally.
`wrangler dev` builds the verifier container, so Docker Desktop must be running.

```sh
cd ~/projects/zeroknowledger/verifier
npm install
cat > .dev.vars <<'EOF'
NULLIFIER_KEY=local-dev-key
ADMIN_TOKEN=local-admin-token
EOF
npm run dev        # templates + local D1 migrations + wrangler dev on http://localhost:8787
```

If the image build hangs on the Docker credential helper (macOS Keychain), use
a Keychain-free Docker config:

```sh
mkdir -p /tmp/dockercfg && echo '{"currentContext":"desktop-linux"}' > /tmp/dockercfg/config.json
ln -sf ~/.docker/contexts ~/.docker/buildx ~/.docker/cli-plugins /tmp/dockercfg/
DOCKER_CONFIG=/tmp/dockercfg npm run dev
```

Then, from the repo root:

```sh
VITE_VERIFIER_URL=http://localhost:8787 npx vite
```

## Other commands

In `verifier/`:

```sh
npm test           # all verifier tests; no Docker or network needed
npm run typecheck
npm run deploy     # production: D1 migrations + Worker + container (same Docker caveat)
```

Enclave (see `verifier/gcp/README.md`): `gcp/deploy.sh build`, `allow`, `vm`,
`control`. Registry of methods: `npm run registry:check` at the repo root.
