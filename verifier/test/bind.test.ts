import assert from "node:assert/strict";
import { test } from "node:test";
import { handleAppsRequest } from "../src/apps.ts";
import { createHash, createHmac } from "node:crypto";
import { finishPersonProof, hmacHex, issue, handleWebhook, type PersonRequest, type Webhook } from "../src/issuer.ts";
import { testDb } from "./d1.ts";

const hidden = (s: string) => "\0".repeat(s.length);
const NRIC_A = "S1234567D";
const NRIC_B = "T7654321J";
const PHONE = "91234567";

const sha256Hex = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/**
 * What the browser would submit: its person proof, sealed to the enclave. Tests
 * stand in for HPKE with base64 JSON that only the fake enclave below reads
 * (the real sealing is tested in enclave-issuer.test.mjs).
 */
function sealedFor(nric: string, phone: string) {
  return { sealed: { enc: "test", ct: Buffer.from(JSON.stringify({ nric, phone })).toString("base64") } };
}

/** TLSNotary commitments for the two fields, with fixed blinders per value. */
function committed(nric: string, phone: string): [string, string] {
  const kv = (s: string) => new TextEncoder().encode(s);
  return [
    sha256Hex(Buffer.concat([kv(`"singpass_id":"${nric}"`), Buffer.alloc(16, nric.charCodeAt(1))])),
    sha256Hex(Buffer.concat([kv(`"mobile_number":"${phone}"`), Buffer.alloc(16, phone.charCodeAt(1))])),
  ];
}

/** The verifier's webhook for a unique-person proof: commitments, not values. */
function profileWebhook(opts: { holder?: string; nric?: string; phone?: string; challenge?: string; app?: string; at?: number; proof?: string }): Webhook {
  const { holder = "browser", nric = NRIC_A, phone = PHONE, challenge, app, at = Date.now(), proof } = opts;
  const sent = "GET /home/api/secured/profile-update-details HTTP/1.1\r\nhost: portal.singpass.gov.sg\r\n" + hidden("Cookie: x\r\n\r\n");
  const recv = "HTTP/1.1 200 OK\r\n" + hidden("x: y\r\n") + `date: ${new Date(at - 30_000).toUTCString()}\r\n` + hidden("\r\n{\"result\":{...}},") + '"status":"SUCCESS"';
  const [c1, c2] = committed(nric, phone);
  const hash = (value: string) => ({ type: "RECV", part: "BODY", action: { kind: "HASH" }, value });
  return {
    server_name: "portal.singpass.gov.sg",
    session: { id: "s", holder, challenge, proof, app },
    transcript: { sent, recv },
    results: [hash(c1), hash(c2)],
  };
}

/**
 * Stand-in for the enclave (gcp/enclave/issuer.mjs): opens the "sealed" values,
 * checks they open the commitments the TLS session made, and keys the person.
 */
function fakeEnclave(db: D1Database, refuse: () => boolean) {
  return async (req: PersonRequest): Promise<{ person: string } | { reason: string }> => {
    if (refuse()) return { reason: "enclave refused" };
    const { nric, phone } = JSON.parse(Buffer.from(req.sealed.ct, "base64").toString()) as { nric: string; phone: string };
    const row = await db.prepare("SELECT commitments FROM pending_proofs WHERE proof_id = ?1").bind(req.proofId).first<{ commitments: string }>();
    const expected = (JSON.parse(row!.commitments) as string[]).sort().join();
    if (committed(nric, phone).sort().join() !== expected) return { reason: "proof is for different commitments" };
    const values = [`"singpass_id":"${nric}"`, `"mobile_number":"${phone}"`].sort().join("\n");
    return { person: createHmac("sha256", "enclave-key").update(`${req.scope}\n${req.app}\n${values}`).digest("hex") };
  };
}

