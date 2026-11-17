// The enclave's standupfor.xyz mailbox endpoint (gcp/enclave/issuer.mjs, mailbox.mjs): runs the
// real issuer against fakes of Google's STS/KMS/GCS, the Confidential Space launcher socket and
// DNS-over-HTTPS, with real zksender proofs (test/fixtures/mailbox.json, written by
// zkalumni/scripts/make-enclave-fixtures.mjs).
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { createPublicKey, verify as verifySig } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inputsHash, NULLIFIER_INDEX } from "../gcp/enclave/mailbox.mjs";

const enclaveRequire = createRequire(new URL("../gcp/enclave/issuer.mjs", import.meta.url));
const { Aes256Gcm, CipherSuite, HkdfSha256 } = enclaveRequire("@hpke/core");
const { DhkemX25519HkdfSha256 } = enclaveRequire("@hpke/dhkem-x25519");
const hpke = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
const MAILBOX_INFO = new TextEncoder().encode("standupfor mailbox proof v1");
const PERSON_INFO = new TextEncoder().encode("zeroknowledger person proof v1");

const fx = JSON.parse(readFileSync(new URL("./fixtures/mailbox.json", import.meta.url), "utf8"));
const dir = mkdtempSync(join(tmpdir(), "enclave-mailbox-"));
const listen = (server) => new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
const read = async (req) => { let b = ""; for await (const c of req) b += c; return b; };

// Fake Google: STS token; KMS "encrypts" by prefixing with the key name; GCS stores objects.
const objects = new Map();
const google = createServer(async (req, res) => {
  const body = await read(req);
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/v1/token") return res.end(JSON.stringify({ access_token: "fake", expires_in: 3600 }));
  const key = url.pathname.split("/cryptoKeys/")[1]?.split(":")[0];
  if (url.pathname.endsWith(":encrypt")) return res.end(JSON.stringify({ ciphertext: `sealed-by-${key}:` + JSON.parse(body).plaintext }));
  if (url.pathname.endsWith(":decrypt")) {
    const c = JSON.parse(body).ciphertext;
    return c.startsWith(`sealed-by-${key}:`) ? res.end(JSON.stringify({ plaintext: c.slice(`sealed-by-${key}:`.length) })) : res.writeHead(400).end();
  }
  if (url.pathname.startsWith("/storage/v1/b/")) {
    const name = decodeURIComponent(url.pathname.split("/o/")[1]);
    return objects.has(name) ? res.end(objects.get(name)) : res.writeHead(404).end();
  }
  if (url.pathname.startsWith("/upload/storage/v1/b/")) {
    const name = url.searchParams.get("name");
    if (objects.has(name)) return res.writeHead(412).end();
    objects.set(name, body);
    return res.end("{}");
  }
  res.writeHead(404).end();
});
const tee = createServer(async (req, res) => { await read(req); res.end("header.payload.signature"); });
// Fake DNS-over-HTTPS: the fixture's key at enclave-test._domainkey.corp.test; anything else is absent.
let dnsKey = fx.p;
const doh = createServer((req, res) => {
  const name = new URL(req.url, "http://x").searchParams.get("name");
  const answer = name === `${fx.selector}._domainkey.${fx.domain}`
    ? [{ type: 16, data: `"v=DKIM1; k=rsa; " "p=${dnsKey}"` }] : [];
  res.end(JSON.stringify({ Status: answer.length ? 0 : 3, Answer: answer }));
});

let issuer, port;
const base = () => `http://127.0.0.1:${port}`;
async function startIssuer(extra = {}) {
  port = 18000 + Math.floor(Math.random() * 1000);
  writeFileSync(join(dir, "sts-token"), "attested");
  issuer = spawn(process.execPath, [new URL("../gcp/enclave/issuer.mjs", import.meta.url).pathname], {
    env: {
      ...process.env,
      ENCLAVE_PORT: String(port),
      WORKER_URL: "http://127.0.0.1:1",
      WIF_AUDIENCE: "//iam.googleapis.com/projects/1/locations/global/workloadIdentityPools/p/providers/q",
      KMS_KEY: "projects/p/locations/l/keyRings/r/cryptoKeys/person-key",
      MAILBOX_KMS_KEY: "projects/p/locations/l/keyRings/r/cryptoKeys/mailbox-key",
      KEY_BUCKET: "bucket",
      ALLOWED_HOSTS: "portal.singpass.gov.sg",
      TEST_TEE_SOCKET: join(dir, "tee.sock"),
      TEST_STS_TOKEN_FILE: join(dir, "sts-token"),
      TEST_STS_URL: `http://127.0.0.1:${google.address().port}`,
      TEST_KMS_URL: `http://127.0.0.1:${google.address().port}`,
      TEST_GCS_URL: `http://127.0.0.1:${google.address().port}`,
      TEST_DOH_URL: `http://127.0.0.1:${doh.address().port}/dns-query`,
      ...extra,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  await new Promise((resolve, reject) => {
    issuer.stdout.on("data", (d) => { log += d; if (log.includes("enclave issuer on")) resolve(); });
    issuer.stderr.on("data", (d) => (log += d));
    issuer.on("exit", (code) => reject(new Error(`issuer exited ${code}: ${log}`)));
  });
}
const stopIssuer = () => new Promise((r) => (issuer.once("exit", r), issuer.kill()));

async function attestation() {
  const { public_key, encryption_key } = await (await fetch(`${base()}/enclave/attestation`)).json();
  return { sign: Buffer.from(public_key, "base64"), enc: Buffer.from(encryption_key, "base64") };
}
async function seal(payload, boundTo, info = MAILBOX_INFO) {
  const { enc } = await attestation();
  const out = await hpke.seal(
    { recipientPublicKey: await hpke.kem.deserializePublicKey(new Uint8Array(enc).buffer), info },
    new TextEncoder().encode(JSON.stringify(payload)),
    new TextEncoder().encode(boundTo),
  );
  return { enc: Buffer.from(out.enc).toString("base64"), ct: Buffer.from(out.ct).toString("base64") };
}
async function ask(e, { sealFor = e.code, payload = { proof: e.proof, publicInputs: e.publicInputs }, info, ...over } = {}) {
  const res = await fetch(`${base()}/enclave/mailbox`, {
    method: "POST",
    body: JSON.stringify({ code: e.code, commitment: e.commitment, domain: e.domain, selector: fx.selector, sealed: await seal(payload, sealFor, info), ...over }),
  });
  const body = await res.text();
  const { sign } = await attestation();
  const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: sign.toString("base64url") }, format: "jwk" });
  assert.ok(verifySig(null, Buffer.from(body), key, Buffer.from(res.headers.get("x-enclave-signature"), "base64")), "every answer is signed");
  return JSON.parse(body);
}

