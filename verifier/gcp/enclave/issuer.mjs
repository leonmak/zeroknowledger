// Enclave issuer: runs inside a Google Confidential Space VM (Intel TDX) next
// to the TLSNotary verifier (MPC mode only). It is the only place the person
// key exists, and the only place person ids can be computed.
//
//  - The person key is generated here on first boot and stored only as a Cloud
//    KMS ciphertext in GCS. KMS decrypts it only for a workload whose attested
//    image digest is on the allowlist (Workload Identity Federation condition),
//    so the operator can't read it.
//  - Every answer to the Worker is signed with an Ed25519 key made at boot.
//  - The NRIC/mobile never leave the user's device. The browser proves in zero
//    knowledge (circuits/singpass_person) that H = Poseidon2(NRIC, mobile)
//    opens the two commitments, and encrypts the proof and H to an X25519 HPKE
//    key made at boot, so the Worker and Cloudflare only relay ciphertext.
//    Both public keys are bound into a Google attestation token (eat_nonce =
//    sha256(signing key || encryption key)), which the Worker and the browser
//    check against the published image digests.
//  - Person ids are only computed for commitments that this enclave's own
//    TLSNotary verifier authenticated (its webhook, below), once per proof: the
//    proof's public commitments must be exactly those. So nobody can use the
//    enclave to key guessed NRIC/mobile pairs.
//
// Ports (inside the container): 7049 on 127.0.0.1. cloudflared routes public
// /enclave/* here; /webhook is local only (the TLSNotary server's config.yaml).
import { createServer, request as httpRequest } from "node:http";
import {
  createHash,
  createHmac,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { Aes256Gcm, CipherSuite, HkdfSha256 } from "@hpke/core";
import { DhkemX25519HkdfSha256 } from "@hpke/dhkem-x25519";
import { parsePublicInputs, verify, warm } from "../../proof-verifier/lib.mjs";
import templates from "../../src/templates.json" with { type: "json" };

const env = (name, fallback) => {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`missing env ${name}`);
  return v;
};
const cfg = {
  port: Number(process.env.ENCLAVE_PORT ?? 7049),
  workerUrl: env("WORKER_URL"),
  wifAudience: env("WIF_AUDIENCE"), // //iam.googleapis.com/projects/<num>/locations/global/workloadIdentityPools/<pool>/providers/<provider>
  kmsKey: env("KMS_KEY"), // projects/<p>/locations/<l>/keyRings/<r>/cryptoKeys/<k>
  bucket: env("KEY_BUCKET"),
  attestationAudience: env("ATTESTATION_AUDIENCE", "zeroknowledger-registry"),
  allowedHosts: env("ALLOWED_HOSTS", "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean),
};
const PENDING_TTL_MS = 10 * 60_000;
// Test-only overrides (test/enclave-issuer.test.mjs). Not in the image's
// tee.launch_policy.allow_env_override list, so an operator can't set them.
const TEE_SOCKET =
  process.env.TEST_TEE_SOCKET ?? "/run/container_launcher/teeserver.sock";
const STS_TOKEN_FILE =
  process.env.TEST_STS_TOKEN_FILE ??
  "/run/container_launcher/attestation_verifier_claims_token";
const GOOGLE = {
  sts: process.env.TEST_STS_URL ?? "https://sts.googleapis.com",
  kms: process.env.TEST_KMS_URL ?? "https://cloudkms.googleapis.com",
  gcs: process.env.TEST_GCS_URL ?? "https://storage.googleapis.com",
};
const KEY_OBJECT = "person-key.kms";

// ---------- Google APIs, as the attested workload ----------

let sts = { token: "", expires: 0 };
async function accessToken() {
  if (Date.now() < sts.expires - 60_000) return sts.token;
  const res = await fetch(`${GOOGLE.sts}/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience: cfg.wifAudience,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      subject_token: readFileSync(STS_TOKEN_FILE, "utf8").trim(),
    }),
  });
  if (!res.ok) throw new Error(`sts ${res.status}: ${await res.text()}`);
  const body = await res.json();
  sts = {
    token: body.access_token,
    expires: Date.now() + body.expires_in * 1000,
  };
  return sts.token;
}

async function google(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${await accessToken()}`,
    },
  });
  return res;
}