function setup() {
  let refuse = false;
  const DB = testDb();
  const env = {
    DB,
    NULLIFIER_KEY: "k",
    ADMIN_TOKEN: "admin",
    SITE_URL: "https://site",
    derivePerson: fakeEnclave(DB, () => refuse),
  };
  const call = async (method: string, path: string, body?: unknown, token?: string) => {
    const res = await handleAppsRequest(
      new Request(`https://v${path}`, {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
    return { status: res!.status, body: (await res!.json()) as Record<string, unknown> };
  };
  const register = async (app_id: string, extra: Record<string, unknown> = {}) =>
    (await call("POST", "/apps", { app_id, name: `App ${app_id}`, ...extra }, "admin")).body.api_key as string;
  const challenge = async (app: string, key: string, subject: string) =>
    (await call("POST", `/apps/${app}/challenges`, { subject }, key)).body.code as string;
  const status = async (code: string) => (await call("GET", `/challenges/${code}`)).body;
  const subject = async (app: string, key: string, s: string) => call("GET", `/apps/${app}/subjects/${encodeURIComponent(s)}`, undefined, key);
  const dump = () => (env.DB as unknown as { dump(): Record<string, Record<string, unknown>[]> }).dump();
  /** Full unique-person flow: TLS proof webhook, then the browser's sealed person proof. */
  const provePerson = async (o: { nric?: string; phone?: string; challenge?: string; holder?: string; at?: number } = {}) => {
    const proofId = crypto.randomUUID().replace(/-/g, "");
    // The site sends the link's app with the proof (Bind.tsx).
    const app = o.challenge
      ? (await env.DB.prepare("SELECT app_id FROM challenges WHERE code = ?1").bind(o.challenge).first<{ app_id: string }>())?.app_id
      : undefined;
    const pending = await issue(profileWebhook({ ...o, app, proof: proofId }), env, o.at);
    assert.equal(pending.ok && pending.pending, true, JSON.stringify(pending));
    return finishPersonProof(proofId, sealedFor(o.nric ?? NRIC_A, o.phone ?? PHONE), env, o.at);
  };
  return { env, call, register, challenge, status, subject, dump, provePerson, setRefuse: (v: boolean) => (refuse = v) };
}

test("app registration is admin-only and ids are unique", async () => {
  const t = setup();
  assert.equal((await t.call("POST", "/apps", { app_id: "discord:1", name: "x" })).status, 401);
  assert.equal((await t.call("POST", "/apps", { app_id: "discord:1", name: "x" }, "admin")).status, 201);
  assert.equal((await t.call("POST", "/apps", { app_id: "discord:1", name: "x" }, "admin")).status, 409);
  assert.equal((await t.call("POST", "/apps", { app_id: "Bad Id!", name: "x" }, "admin")).status, 400);
});

test("app API needs that app's key", async () => {
  const t = setup();
  const key1 = await t.register("discord:1");
  await t.register("discord:2");
  assert.equal((await t.call("POST", "/apps/discord:2/challenges", { subject: "u" }, key1)).status, 401);
  assert.equal((await t.call("POST", "/apps/discord:1/challenges", { subject: "u" }, "zk_wrong")).status, 401);
});

test("a unique-person proof completes the challenge and binds the subject", async () => {
  const t = setup();
  const key = await t.register("discord:1");
  const code = await t.challenge("discord:1", key, "user:alice");
  const out = await t.provePerson({ challenge: code });
  assert.equal(out.ok && out.challenge, "completed");
  const s = await t.status(code);
  assert.equal(s.status, "completed");
  const sub = await t.subject("discord:1", key, "user:alice");
  assert.equal(sub.status, 200);
  assert.match(sub.body.pairwise_id as string, /^[0-9a-f]{32}$/);
  // The app-facing status has the pairwise id too.
  const appView = await t.call("GET", `/apps/discord:1/challenges/${code}`, undefined, key);
  assert.equal(appView.body.pairwise_id, sub.body.pairwise_id);
});

test("moving to another subject needs confirmation and unbinds the old one", async () => {
  const t = setup();
  const key = await t.register("discord:1", { cooldown_days: 0 });
  await t.provePerson({ challenge: await t.challenge("discord:1", key, "user:alice") });

  const code = await t.challenge("discord:1", key, "user:bob");
  const out = await t.provePerson({ challenge: code });
  assert.equal(out.ok && out.challenge, "needs_confirmation");
  const s = await t.status(code);
  assert.equal(s.status, "needs_confirmation");
  assert.equal(s.move_from, "user:alice");
  assert.equal((await t.subject("discord:1", key, "user:alice")).status, 200); // not moved yet

  const confirmed = await t.call("POST", `/challenges/${code}/confirm`);
  assert.equal(confirmed.body.status, "completed");
  assert.equal((await t.subject("discord:1", key, "user:alice")).status, 404);
  const bob = await t.subject("discord:1", key, "user:bob");
  assert.equal(bob.body.rebind_count, 1);
  assert.equal(t.dump().bindings.length, 1);
});

test("moves are blocked during the app's cooldown", async () => {
  const t = setup();
  const key = await t.register("discord:1"); // default 30 days
  await t.provePerson({ challenge: await t.challenge("discord:1", key, "user:alice") });
  const code = await t.challenge("discord:1", key, "user:bob");
  await t.provePerson({ challenge: code });
  const s = await t.status(code);
  assert.equal(s.status, "rejected");
  assert.match(s.reason as string, /already linked to another account here; it can move after/);
});

test("a subject proved by a different person replaces the old person", async () => {
  const t = setup();
  const key = await t.register("discord:1");
  await t.provePerson({ challenge: await t.challenge("discord:1", key, "user:shared") });
  const before = (await t.subject("discord:1", key, "user:shared")).body.pairwise_id;
  await t.provePerson({ nric: NRIC_B, challenge: await t.challenge("discord:1", key, "user:shared") });
  const after = (await t.subject("discord:1", key, "user:shared")).body.pairwise_id;
  assert.notEqual(before, after);
  assert.equal(t.dump().bindings.length, 1);
});

test("one person can link one account in each app, with unlinkable ids", async () => {
  const t = setup();
  const k1 = await t.register("discord:1");
  const k2 = await t.register("discord:2");
  await t.provePerson({ challenge: await t.challenge("discord:1", k1, "user:alice") });
  await t.provePerson({ challenge: await t.challenge("discord:2", k2, "user:alice") });
  const p1 = (await t.subject("discord:1", k1, "user:alice")).body.pairwise_id;
  const p2 = (await t.subject("discord:2", k2, "user:alice")).body.pairwise_id;
  assert.ok(p1 && p2 && p1 !== p2);
  // Even the stored (never shown) person ids differ per app, so the database
  // alone can't link one person's accounts across apps.
  const persons = t.dump().bindings.map((b) => b.person);
  assert.equal(new Set(persons).size, 2);
});

test("a proof made for one app can't link an account in another", async () => {
  const t = setup();
  const k1 = await t.register("discord:1");
  await t.register("discord:2");
  const code = await t.challenge("discord:1", k1, "user:alice");
  const out = await issue(profileWebhook({ challenge: code, app: "discord:2", proof: "m".repeat(20) }), t.env);
  assert.deepEqual(out, { ok: false, reason: "proof was made for a different app" });
  const none = await issue(profileWebhook({ challenge: code, proof: "n".repeat(20) }), t.env);
  assert.deepEqual(none, { ok: false, reason: "proof was made for a different app" });
});

test("expired and reused challenges are rejected", async () => {
  const t = setup();
  const key = await t.register("discord:1");
  const code = await t.challenge("discord:1", key, "user:alice");
  const later = Date.now() + 16 * 60_000;
  const late = await t.provePerson({ challenge: code, at: later });
  assert.equal(late.ok && late.challenge, "rejected");
  const code2 = await t.challenge("discord:1", key, "user:alice");
  await t.provePerson({ challenge: code2 });
  const again = await t.provePerson({ nric: NRIC_B, challenge: code2 });
  assert.equal(again.ok && again.challenge, "rejected");
});

test("a person proof must be for the commitments the verifier saw", async () => {
  const t = setup();
  const proofId = "p".repeat(20);
  await issue(profileWebhook({ proof: proofId }), t.env);
  // Someone else's values (different commitments).
  const out = await finishPersonProof(proofId, sealedFor(NRIC_B, "81234567"), t.env);
  assert.deepEqual(out, { ok: false, reason: "proof is for different commitments", status: 422 });
  // The pending proof is spent: no second try with the same TLS proof.
  const again = await finishPersonProof(proofId, sealedFor(NRIC_A, PHONE), t.env);
  assert.equal(again.status, 404);
  assert.equal(t.dump().badges.length, 0);
});

test("an enclave refusal issues nothing", async () => {
  const t = setup();
  t.setRefuse(true);
  const out = await t.provePerson({});
  assert.deepEqual(out, { ok: false, reason: "enclave refused", status: 422 });
  assert.equal(t.dump().badges.length, 0);
});

test("the TLS proof needs a proof id and exactly two commitments", async () => {
  const t = setup();
  assert.deepEqual(await issue(profileWebhook({}), t.env), { ok: false, reason: "no proof id in session data" });
  const w = profileWebhook({ proof: "q".repeat(20) });
  w.results = w.results!.slice(0, 1);
  assert.deepEqual(await issue(w, t.env), { ok: false, reason: "expected 2 hash commitments (result.singpass_id, result.mobile_number)" });
});

test("a new mobile number counts as a new person (documented trade-off)", async () => {
  const t = setup();
  const key = await t.register("discord:1");
  await t.provePerson({ challenge: await t.challenge("discord:1", key, "user:alice") });
  const code = await t.challenge("discord:1", key, "user:bob");
  const out = await t.provePerson({ phone: "87654321", challenge: code });
  assert.equal(out.ok && out.challenge, "completed"); // not "needs_confirmation"
});

test("webhooks are signed and report unbound then bound on a move", async () => {
  const t = setup();
  const events: { body: string; sig: string | null }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    events.push({ body: init.body as string, sig: new Headers(init.headers).get("X-ZK-Signature") });
    return new Response("ok");
  }) as typeof fetch;
  try {
    const reg = await t.call("POST", "/apps", { app_id: "dating:acme", name: "Acme", webhook_url: "https://acme/hook", cooldown_days: 0 }, "admin");
    const key = reg.body.api_key as string;
    await t.provePerson({ challenge: await t.challenge("dating:acme", key, "u1") });
    const code = await t.challenge("dating:acme", key, "u2");
    await t.provePerson({ challenge: code });
    await t.call("POST", `/challenges/${code}/confirm`);
  } finally {
    globalThis.fetch = realFetch;
  }
  const types = events.map((e) => JSON.parse(e.body).type + ":" + JSON.parse(e.body).subject);
  assert.deepEqual(types, ["bound:u1", "unbound:u1", "bound:u2"]);
  const secret = t.dump().apps[0].webhook_secret as string;
  for (const e of events) assert.equal(e.sig, `sha256=${await hmacHex(secret, e.body)}`);
});

test("neither NRIC nor mobile ever reaches the issuer", async () => {
  const t = setup();
  const key = await t.register("discord:1");
  const proofId = "r".repeat(20);
  const webhook = profileWebhook({ proof: proofId, app: "discord:1", challenge: await t.challenge("discord:1", key, "user:alice") });
  const body = sealedFor(NRIC_A, PHONE); // stands in for ciphertext only the enclave can open
  assert.doesNotMatch(JSON.stringify(webhook), /S1234567D|91234567/);
  await handleWebhook(new Request("http://issuer.internal/webhook", { method: "POST", body: JSON.stringify(webhook) }), t.env);
  const out = await finishPersonProof(proofId, body, t.env);
  assert.equal(out.ok, true);
  assert.doesNotMatch(JSON.stringify(t.dump()), /S1234567D|91234567/);
});

test("an unreachable enclave is retryable and keeps the pending proof", async () => {
  const t = setup();
  const proofId = "u".repeat(20);
  await issue(profileWebhook({ proof: proofId }), t.env);
  const flaky = { ...t.env, derivePerson: async () => { throw new Error("connection refused"); } };
  const first = await finishPersonProof(proofId, sealedFor(NRIC_A, PHONE), flaky);
  assert.deepEqual(first, { ok: false, reason: "the enclave is unavailable; try again shortly", status: 503 });
  const second = await finishPersonProof(proofId, sealedFor(NRIC_A, PHONE), t.env);
  assert.equal(second.ok, true);
});

test("only a sealed person proof is accepted, relayed unopened, and only with an enclave", async () => {
  const t = setup();
  const seen: unknown[] = [];
  const enclave = { ...t.env, derivePerson: async (req: PersonRequest) => (seen.push(req), { person: "ab".repeat(32) }) };
  const proofId = "e".repeat(20);
  await issue(profileWebhook({ proof: proofId }), t.env);
  const plain = await finishPersonProof(proofId, { nric: NRIC_A, phone: PHONE } as never, enclave);
  assert.equal((plain as { reason: string }).reason, "person proof must be sealed to the enclave");
  assert.equal(seen.length, 0);

  const proofId2 = "f".repeat(20);
  await issue(profileWebhook({ proof: proofId2 }), t.env);
  const sealed = { enc: "ZW5j", ct: "Y2lwaGVydGV4dA==" };
  assert.equal((await finishPersonProof(proofId2, { sealed }, enclave)).ok, true);
  assert.deepEqual(seen, [{ proofId: proofId2, circuit: "singpass_person", scope: "singpass-person", app: "", sealed }]);

  const proofId3 = "g".repeat(20);
  await issue(profileWebhook({ proof: proofId3 }), t.env);
  const none = await finishPersonProof(proofId3, { sealed }, { ...t.env, derivePerson: undefined });
  assert.equal((none as { reason: string }).reason, "unique-person proofs need the enclave");
});

test("a public verify link confirms the app-specific id, and nothing else", async () => {
  const t = setup();
  const key = await t.register("discord:1");
  await t.provePerson({ challenge: await t.challenge("discord:1", key, "user:alice") });
  const sub = await t.subject("discord:1", key, "user:alice");
  const pairwise = sub.body.pairwise_id as string;
  assert.equal(sub.body.verify_url, `https://site/singpass/verified/discord:1/${pairwise}`);

  const ok = await t.call("GET", `/verify/discord:1/${pairwise}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.verified, true);
  assert.equal(ok.body.app_name, "App discord:1");
  assert.equal(JSON.stringify(ok.body).includes("user:alice"), false); // no account id
  // Another app can't use this id: pairwise ids are per app.
  await t.register("discord:2");
  assert.equal((await t.call("GET", `/verify/discord:2/${pairwise}`)).status, 404);
  assert.equal((await t.call("GET", `/verify/discord:1/${"0".repeat(32)}`)).status, 404);
});
