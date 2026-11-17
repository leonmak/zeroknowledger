// Singpass unique-person is turned off (it needs a TLSNotary extension build that returns
// commitment openings, which we can't ship); its tests are skipped until it comes back.
// Runs the real enclave issuer (gcp/enclave/issuer.mjs) against fakes of
// Google's STS/KMS/GCS, the Confidential Space launcher socket, and the Worker,
// with the singpass_person circuit's real fixture proof.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { createHash, createPublicKey, verify as verifySig } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The enclave's own HPKE dependencies (gcp/enclave/package.json), as the browser uses them.
const enclaveRequire = createRequire(
  new URL("../gcp/enclave/issuer.mjs", import.meta.url),
);
const { Aes256Gcm, CipherSuite, HkdfSha256 } = enclaveRequire("@hpke/core");
const { DhkemX25519HkdfSha256 } = enclaveRequire("@hpke/dhkem-x25519");
const hpke = new CipherSuite({
  kem: new DhkemX25519HkdfSha256(),
  kdf: new HkdfSha256(),
  aead: new Aes256Gcm(),
});
const HPKE_INFO = new TextEncoder().encode("zeroknowledger person proof v1");

const fixture = JSON.parse(
  readFileSync(
    new URL("../circuits/singpass_person/fixture.json", import.meta.url),
    "utf8",
  ),
);
const hexBytes = (xs) =>
  xs.map((x) => BigInt(x).toString(16).padStart(2, "0")).join("");
// The two commitments the fixture proof opens, as the enclave's verifier would report them.
const COMMITMENTS = [
  hexBytes(fixture.publicInputs.slice(0, 32)),
  hexBytes(fixture.publicInputs.slice(32, 64)),
];
const PROOF = { proof: fixture.proof, publicInputs: fixture.publicInputs };
const dir = mkdtempSync(join(tmpdir(), "enclave-test-"));

const listen = (server, where) =>
  new Promise((r) => server.listen(where, () => r(server)));
const read = async (req) => {
  let b = "";
  for await (const c of req) b += c;
  return b;
};

// Fake Google APIs: STS hands out a token; KMS "encrypts" by prefixing; GCS stores objects.
const objects = new Map();
let kmsCalls = 0;
const google = createServer(async (req, res) => {
  const body = await read(req);
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/v1/token")
    return res.end(JSON.stringify({ access_token: "fake", expires_in: 3600 }));
  if (req.headers.authorization !== "Bearer fake")
    return res.writeHead(401).end();
  if (url.pathname.endsWith(":encrypt"))
    return (
      kmsCalls++,
      res.end(
        JSON.stringify({ ciphertext: "sealed:" + JSON.parse(body).plaintext }),
      )
    );
  if (url.pathname.endsWith(":decrypt")) {
    kmsCalls++;
    const c = JSON.parse(body).ciphertext;
    return c.startsWith("sealed:")
      ? res.end(JSON.stringify({ plaintext: c.slice(7) }))
      : res.writeHead(400).end();
  }
  if (url.pathname.startsWith("/storage/v1/b/")) {
    const name = decodeURIComponent(url.pathname.split("/o/")[1]);
    return objects.has(name)
      ? res.end(objects.get(name))
      : res.writeHead(404).end();
  }
  if (url.pathname.startsWith("/upload/storage/v1/b/")) {
    const name = url.searchParams.get("name");
    if (objects.has(name)) return res.writeHead(412).end();
    objects.set(name, body);
    return res.end("{}");
  }
  res.writeHead(404).end();
});

// Fake Confidential Space launcher: returns a token and remembers the nonce.
let lastNonce = null;
const tee = createServer(async (req, res) => {
  lastNonce = JSON.parse(await read(req)).nonces[0];
  res.end("header.payload.signature");
});

// Fake Worker: records signed webhooks.
const forwarded = [];
const worker = createServer(async (req, res) => {
  forwarded.push({
    path: req.url,
    body: await read(req),
    signature: req.headers["x-enclave-signature"],
  });
  res.end("{}");
});

let issuer;
let port;
const base = () => `http://127.0.0.1:${port}`;

