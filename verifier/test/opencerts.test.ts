import assert from "node:assert/strict";
import { test } from "node:test";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { fieldHash, handleOpenCerts, OPENCERTS_METHODS, type Chain, type Disclosure } from "../src/opencerts.ts";
import { listBadges } from "../src/issuer.ts";
import { testDb } from "./d1.ts";

const METHOD = "education/nus-graduate";
const STORE = OPENCERTS_METHODS[METHOD].config.issuer.certificate_store;
const HOLDER_A = "a".repeat(64);
const HOLDER_B = "b".repeat(64);
const keccakHex = (b: Uint8Array) => bytesToHex(keccak_256(b));

let saltCounter = 0;
const salted = (v: string) => `${(saltCounter++).toString(16).padStart(8, "0")}-0000-4000-8000-000000000000:string:${v}`;

/** A flattened certificate as an issuer would sign it: salted fields, in a batch of two. */
function issue(fields: Record<string, string>) {
  const data = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, salted(v)]));
  const targetOf = (d: Record<string, string>) =>
    bytesToHex(keccak_256(new TextEncoder().encode(JSON.stringify(Object.entries(d).map(([k, v]) => fieldHash(k, v)).sort()))));
  const targetHash = targetOf(data);
  const sibling = targetOf({ "recipient.name": salted("Someone Else") });
  const merkleRoot = keccakHex(hexToBytes([targetHash, sibling].sort().join("")));
  return { data, signature: { type: "SHA3MerkleProof", targetHash, proof: [sibling], merkleRoot } };
}

/** What the browser sends: reveal `keep`, hash everything else. */
function disclose(cert: ReturnType<typeof issue>, keep: string[]): Disclosure {
  const revealed: Record<string, string> = {};
  const obfuscated: string[] = [];
  for (const [k, v] of Object.entries(cert.data)) keep.includes(k) ? (revealed[k] = v) : obfuscated.push(fieldHash(k, v));
  return { schema: "opencerts/v1.5", revealed, obfuscated, signature: structuredClone(cert.signature) };
}

const NUS_FIELDS = {
  "issuers.0.name": "National University of Singapore",
  "issuers.0.certificateStore": STORE,
  "recipient.name": "Tan Ah Kow",
  "recipient.studentId": "A0000000X",
  "additionalData.degreeScroll.0.degreeTitle": "Bachelor of Computing",
  "transcript.0.grade": "A",
};
const KEEP = ["issuers.0.certificateStore", "additionalData.degreeScroll.0.degreeTitle"];

function chain(state: { issued?: boolean; revoked?: string[]; fail?: boolean } = {}): Chain & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async isIssued(store, root) {
      calls.push(`isIssued ${store} ${root}`);
      if (state.fail) throw new Error("Ethereum lookup failed: down");
      return state.issued ?? true;
    },
    async isRevoked(_store, hash) {
      calls.push(`isRevoked ${hash}`);
      return state.revoked?.includes(hash) ?? false;
    },
  };
}

function setup() {
  const env = { DB: testDb(), NULLIFIER_KEY: "test-nullifier-key" };
  const prove = (holder: string, disclosure: Disclosure, c: Chain = chain()) =>
    handleOpenCerts(
      new Request(`https://api.test/opencerts/${METHOD}`, { method: "POST", body: JSON.stringify({ holder, disclosure }) }),
      env,
      c,
    );
  return { env, prove };
}

test("a valid disclosure issues the badge and stores no certificate data", async () => {
  const { env, prove } = setup();
  const cert = issue(NUS_FIELDS);
  const res = await prove(HOLDER_A, disclose(cert, KEEP));
  const body = (await res.json()) as { ok: boolean; holder: string };
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.equal(body.ok, true);

  const { badges } = (await (await listBadges(body.holder, env as never)).json()) as { badges: { template: string; badge: { label: string } }[] };
  assert.deepEqual(badges.map((b) => [b.template, b.badge.label]), [[METHOD, "NUS graduate"]]);

  const stored = JSON.stringify((env.DB as unknown as { dump: () => unknown }).dump());
  for (const secret of ["Bachelor of Computing", "Tan Ah Kow", cert.signature.targetHash]) assert.ok(!stored.includes(secret), `stored ${secret}`);
});

