// The enclave VM runs only while someone is proving.
//
//  - wake: the browser calls POST /enclave/wake {proof_id} before a
//    unique-person proof, and keeps calling it until it answers ready. That
//    queues a ticket and starts the VM if it's stopped (about a minute to boot).
//  - sweep: a cron trigger every minute. When the queue is empty (no unexpired
//    ticket and no unexpired pending_proofs row), it stops the VM.
//
// A proof's ticket is removed when its sealed openings are handled
// (finishPersonProof), so the VM stops within a minute of the last proof.
import type { Compute } from "./gcp.ts";

/** Long enough for the Singpass login, step-up and the MPC-TLS proof. */
export const TICKET_TTL_MS = 15 * 60_000;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" };

export type ControlEnv = { DB: D1Database; ENCLAVE_URL?: string };

/** Whether the enclave answers (its attestation endpoint is the last thing to come up). */
async function enclaveReady(env: ControlEnv): Promise<boolean> {
  try {
    const res = await fetch(`${env.ENCLAVE_URL}/enclave/attestation`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function handleWake(
  request: Request,
  env: ControlEnv,
  compute: Compute | undefined,
  ready: (env: ControlEnv) => Promise<boolean> = enclaveReady,
  now = Date.now(),
): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
  const body = (await request.json().catch(() => null)) as { proof_id?: unknown } | null;
  const proofId = body?.proof_id;
  if (typeof proofId !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(proofId)) return reply({ error: "bad proof_id" }, 400);

  await env.DB.prepare(
    "INSERT INTO enclave_tickets (proof_id, expires_at) VALUES (?1, ?2) ON CONFLICT (proof_id) DO UPDATE SET expires_at = excluded.expires_at",
  )
    .bind(proofId, now + TICKET_TTL_MS)
    .run();

  if (await ready(env)) return reply({ ready: true });
  // Not answering: without control, it's simply down; otherwise start it.
  if (!compute) return reply({ ready: false, starting: false });
  const status = await compute.status();
  // A stop that's still in progress can't be started yet; the next call will.
  if (status === "TERMINATED") await compute.start();
  return reply({ ready: false, starting: true, status });
}

/** The per-minute check: stop the VM once the queue is empty. */
export async function sweep(env: ControlEnv, compute: Compute | undefined, now = Date.now()): Promise<"stopped" | "busy" | "idle"> {
  if (!compute) return "idle";
  await env.DB.prepare("DELETE FROM enclave_tickets WHERE expires_at <= ?1").bind(now).run();
  const waiting = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM enclave_tickets) + (SELECT COUNT(*) FROM pending_proofs WHERE expires_at > ?1) AS n`,
  )
    .bind(now)
    .first<{ n: number }>();
  if ((waiting?.n ?? 0) > 0) return "busy";
  // Also stops a VM started by hand (gcp/deploy.sh start) once it's idle.
  const status = await compute.status();
  if (status !== "RUNNING" && status !== "PROVISIONING" && status !== "STAGING") return "idle";
  await compute.stop();
  return "stopped";
}

/** Called when a proof's sealed openings have been handled: it leaves the queue. */
export async function dequeue(db: D1Database, proofId: string) {
  await db.prepare("DELETE FROM enclave_tickets WHERE proof_id = ?1").bind(proofId).run();
}
