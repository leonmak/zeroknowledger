import assert from "node:assert/strict";
import { test } from "node:test";
import { dequeue, handleWake, sweep, TICKET_TTL_MS } from "../src/enclaveControl.ts";
import type { Compute } from "../src/gcp.ts";
import { testDb } from "./d1.ts";

/** A fake VM: records start/stop calls. */
function vm(initial: string) {
  const calls: string[] = [];
  let status = initial;
  const compute: Compute = {
    status: async () => status,
    start: async () => void (calls.push("start"), (status = "PROVISIONING")),
    stop: async () => void (calls.push("stop"), (status = "STOPPING")),
  };
  return { compute, calls, set: (s: string) => (status = s) };
}

const wake = (env: { DB: D1Database; ENCLAVE_URL: string }, compute: Compute, ready: boolean, proof_id = "p".repeat(20), now = 1000) =>
  handleWake(
    new Request("https://v/enclave/wake", { method: "POST", body: JSON.stringify({ proof_id }) }),
    env,
    compute,
    async () => ready,
    now,
  ).then((r) => r.json() as Promise<Record<string, unknown>>);

test("waking queues the proof and starts a stopped enclave", async () => {
  const env = { DB: testDb(), ENCLAVE_URL: "https://enclave" };
  const v = vm("TERMINATED");
  assert.deepEqual(await wake(env, v.compute, false), { ready: false, starting: true, status: "TERMINATED" });
  assert.deepEqual(v.calls, ["start"]);
  // Polling while it boots doesn't start it twice.
  await wake(env, v.compute, false);
  assert.deepEqual(v.calls, ["start"]);
  assert.deepEqual(await wake(env, v.compute, true), { ready: true });
});

test("the minute check stops the enclave only when the queue is empty", async () => {
  const env = { DB: testDb(), ENCLAVE_URL: "https://enclave" };
  const v = vm("RUNNING");
  await wake(env, v.compute, true, "a".repeat(20), 1000);
  assert.equal(await sweep(env, v.compute, 2000), "busy");
  assert.deepEqual(v.calls, []);
  // The proof was handled: it leaves the queue, and the next check stops the VM.
  await dequeue(env.DB, "a".repeat(20));
  assert.equal(await sweep(env, v.compute, 3000), "stopped");
  assert.deepEqual(v.calls, ["stop"]);
  // Already stopping or stopped: nothing to do.
  assert.equal(await sweep(env, v.compute, 4000), "idle");
  assert.deepEqual(v.calls, ["stop"]);
});

test("an abandoned proof stops keeping the enclave up after its ticket expires", async () => {
  const env = { DB: testDb(), ENCLAVE_URL: "https://enclave" };
  const v = vm("RUNNING");
  await wake(env, v.compute, true, "b".repeat(20), 1000);
  assert.equal(await sweep(env, v.compute, 1000 + TICKET_TTL_MS - 1), "busy");
  assert.equal(await sweep(env, v.compute, 1000 + TICKET_TTL_MS), "stopped");
});

test("a TLS proof awaiting its sealed openings keeps the enclave up", async () => {
  const env = { DB: testDb(), ENCLAVE_URL: "https://enclave" };
  const v = vm("RUNNING");
  await env.DB.prepare(
    `INSERT INTO pending_proofs (proof_id, template, holder, challenge, commitments, proved_at, session_id, expires_at)
     VALUES ('c', 't', 'h', NULL, '[]', 0, 's', 5000)`,
  ).run();
  assert.equal(await sweep(env, v.compute, 4000), "busy");
  assert.equal(await sweep(env, v.compute, 5000), "stopped");
});

test("wake rejects a malformed proof id", async () => {
  const env = { DB: testDb(), ENCLAVE_URL: "https://enclave" };
  const res = await handleWake(new Request("https://v/enclave/wake", { method: "POST", body: "{}" }), env, vm("TERMINATED").compute);
  assert.equal(res.status, 400);
});