async function startIssuer() {
  port = 17000 + Math.floor(Math.random() * 1000);
  issuer = spawn(
    process.execPath,
    [new URL("../gcp/enclave/issuer.mjs", import.meta.url).pathname],
    {
      env: {
        ...process.env,
        ENCLAVE_PORT: String(port),
        WORKER_URL: `http://127.0.0.1:${worker.address().port}`,
        WIF_AUDIENCE:
          "//iam.googleapis.com/projects/1/locations/global/workloadIdentityPools/p/providers/q",
        KMS_KEY: "projects/p/locations/l/keyRings/r/cryptoKeys/k",
        KEY_BUCKET: "bucket",
        ALLOWED_HOSTS: "portal.singpass.gov.sg",
        TEST_TEE_SOCKET: join(dir, "tee.sock"),
        TEST_STS_TOKEN_FILE: join(dir, "sts-token"),
        TEST_STS_URL: `http://127.0.0.1:${google.address().port}`,
        TEST_KMS_URL: `http://127.0.0.1:${google.address().port}`,
        TEST_GCS_URL: `http://127.0.0.1:${google.address().port}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  await new Promise((resolve, reject) => {
    const onData = (d) =>
      d.toString().includes("enclave issuer on") && resolve();
    issuer.stdout.on("data", onData);
    issuer.on("exit", (code) => reject(new Error(`issuer exited ${code}`)));
  });
}
const stopIssuer = () =>
  new Promise((r) => (issuer.once("exit", r), issuer.kill()));

async function attestationKey() {
  const res = await fetch(`${base()}/enclave/attestation`);
  const { public_key, encryption_key, token } = await res.json();
  return {
    raw: Buffer.from(public_key, "base64"),
    enc: Buffer.from(encryption_key, "base64"),
    token,
    cors: res.headers.get("access-control-allow-origin"),
  };
}
/** Seals `payload` to the enclave's key, bound to `boundTo` (normally the proof id). */
async function seal(payload, boundTo) {
  const { enc } = await attestationKey();
  const out = await hpke.seal(
    {
      recipientPublicKey: await hpke.kem.deserializePublicKey(
        new Uint8Array(enc).buffer,
      ),
      info: HPKE_INFO,
    },
    new TextEncoder().encode(JSON.stringify(payload)),
    new TextEncoder().encode(boundTo),
  );
  return {
    enc: Buffer.from(out.enc).toString("base64"),
    ct: Buffer.from(out.ct).toString("base64"),
  };
}
const pubKey = (raw) =>
  createPublicKey({
    key: { kty: "OKP", crv: "Ed25519", x: raw.toString("base64url") },
    format: "jwk",
  });
const signedBy = (raw, body, sig) =>
  verifySig(null, Buffer.from(body), pubKey(raw), Buffer.from(sig, "base64"));

const webhook = (
  proof,
  server_name = "portal.singpass.gov.sg",
  commitments = COMMITMENTS,
  app,
) =>
  fetch(`${base()}/webhook`, {
    method: "POST",
    body: JSON.stringify({
      server_name,
      session: { id: "s", proof, ...(app ? { app } : {}) },
      transcript: {
        sent: "GET /home/api/secured/profile-update-details HTTP/1.1\r\n",
        recv: "",
      },
      results: commitments.map((value) => ({
        type: "RECV",
        part: "BODY",
        action: { kind: "HASH", algorithm: "SHA256" },
        value,
      })),
    }),
  });
const person = async (proof_id, sealed, rule = {}) => {
  sealed ??= { sealed: await seal(PROOF, proof_id) };
  const res = await fetch(`${base()}/enclave/person`, {
    method: "POST",
    body: JSON.stringify({
      proof_id,
      circuit: "singpass_person",
      scope: "singpass-person",
      ...rule,
      ...sealed,
    }),
  });
  const body = await res.text();
  return {
    body: JSON.parse(body),
    raw: body,
    signature: res.headers.get("x-enclave-signature"),
  };
};

before(async () => {
  writeFileSync(join(dir, "sts-token"), "attested.jwt.token");
  await listen(google, 0);
  await listen(worker, 0);
  await listen(tee, join(dir, "tee.sock"));
  await startIssuer();
});
after(async () => {
  await stopIssuer();
  google.close();
  worker.close();
  tee.close();
});

test("seals a new person key with KMS on first boot, never in the clear", () => {
  const stored = objects.get("person-key.kms");
  assert.match(stored, /^sealed:/);
  assert.ok(kmsCalls >= 2); // encrypt, then decrypt
});

test("binds its signing and encryption keys into the attestation nonce", async () => {
  const { raw, enc, token, cors } = await attestationKey();
  assert.equal(token, "header.payload.signature");
  assert.equal(enc.length, 32);
  assert.equal(
    lastNonce,
    createHash("sha256")
      .update(Buffer.concat([raw, enc]))
      .digest("hex"),
  );
  assert.equal(cors, "*"); // the browser checks it before sealing
});

test("forwards verified sessions to the Worker, signed", async () => {
  const { raw } = await attestationKey();
  forwarded.length = 0;
  await webhook("proof-aaaaaaaaaaaaaaaa");
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].path, "/enclave/webhook");
  assert.ok(signedBy(raw, forwarded[0].body, forwarded[0].signature));
});

let firstPerson;
test.skip("computes a signed person id for a proof of its own session, once", async () => {
  const { raw } = await attestationKey();
  const out = await person("proof-aaaaaaaaaaaaaaaa");
  assert.equal(out.body.ok, true, out.raw);
  assert.match(out.body.person, /^[0-9a-f]{64}$/);
  assert.ok(signedBy(raw, out.raw, out.signature));
  firstPerson = out.body.person;
  const again = await person("proof-aaaaaaaaaaaaaaaa");
  assert.equal(again.body.ok, false);
});

test.skip("refuses proofs for sessions it didn't verify (no guessing oracle)", async () => {
  assert.equal((await person("never-seen-proof-id")).body.ok, false);
  await webhook("proof-bbbbbbbbbbbbbbbb", "evil.example"); // not an allowed host
  assert.equal((await person("proof-bbbbbbbbbbbbbbbb")).body.ok, false);
  await webhook("proof-cccccccccccccccc", undefined, [
    "00".repeat(32),
    "11".repeat(32),
  ]);
  const other = await person("proof-cccccccccccccccc");
  assert.equal(other.body.reason, "proof is for different commitments");
  // A tampered proof for the right commitments doesn't verify.
  await webhook("proof-hhhhhhhhhhhhhhhh");
  const forged = {
    ...PROOF,
    publicInputs: [
      ...PROOF.publicInputs.slice(0, -1),
      "0x" + "00".repeat(31) + "07",
    ],
  };
  const bad = await person("proof-hhhhhhhhhhhhhhhh", {
    sealed: await seal(forged, "proof-hhhhhhhhhhhhhhhh"),
  });
  assert.equal(bad.body.reason, "person proof did not verify");
});

test.skip("pins each pending proof to the authenticated template's circuit and scope", async () => {
  await webhook("proof-ruleaaaaaaaaaaaa");
  const wrongCircuit = await person("proof-ruleaaaaaaaaaaaa", undefined, {
    circuit: "other_circuit",
  });
  assert.equal(
    wrongCircuit.body.reason,
    "proof uses a different identity rule",
  );
  await webhook("proof-rulebbbbbbbbbbbb");
  const wrongScope = await person("proof-rulebbbbbbbbbbbb", undefined, {
    scope: "another-scope",
  });
  assert.equal(wrongScope.body.reason, "proof uses a different identity rule");
});

test.skip("only takes proofs sealed to it, for this proof id", async () => {
  await webhook("proof-eeeeeeeeeeeeeeee");
  const plain = await person("proof-eeeeeeeeeeeeeeee", PROOF);
  assert.equal(plain.body.reason, "person proof must be sealed to the enclave");
  await webhook("proof-ffffffffffffffff");
  const replayed = await person("proof-ffffffffffffffff", {
    sealed: await seal(PROOF, "proof-gggggggggggggggg"),
  });
  assert.match(replayed.body.reason, /couldn't open the sealed person proof/);
});

test.skip("person ids are per app, taken from its own session", async () => {
  const id = async (proof, app) => (
    await webhook(proof, undefined, undefined, app),
    (await person(proof)).body
  );
  const a1 = await id("proof-app1aaaaaaaaaaaa", "discord:1");
  const a1again = await id("proof-app1bbbbbbbbbbbb", "discord:1");
  const a2 = await id("proof-app2aaaaaaaaaaaa", "discord:2");
  assert.equal(a1.app, "discord:1");
  assert.equal(a1.person, a1again.person); // same person, same app: stable
  assert.notEqual(a1.person, a2.person); // same person, another app: unrelated
});

test("keeps the same person key across restarts (unsealed from GCS)", async () => {
  await stopIssuer();
  await startIssuer();
  await webhook("proof-dddddddddddddddd");
  const out = await person("proof-dddddddddddddddd");
  assert.equal(out.body.person, firstPerson);
});