async function kms(op, field, b64) {
  const res = await google(`${GOOGLE.kms}/v1/${cfg.kmsKey}:${op}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [field]: b64 }),
  });
  if (!res.ok) throw new Error(`kms ${op} ${res.status}: ${await res.text()}`);
  return res.json();
}

/** The sealed person key: created once, then only ever decrypted here. */
async function loadPersonKey() {
  const object = `${GOOGLE.gcs}/storage/v1/b/${cfg.bucket}/o/${encodeURIComponent(KEY_OBJECT)}?alt=media`;
  let res = await google(object);
  if (res.status === 404) {
    const { ciphertext } = await kms(
      "encrypt",
      "plaintext",
      randomBytes(32).toString("base64"),
    );
    // ifGenerationMatch=0: only if absent, so two enclaves booting together
    // can't overwrite each other's key.
    const put = await google(
      `${GOOGLE.gcs}/upload/storage/v1/b/${cfg.bucket}/o?uploadType=media&ifGenerationMatch=0&name=${encodeURIComponent(KEY_OBJECT)}`,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: ciphertext,
      },
    );
    if (!put.ok && put.status !== 412)
      throw new Error(`gcs put ${put.status}: ${await put.text()}`);
    console.log(
      put.ok
        ? "created and sealed a new person key"
        : "another enclave sealed the key first",
    );
    res = await google(object);
  }
  if (!res.ok) throw new Error(`gcs get ${res.status}: ${await res.text()}`);
  const { plaintext } = await kms(
    "decrypt",
    "ciphertext",
    (await res.text()).trim(),
  );
  return Buffer.from(plaintext, "base64");
}

// ---------- attestation + signing ----------

const signingKey = generateKeyPairSync("ed25519");
const publicKeyRaw = Buffer.from(
  signingKey.publicKey.export({ format: "jwk" }).x,
  "base64url",
);
const signBody = (body) =>
  sign(null, Buffer.from(body), signingKey.privateKey).toString("base64");

// HPKE (RFC 9180): DHKEM(X25519, HKDF-SHA256), HKDF-SHA256, AES-256-GCM. The
// browser seals {proof, publicInputs} with aad = the proof id (src/lib/enclave.ts).
const hpke = new CipherSuite({
  kem: new DhkemX25519HkdfSha256(),
  kdf: new HkdfSha256(),
  aead: new Aes256Gcm(),
});
const HPKE_INFO = new TextEncoder().encode("zeroknowledger person proof v1");
const encryptionKey = await hpke.kem.generateKeyPair();
const encryptionKeyRaw = Buffer.from(
  await hpke.kem.serializePublicKey(encryptionKey.publicKey),
);

/** Decrypts a sealed person proof; throws unless it was sealed for this proof id. */
async function openSealed(sealed, proofId) {
  const plaintext = await hpke.open(
    {
      recipientKey: encryptionKey,
      enc: Buffer.from(sealed.enc, "base64"),
      info: HPKE_INFO,
    },
    Buffer.from(sealed.ct, "base64"),
    new TextEncoder().encode(proofId),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

/** A Google attestation token whose eat_nonce binds both public keys. */
function attestationToken() {
  const payload = JSON.stringify({
    audience: cfg.attestationAudience,
    token_type: "OIDC",
    nonces: [
      createHash("sha256")
        .update(Buffer.concat([publicKeyRaw, encryptionKeyRaw]))
        .digest("hex"),
    ],
  });
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        socketPath: TEE_SOCKET,
        path: "/v1/token",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () =>
          res.statusCode === 200
            ? resolve(data.trim())
            : reject(new Error(`teeserver ${res.statusCode}: ${data}`)),
        );
      },
    );
    req.on("error", reject);
    req.end(payload);
  });
}

let attestation = { token: "", fetched: 0 };
async function currentAttestation() {
  // Tokens last about an hour; refresh well before.
  if (Date.now() - attestation.fetched > 30 * 60_000)
    attestation = { token: await attestationToken(), fetched: Date.now() };
  return attestation.token;
}

// ---------- the issuer ----------

const personKey = await loadPersonKey();
if (!(await warm())) throw new Error("proof verifier failed its warm-up check");
/** proof_id -> authenticated commitments and the identity rule that permits them. */
const pending = new Map();

function identityRule(payload) {
  const requestLine =
    typeof payload.transcript?.sent === "string"
      ? payload.transcript.sent.split("\r\n", 1)[0]
      : "";
  const template = templates.find(
    (t) =>
      t.host === payload.server_name &&
      requestLine === `${t.method} ${t.path} HTTP/1.1` &&
      t.issue_when?.person_proof,
  );
  return template
    ? {
        template: template.name,
        circuit: template.issue_when.person_proof.circuit,
        scope: template.issue_when.person_proof.scope,
      }
    : null;
}

async function forwardToWorker(path, body) {
  const res = await fetch(`${cfg.workerUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Enclave-Signature": signBody(body),
    },
    body,
  });
  if (!res.ok) console.log(`worker ${path} returned ${res.status}`);
}

