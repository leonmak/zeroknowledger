import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluate, holderId, type Webhook } from "../src/issuer.ts";

// Unrevealed bytes arrive as NUL; fill a span with them.
const hidden = (s: string) => "\0".repeat(s.length);

const NOW = Date.parse("Wed, 30 Sep 2026 06:00:00 GMT");

const COMMITMENTS = ["aa".repeat(32), "bb".repeat(32)];
const PROFILE = "GET /home/api/secured/profile-update-details HTTP/1.1";

/** The verifier's webhook for Singpass's profile response: status revealed, NRIC and mobile only committed. */
function singpass({
  requestLine = PROFILE,
  statusLine = "HTTP/1.1 200 OK",
  date = "Wed, 30 Sep 2026 05:58:00 GMT",
  status = "SUCCESS",
  holder = "browser-secret" as string | undefined,
  server = "portal.singpass.gov.sg",
} = {}): Webhook {
  const sent =
    `${requestLine}\r\n` +
    "Host: portal.singpass.gov.sg\r\n" +
    hidden("Cookie: SP-PORTAL-SESSION-ID=abc123\r\n") +
    hidden("Accept-Encoding: identity\r\nConnection: close\r\n\r\n");
  const recv =
    `${statusLine}\r\n` +
    hidden("content-type: application/json\r\n") +
    `date: ${date}\r\n` +
    hidden('\r\n{"result":{"singpass_id":"S1234567D","mobile_number":"91234567"},') +
    `"status":"${status}"}`;
  const results = COMMITMENTS.map((value) => ({ type: "RECV", part: "BODY", action: { kind: "HASH" }, value }));
  return { server_name: server, session: { id: "s1", holder, proof: "p".repeat(20) }, transcript: { sent, recv }, results };
}

test("accepts a fresh profile proof and keeps only the commitments", async () => {
  const result = await evaluate(singpass(), NOW);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual((result as { commitments: string[] }).commitments.slice().sort(), COMMITMENTS);
});

test("rejects an unsuccessful response", async () => {
  const result = await evaluate(singpass({ status: "FAIL" }), NOW);
  assert.equal(result.ok, false);
});

test("rejects a stale proof", async () => {
  const result = await evaluate(singpass({ date: "Wed, 30 Sep 2026 05:30:00 GMT" }), NOW);
  assert.equal(result.ok, false);
});

test("rejects a different Singpass endpoint", async () => {
  const result = await evaluate(singpass({ requestLine: "GET /home/api/public/info HTTP/1.1" }), NOW);
  assert.equal(result.ok, false);
});

test("rejects a proof from another server", async () => {
  const result = await evaluate(singpass({ server: "evil.example" }), NOW);
  assert.equal(result.ok, false);
});

test("rejects a non-200 response", async () => {
  const result = await evaluate(singpass({ statusLine: "HTTP/1.1 401 Unauthorized" }), NOW);
  assert.equal(result.ok, false);
});

test("rejects when the request line was redacted", async () => {
  const result = await evaluate(singpass({ requestLine: hidden(PROFILE) }), NOW);
  assert.equal(result.ok, false);
});

test("rejects without a holder", async () => {
  const payload = singpass();
  delete payload.session.holder;
  const result = await evaluate(payload, NOW);
  assert.deepEqual(result, { ok: false, reason: "no holder in session data" });
});

test("holder ids are 32 hex chars and stable", async () => {
  const id = await holderId("browser-secret");
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.equal(id, await holderId("browser-secret"));
});

test("deleting a holder removes its badges and pending proofs, not other holders'", async () => {
  const { testDb } = await import("./d1.ts");
  const { deleteHolder, upsertBadge } = await import("../src/issuer.ts");
  const db = testDb();
  await upsertBadge(db, "mine", "dev/github-account-age", 1, 1, "s");
  await upsertBadge(db, "mine", "identity/singpass-unique-person", 1, 1, "s");
  await upsertBadge(db, "theirs", "dev/github-account-age", 1, 1, "s");
  await db.prepare(
    "INSERT INTO pending_proofs (proof_id, template, holder, challenge, commitments, proved_at, session_id, expires_at) VALUES ('p', 't', 'mine', NULL, '[]', 0, 's', 9)",
  ).run();
  assert.equal(await deleteHolder(db, "mine"), 2);
  const left = (await db.prepare("SELECT holder FROM badges").all<{ holder: string }>()).results.map((r) => r.holder);
  assert.deepEqual(left, ["theirs"]);
  assert.equal((await db.prepare("SELECT COUNT(*) n FROM pending_proofs").first<{ n: number }>())?.n, 0);
});