test("one holder per certificate; the same holder can re-prove", async () => {
  const { prove } = setup();
  const cert = issue(NUS_FIELDS);
  assert.equal((await prove(HOLDER_A, disclose(cert, KEEP))).status, 200);
  assert.equal((await prove(HOLDER_A, disclose(cert, KEEP))).status, 200);
  const res = await prove(HOLDER_B, disclose(cert, KEEP));
  assert.equal(res.status, 409);
  assert.match(((await res.json()) as { reason: string }).reason, /already earned/);
});

test("changing a revealed value breaks the targetHash", async () => {
  const { prove } = setup();
  const d = disclose(issue(NUS_FIELDS), KEEP);
  d.revealed["additionalData.degreeScroll.0.degreeTitle"] = (d.revealed["additionalData.degreeScroll.0.degreeTitle"] as string).replace(/[^:]*$/, "Doctor of Fakery");
  const res = await prove(HOLDER_A, d);
  assert.equal(res.status, 400);
  assert.match(((await res.json()) as { reason: string }).reason, /targetHash/);
});

test("only the method's fields may be revealed, and the required ones must be", async () => {
  const { prove } = setup();
  const cert = issue(NUS_FIELDS);
  const extra = await prove(HOLDER_A, disclose(cert, [...KEEP, "recipient.name"]));
  assert.equal(extra.status, 400);
  assert.match(((await extra.json()) as { reason: string }).reason, /recipient\.name/);
  const missing = await prove(HOLDER_A, disclose(cert, ["issuers.0.certificateStore"]));
  assert.equal(missing.status, 400);
  assert.match(((await missing.json()) as { reason: string }).reason, /degreeTitle/);
});

test("a certificate from another store is rejected even if that store issued it", async () => {
  const { prove } = setup();
  const other = issue({ ...NUS_FIELDS, "issuers.0.certificateStore": "0x0000000000000000000000000000000000000001" });
  const res = await prove(HOLDER_A, disclose(other, KEEP));
  assert.equal(res.status, 400);
  assert.match(((await res.json()) as { reason: string }).reason, /certificate store/);
});

test("the batch must be issued in the pinned store, and nothing revoked", async () => {
  const { prove } = setup();
  const cert = issue(NUS_FIELDS);
  const c = chain();
  await prove(HOLDER_A, disclose(cert, KEEP), c);
  assert.ok(c.calls.includes(`isIssued ${STORE} ${cert.signature.merkleRoot}`), "asks the pinned store about the root");

  assert.equal((await prove(HOLDER_B, disclose(issue(NUS_FIELDS), KEEP), chain({ issued: false }))).status, 400);
  const revokedCert = issue(NUS_FIELDS);
  const revoked = await prove(HOLDER_B, disclose(revokedCert, KEEP), chain({ revoked: [revokedCert.signature.targetHash] }));
  assert.equal(revoked.status, 400);
  assert.match(((await revoked.json()) as { reason: string }).reason, /revoked/);
});

test("a broken Merkle path or an unreachable chain doesn't issue", async () => {
  const { prove } = setup();
  const d = disclose(issue(NUS_FIELDS), KEEP);
  d.signature.proof = ["0".repeat(64)];
  assert.equal((await prove(HOLDER_A, d)).status, 400);

  const down = await prove(HOLDER_A, disclose(issue(NUS_FIELDS), KEEP), chain({ fail: true }));
  assert.equal(down.status, 503);
  assert.equal(((await down.json()) as { retry: boolean }).retry, true);
});