before(async () => {
  await Promise.all([listen(google), listen(doh)]);
  await new Promise((r) => tee.listen(join(dir, "tee.sock"), r));
  await startIssuer();
});
after(async () => {
  await stopIssuer();
  google.close(); doh.close(); tee.close();
});

test("a sealed enrollment proof gets a fingerprint: the same mailbox gets the same one, another mailbox doesn't", async () => {
  const a = await ask(fx.jane1), b = await ask(fx.jane2), c = await ask(fx.john);
  assert.equal(a.ok, true, a.reason);
  assert.match(a.fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(b.fingerprint, a.fingerprint, "Jane.Doe@ and jane.doe@ are one mailbox");
  assert.notEqual(c.fingerprint, a.fingerprint);
  assert.deepEqual([a.code, a.commitment, a.domain], [fx.jane1.code, fx.jane1.commitment, "corp.test"]);
  // The fingerprint isn't the nullifier, and the Worker can check what was verified without it.
  assert.notEqual(a.fingerprint, BigInt(fx.jane1.publicInputs[NULLIFIER_INDEX]).toString(16));
  const blanked = fx.jane1.publicInputs.map((x, i) => (i === NULLIFIER_INDEX ? "0x" + "0".repeat(64) : x));
  assert.equal(a.inputs_hash, inputsHash(blanked));
});

test("the mailbox key is separate from the person key, and both stay sealed", async () => {
  assert.ok(objects.get("mailbox-key.kms").startsWith("sealed-by-mailbox-key:"));
  assert.ok(objects.get("person-key.kms").startsWith("sealed-by-person-key:"));
  assert.notEqual(objects.get("mailbox-key.kms").split(":")[1], objects.get("person-key.kms").split(":")[1]);
  // Restarting reuses the sealed key: fingerprints are stable.
  const before = (await ask(fx.jane1)).fingerprint;
  await stopIssuer();
  await startIssuer();
  assert.equal((await ask(fx.jane1)).fingerprint, before);
});

test("not a guessing oracle: only fresh enrollment emails, signed with the domain's real key", async () => {
  // A valid proof over an email the prover merely holds (a code subject, not this enrollment's words).
  assert.match((await ask(fx.notEnrollment)).reason, /isn't over this enrollment's email/);
  // The right email, claimed for a different enrollment code or commitment.
  assert.match((await ask({ ...fx.jane1, code: "5".repeat(32) }, { sealFor: "5".repeat(32) })).reason, /isn't over this enrollment's email/);
  assert.match((await ask({ ...fx.jane1, commitment: "42" })).reason, /isn't over this enrollment's email/);
  // Signed with a key that isn't the domain's (DNS now publishes a different one).
  dnsKey = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuuS2J8o" + fx.p.slice(51);
  try {
    const r = await ask(fx.jane1);
    assert.equal(r.ok, false);
    assert.match(r.reason, /DKIM key/);
  } finally {
    dnsKey = fx.p;
  }
  assert.match((await ask(fx.jane1, { selector: "missing" })).reason, /couldn't fetch the DKIM key/);
});

test("sealing, binding and input checks", async () => {
  assert.match((await ask(fx.jane1, { sealFor: "6".repeat(32) })).reason, /couldn't open/, "sealed for another code");
  assert.match((await ask(fx.jane1, { info: PERSON_INFO })).reason, /couldn't open/, "sealed for the person endpoint");
  assert.match((await ask(fx.jane1, { domain: "other.test" })).reason, /different domain/);
  const tampered = { ...fx.jane1, proof: Buffer.from(Buffer.from(fx.jane1.proof, "base64").map((b, i) => (i === 100 ? b ^ 1 : b))).toString("base64") };
  assert.match((await ask(tampered)).reason, /did not verify/);
  for (const bad of [{ code: "x" }, { commitment: "0" }, { selector: "a b" }, { domain: "not a domain" }]) {
    assert.equal((await ask(fx.jane1, bad)).ok, false, JSON.stringify(bad));
  }
  const res = await fetch(`${base()}/enclave/mailbox`, { method: "POST", body: JSON.stringify({ code: fx.jane1.code, commitment: fx.jane1.commitment, selector: fx.selector, sealed: "plain" }) });
  assert.match((await res.json()).reason, /must be sealed/);
});

test("without MAILBOX_KMS_KEY the endpoint is off", async () => {
  await stopIssuer();
  await startIssuer({ MAILBOX_KMS_KEY: "" });
  try {
    assert.match((await ask(fx.jane1)).reason, /aren't enabled/);
  } finally {
    await stopIssuer();
    await startIssuer();
  }
});