/** Local webhook from the TLSNotary server after each verified TLS session. */
async function onWebhook(raw) {
  const payload = JSON.parse(raw);
  if (!cfg.allowedHosts.includes(payload.server_name)) return;
  const rule = identityRule(payload);
  const proofId = payload.session?.proof;
  const commitments = [
    ...new Set(
      (payload.results ?? [])
        .filter(
          (r) =>
            r.type === "RECV" &&
            typeof r.action === "object" &&
            r.action.kind === "HASH",
        )
        .map((r) => String(r.value).toLowerCase()),
    ),
  ];
  // The app this proof links an account in (the site puts it in the session
  // data; "" for a badge with no app). Taken from our own verifier's session,
  // not from the Worker, so person ids are always per app.
  const app =
    typeof payload.session?.app === "string" ? payload.session.app : "";
  if (proofId && commitments.length && rule) {
    pending.set(proofId, {
      commitments,
      app,
      ...rule,
      expires: Date.now() + PENDING_TTL_MS,
    });
  }
  // The Worker runs the template rules and stores its own pending record.
  await forwardToWorker("/enclave/webhook", raw);
}

/**
 * The Worker relays the browser's sealed person proof and asks for a person id;
 * answers are signed. Only this enclave can read the proof (and so H).
 */
async function onPerson(raw) {
  const { proof_id, circuit, scope, sealed } = JSON.parse(raw);
  const entry = pending.get(proof_id);
  pending.delete(proof_id); // one attempt per TLS session
  const fail = (reason) => ({ ok: false, proof_id, reason });
  if (!entry || Date.now() > entry.expires)
    return fail("no TLS session verified here for this proof");
  if (circuit !== entry.circuit || scope !== entry.scope)
    return fail("proof uses a different identity rule");
  if (typeof sealed?.enc !== "string" || typeof sealed?.ct !== "string")
    return fail("person proof must be sealed to the enclave");
  let proof, publicInputs;
  try {
    ({ proof, publicInputs } = await openSealed(sealed, proof_id));
  } catch {
    return fail(
      "couldn't open the sealed person proof (wrong key or proof id)",
    );
  }
  const inputs = parsePublicInputs(publicInputs, entry.commitments.length);
  if (!inputs) return fail("malformed public inputs");
  // The proof must be about exactly the commitments our verifier authenticated.
  if (
    [...entry.commitments].sort().join() !==
    [...inputs.commitments].sort().join()
  ) {
    return fail("proof is for different commitments");
  }
  if (!(await verify({ circuit, proof, publicInputs })))
    return fail("person proof did not verify");
  // Per app: the same person gets unrelated ids in different apps, so nothing
  // stored outside the enclave can link them.
  const person = createHmac("sha256", personKey)
    .update(`${scope}\n${entry.app}\n${inputs.h}`)
    .digest("hex");
  return {
    ok: true,
    proof_id,
    scope,
    app: entry.app,
    person,
    issued_at: Date.now(),
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [id, e] of pending) if (now > e.expires) pending.delete(id);
}, 60_000).unref();

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 256 * 1024) throw new Error("too large");
  }
  return body;
}

createServer(async (req, res) => {
  const send = (status, obj) => {
    const body = JSON.stringify(obj);
    res.writeHead(status, {
      "Content-Type": "application/json",
      "X-Enclave-Signature": signBody(body),
    });
    res.end(body);
  };
  try {
    if (req.method === "GET" && req.url === "/enclave/attestation") {
      // Public, and read by the browser before it seals its proof.
      res.setHeader("Access-Control-Allow-Origin", "*");
      return send(200, {
        public_key: publicKeyRaw.toString("base64"),
        encryption_key: encryptionKeyRaw.toString("base64"),
        token: await currentAttestation(),
      });
    }
    if (req.method === "POST" && req.url === "/enclave/person")
      return send(200, await onPerson(await readBody(req)));
    // Local only: cloudflared never routes /webhook here.
    if (req.method === "POST" && req.url === "/webhook") {
      await onWebhook(await readBody(req));
      return send(200, { ok: true });
    }
    send(404, { error: "not found" });
  } catch (e) {
    console.error(`${req.method} ${req.url} failed: ${e.message}`); // never logs bodies
    send(500, { error: "internal" });
  }
}).listen(cfg.port, "127.0.0.1", () =>
  console.log(`enclave issuer on 127.0.0.1:${cfg.port}`),
);
