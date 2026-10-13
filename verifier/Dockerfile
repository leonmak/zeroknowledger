# syntax=docker/dockerfile:1.7
# TLSNotary verifier server (tlsn-extension/servers/verifier) at a pinned
# commit, with verifier-server.patch applied. Its tlsn version must match the
# prover in users' TLSNotary extension (v0.1.0-alpha.15 here).
#
# Cloudflare Containers run linux/amd64. The builder runs on the build host's
# native arch and cross-compiles, so building on Apple Silicon doesn't need
# slow amd64 emulation.

FROM --platform=$BUILDPLATFORM rust:1.95-bookworm AS builder

ARG TLSN_EXTENSION_REV=d44623434d04ad00d7b1f8da9712cbc10cd0e99c
ARG TARGET=x86_64-unknown-linux-gnu

RUN set -eux; \
    if [ "$(dpkg --print-architecture)" != "amd64" ]; then \
      dpkg --add-architecture amd64; \
      apt-get update; \
      apt-get install -y --no-install-recommends gcc-x86-64-linux-gnu libc6-dev-amd64-cross libssl-dev:amd64; \
    else \
      apt-get update; \
      apt-get install -y --no-install-recommends libssl-dev; \
    fi; \
    apt-get install -y --no-install-recommends pkg-config git; \
    rm -rf /var/lib/apt/lists/*; \
    rustup target add "$TARGET"

WORKDIR /src
RUN git init -q && \
    git remote add origin https://github.com/tlsnotary/tlsn-extension.git && \
    git fetch -q --depth 1 origin "$TLSN_EXTENSION_REV" && \
    git checkout -q FETCH_HEAD

COPY verifier-server.patch .
RUN git apply verifier-server.patch

WORKDIR /src/servers
ENV CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=x86_64-linux-gnu-gcc \
    CC_x86_64_unknown_linux_gnu=x86_64-linux-gnu-gcc \
    PKG_CONFIG_ALLOW_CROSS=1 \
    PKG_CONFIG_PATH=/usr/lib/x86_64-linux-gnu/pkgconfig
RUN if [ "$(dpkg --print-architecture)" = "amd64" ]; then \
      unset CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER CC_x86_64_unknown_linux_gnu; \
    fi; \
    cargo build --release --locked --target "$TARGET" --bin tlsn-verifier-server && \
    cp "target/$TARGET/release/tlsn-verifier-server" /tlsn-verifier-server

# Shared runtime: the verifier binary.
FROM --platform=linux/amd64 node:22-bookworm-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libssl3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /tlsn-verifier-server /app/tlsn-verifier-server


# Google Confidential Space (Intel TDX) enclave: `docker build --target gcp`.
# MPC-only verifier + enclave issuer holding the sealed person key + a
# Cloudflare Tunnel for ingress. See gcp/README.md.
FROM runtime AS gcp
ARG CLOUDFLARED_VERSION=2026.9.3
ARG CLOUDFLARED_SHA256=77e26d8d900e0b8469f416239d14b5f296525fdf79fee6f511ef55609e3fbac2
ADD --checksum=sha256:${CLOUDFLARED_SHA256} \
    https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-amd64 /usr/local/bin/cloudflared
RUN chmod +x /usr/local/bin/cloudflared
# The VM's clock isn't synced; the verifier runs under libfaketime, corrected
# by gcp/enclave/clock.mjs (see start.sh).
RUN apt-get update && apt-get install -y --no-install-recommends libfaketime && rm -rf /var/lib/apt/lists/*
# Zero-knowledge proof verification for person proofs (proof-verifier/lib.mjs),
# with every circuit's verification key and warm-up proof (circuits/<name>/).
COPY proof-verifier/package.json proof-verifier/package-lock.json /app/proof-verifier/
RUN cd /app/proof-verifier && npm ci --omit=dev
COPY proof-verifier/lib.mjs proof-verifier/warm.mjs /app/proof-verifier/
COPY circuits /app/circuits
# Fetches and caches bb.js's CRS now, not on the enclave's first proof.
RUN node /app/proof-verifier/warm.mjs
# The issuer's own dependencies (HPKE, for person proofs sealed to the enclave).
COPY gcp/enclave/package.json gcp/enclave/package-lock.json /app/gcp/enclave/
RUN cd /app/gcp/enclave && npm ci --omit=dev
COPY gcp/enclave /app/gcp/enclave
COPY src/templates.json /app/src/templates.json
COPY gcp/enclave/config.yaml /app/config.yaml
# Only these env vars may be set by the operator (VM metadata tee-env-*);
# none of them can reveal the sealed key.
LABEL "tee.launch_policy.allow_env_override"="WORKER_URL,WIF_AUDIENCE,KMS_KEY,KEY_BUCKET,ALLOWED_HOSTS,ATTESTATION_AUDIENCE,TUNNEL_ID,TUNNEL_CREDENTIALS"
LABEL "tee.launch_policy.log_redirect"="always"
CMD ["/app/gcp/enclave/start.sh"]

# Cloudflare Containers (the default, last stage).
FROM runtime AS cloudflare
COPY config.yaml /app/config.yaml

COPY start.sh /app/start.sh
ENV PORT=7047
EXPOSE 7047
CMD ["/app/start.sh"]
