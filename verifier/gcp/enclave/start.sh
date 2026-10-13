#!/bin/bash
# Inside the Confidential Space container: TLSNotary verifier (MPC only), the
# enclave issuer, and the Cloudflare Tunnel. If any exits, the container exits
# and Confidential Space restarts it (tee-restart-policy).
set -u
export MPC_ONLY=1 PORT=7047

# The VM clock isn't synced (boots ~5 s off) and MPC-TLS allows 5 s, so run
# the verifier on Google's time: clock.mjs writes the offset, libfaketime
# applies it (re-read every minute), and it's re-measured every 10 minutes.
export FAKETIME_TIMESTAMP_FILE=/tmp/faketime
echo "+0" > "$FAKETIME_TIMESTAMP_FILE"
node /app/gcp/enclave/clock.mjs
(while sleep 600; do node /app/gcp/enclave/clock.mjs; done) &
FAKETIME_CACHE_DURATION=60 FAKETIME_DONT_FAKE_MONOTONIC=1 \
  LD_PRELOAD=/usr/lib/x86_64-linux-gnu/faketime/libfaketime.so.1 /app/tlsn-verifier-server &
verifier=$!

node /app/gcp/enclave/issuer.mjs &
issuer=$!
echo "$TUNNEL_CREDENTIALS" | base64 -d > /tmp/tunnel.json
cloudflared tunnel --no-autoupdate --config /app/gcp/enclave/cloudflared.yml \
  --credentials-file /tmp/tunnel.json run "$TUNNEL_ID" &
tunnel=$!
wait -n "$verifier" "$issuer" "$tunnel"
exit 1
