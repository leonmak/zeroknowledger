// Grants badges from verified proofs.
//
// After each successful proof the verifier server POSTs a webhook to
// http://issuer.internal/webhook, which the Container's outbound handler routes
// here without leaving the machine. Only the container can reach it, so the
// payload is trusted as "what the verifier saw". Everything the prover
// controls (handler labels, session data) is treated as input to check.
import templates from "./templates.json" with { type: "json" };
import { completeChallenge, type AppsEnv } from "./apps.ts";
import { OPENCERTS_METHODS } from "./opencerts.ts";

export type Template = (typeof templates)[number];

/**
 * An identity source (Singpass today; see IDENTITY_SOURCES.md). Its template
 * hash-commits the identifying fields (prove_params.commit_fields) instead of
 * revealing them, and the browser proves in zero knowledge (circuits/<circuit>)
 * that H comes from those commitments. The proof (and H) is sealed to the
 * attested enclave, which checks it against the commitments its own verifier
 * authenticated and returns person = HMAC(enclave key, scope || app || H). The
 * values never leave the user's device. Uniqueness is enforced per app, in apps.ts.
 */
export type PersonProofRule = { circuit: string; scope: string };

export type IssueRules = {
  status: number;
  max_age_seconds: number;
  json: Record<string, string | number | boolean>;
  person_proof?: PersonProofRule;
};

export type Webhook = {
  server_name: string;
  // holder: the site's browser secret. challenge: an app link code (apps.ts).
  // proof: the id the browser will submit its person proof under. app: the
  // challenge's app, which the enclave keys the person id with.
  session: { id: string; holder?: string; challenge?: string; proof?: string; app?: string; [key: string]: string | undefined };
  transcript: { sent: string; recv: string };
  // Per handler; for HASH handlers `value` is the authenticated commitment digest (hex).
  results?: { type: string; part: string; action: string | { kind: string }; value: string }[];
};

export type Env = {
  DB: D1Database;
  NULLIFIER_KEY?: string;
  /**
   * Asks the attested enclave (enclave.ts) for the person id. Unset without an
   * enclave, and then unique-person badges can't be issued. Throws when the
   * enclave can't be reached.
   */
  derivePerson?: (req: PersonRequest) => Promise<{ person: string } | { reason: string }>;
};
type IssueEnv = Env & Partial<Omit<AppsEnv, keyof Env>>;

/** A person proof (and H) HPKE-sealed by the browser to the attested enclave (enclave.ts). */
export type SealedPersonProof = { sealed: { enc: string; ct: string } };
/** `app`: the app the person id is for ("" for none); the enclave takes it from its own session and we check it matches. */
export type PersonRequest = SealedPersonProof & { proofId: string; circuit: string; scope: string; app: string };
const PENDING_TTL_MS = 10 * 60_000;

export async function handleWebhook(request: Request, env: IssueEnv): Promise<Response> {
  const payload = (await request.json()) as Webhook;
  const outcome = await issue(payload, env);
  await recordAttempt(env.DB, payload.session?.id ?? "", payload.server_name ?? "", outcome);
  return Response.json(outcome, { status: outcome.ok ? 200 : 422 });
}

// Every outcome is recorded: it's how to see why a proof didn't issue.
// Reasons never contain revealed or committed values.
async function recordAttempt(db: D1Database, sessionId: string, serverName: string, outcome: Outcome): Promise<void> {
  const summary = outcome.ok
    ? outcome.template + (outcome.pending ? " (awaiting person proof)" : "") + (outcome.challenge ? ` (challenge ${outcome.challenge})` : "")
    : outcome.reason;
  await db
    .prepare("INSERT INTO attempts (session_id, server_name, at, issued, reason) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(sessionId, serverName, Date.now(), outcome.ok && !outcome.pending ? 1 : 0, summary)
    .run();
  console.log(`${sessionId}: ${outcome.ok ? "ok" : "not issued"}: ${summary}`);
}

type Outcome =
  | { ok: true; template: string; holder: string; pending?: boolean; challenge?: string }
  | { ok: false; reason: string };

export async function issue(payload: Webhook, env: IssueEnv, now = Date.now()): Promise<Outcome> {
  const result = await evaluate(payload, now);
  if (!result.ok) return result;
  const { template, holder, provedAt, commitments } = result;

  if (commitments) {
    // The badge waits for the browser's sealed person proof (finishPersonProof).
    const proofId = payload.session.proof;
    if (!proofId || !/^[A-Za-z0-9_-]{16,64}$/.test(proofId)) return { ok: false, reason: "no proof id in session data" };
    // The enclave keys the person id with the session's app, so it must be the
    // app this proof links an account in (and empty when it links none).
    const expectedApp = payload.session.challenge ? await challengeApp(env.DB, payload.session.challenge) : "";
    if (expectedApp === null) return { ok: false, reason: "unknown account link" };
    if ((payload.session.app ?? "") !== expectedApp) return { ok: false, reason: "proof was made for a different app" };
    await env.DB.prepare(
      `INSERT INTO pending_proofs (proof_id, template, holder, challenge, commitments, proved_at, session_id, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
      .bind(proofId, template.name, holder, payload.session.challenge ?? null, JSON.stringify(commitments), provedAt, payload.session.id, now + PENDING_TTL_MS)
      .run();
    return { ok: true, template: template.name, holder, pending: true };
  }
  if (payload.session.challenge) return { ok: false, reason: "linking an app account needs a unique-person proof" };

  await upsertBadge(env.DB, holder, template.name, now, provedAt, payload.session.id);
  return { ok: true, template: template.name, holder };
}

/**
 * Second half of a unique-person proof: the browser's zero-knowledge proof that
 * H = Poseidon2(NRIC, mobile) opens the commitments the verifier authenticated
 * for that TLS session, sealed to the enclave. We relay it unopened; the
 * enclave verifies it and keys the person.
 */
export async function finishPersonProof(
  proofId: string,
  body: Partial<SealedPersonProof> | null,
  env: IssueEnv,
  now = Date.now(),
): Promise<Outcome & { status: number }> {
  const pending = await env.DB.prepare("SELECT * FROM pending_proofs WHERE proof_id = ?1")
    .bind(proofId)
    .first<{ template: string; holder: string; challenge: string | null; commitments: string; proved_at: number; session_id: string; expires_at: number }>();
  if (!pending) return { ok: false, reason: "no verified TLS proof for this id yet", status: 404 };

  let outcome: Outcome;
  try {
    outcome = await (async (): Promise<Outcome> => {
    if (now > pending.expires_at) return { ok: false, reason: "person proof arrived too late" };
    const template = templates.find((t) => t.name === pending.template);
    const rule = (template?.issue_when as IssueRules | null)?.person_proof;
    if (!template || !rule) return { ok: false, reason: "template no longer takes person proofs" };
    if (!env.derivePerson) return { ok: false, reason: "unique-person proofs need the enclave" };
    const sealed = body?.sealed;
    if (typeof sealed?.enc !== "string" || typeof sealed?.ct !== "string") {
      return { ok: false, reason: "person proof must be sealed to the enclave" };
    }
    let derived: { person: string } | { reason: string };
    try {
      const app = pending.challenge ? ((await challengeApp(env.DB, pending.challenge)) ?? "") : "";
      derived = await env.derivePerson({ proofId, circuit: rule.circuit, scope: rule.scope, app, sealed });
    } catch (e) {
      console.log(`enclave unavailable: ${e}`);
      throw new VerifierUnavailable();
    }
    if ("reason" in derived) return { ok: false, reason: derived.reason };
    const person = derived.person;
    await upsertBadge(env.DB, pending.holder, template.name, now, pending.proved_at, pending.session_id);
    const challenge = pending.challenge ? (await completeChallenge(env as AppsEnv, pending.challenge, person, now)).status : undefined;
    return { ok: true, template: template.name, holder: pending.holder, challenge };
    })();
  } catch (e) {
    // Keep the pending proof: nothing was checked, so the browser can retry.
    if (e instanceof VerifierUnavailable) return { ok: false, reason: "the enclave is unavailable; try again shortly", status: 503 };
    throw e;
  }

  // One attempt per TLS proof: success or failure, the pending entry is spent.
  await env.DB.prepare("DELETE FROM pending_proofs WHERE proof_id = ?1").bind(proofId).run();
  const host = templates.find((t) => t.name === pending.template)?.host ?? "";
  await recordAttempt(env.DB, pending.session_id, host, outcome);
  return { ...outcome, status: outcome.ok ? 200 : 422 };
}

class VerifierUnavailable extends Error {}

export async function upsertBadge(db: D1Database, holder: string, template: string, now: number, provedAt: number, sessionId: string) {
  await db
    .prepare(
      `INSERT INTO badges (holder, template, issued_at, proved_at, session_id)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (holder, template) DO UPDATE SET
         issued_at = excluded.issued_at, proved_at = excluded.proved_at, session_id = excluded.session_id`,
    )
    .bind(holder, template, now, provedAt, sessionId)
    .run();
}

type Evaluation =
  | { ok: true; template: Template; holder: string; provedAt: number; commitments?: string[] }
  | { ok: false; reason: string };

export async function evaluate(payload: Webhook, now = Date.now()): Promise<Evaluation> {
  const { server_name, session, transcript } = payload;
  if (!session?.holder) return { ok: false, reason: "no holder in session data" };

  // The request line pins which endpoint was proved; the host comes from the
  // TLS session itself, so neither can be relabelled by the prover.
  const requestLine = revealedLine(transcript.sent);
  const template = templates.find(
    (t) => t.host === server_name && requestLine === `${t.method} ${t.path} HTTP/1.1`,
  );
  if (!template) return { ok: false, reason: `no template for ${server_name}: ${requestLine}` };
  const rules = template.issue_when as IssueRules | null;
  if (!rules) return { ok: false, reason: `${template.name} has no issuance rules` };

  const statusLine = revealedLine(transcript.recv);
  if (!statusLine.startsWith(`HTTP/1.1 ${rules.status} `)) {
    return { ok: false, reason: `status line was "${statusLine}"` };
  }

  // Freshness from the server's own Date header (revealed, so authenticated).
  // The line before it is usually redacted, so it may follow NULs, not CRLF.
  const date = /(?:\n|\0)date:[ \t]*([^\r\n\0]+)/i.exec(transcript.recv)?.[1];
  const provedAt = date ? Date.parse(date) : NaN;
  if (Number.isNaN(provedAt)) return { ok: false, reason: "Date header not revealed" };
  if (Math.abs(now - provedAt) > rules.max_age_seconds * 1000) {
    return { ok: false, reason: `proof is from ${date}, outside ${rules.max_age_seconds}s` };
  }

  for (const [path, expected] of Object.entries(rules.json)) {
    if (!revealsJsonValue(transcript.recv, path, expected)) {
      return { ok: false, reason: `${path} is not ${JSON.stringify(expected)}` };
    }
  }

  let commitments: string[] | undefined;
  if (rules.person_proof) {
    // Authenticated by the verifier: digests of the hash-committed ranges.
    const digests = (payload.results ?? [])
      .filter((r) => r.type === "RECV" && typeof r.action === "object" && r.action.kind === "HASH")
      .map((r) => r.value.toLowerCase());
    commitments = [...new Set(digests)];
    const expected = template.commit_fields.length;
    if (commitments.length !== expected || !commitments.every((d) => /^[0-9a-f]{64}$/.test(d))) {
      return { ok: false, reason: `expected ${expected} hash commitments (${template.commit_fields.join(", ")})` };
    }
  }

  return { ok: true, template, holder: await holderId(session.holder), provedAt, commitments };
}

/** The first line of a transcript, provided it was revealed in full. */
function revealedLine(text: string): string {
  const end = text.indexOf("\r\n");
  const line = end === -1 ? "" : text.slice(0, end);
  return line.includes("\0") ? "" : line;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether the revealed response body contains `"key": value` for the path's
 * last segment. The plugin reveals JSON fields as key/value byte ranges, so
 * the full document can't be parsed; everything else is NUL.
 */
function revealsJsonValue(recv: string, path: string, expected: string | number | boolean): boolean {
  const key = path.split(".").pop()!;
  const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*${escapeRegExp(JSON.stringify(expected))}(?=\\s*[,}\\0]|$)`);
  return pattern.test(recv);
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Badges are held by the hash of a secret the site keeps in the browser. The id
 * is never public: listing badges needs the secret (POST /holders/me/badges),
 * and shared views go through cases, which show only the badges chosen.
 */
export async function holderId(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return [...new Uint8Array(digest).slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function challengeApp(db: D1Database, code: string): Promise<string | null> {
  const row = await db.prepare("SELECT app_id FROM challenges WHERE code = ?1").bind(code).first<{ app_id: string }>();
  return row?.app_id ?? null;
}

/** Deletes a holder's badges (and any proof still pending for it). Returns how many badges. */
export async function deleteHolder(db: D1Database, holder: string): Promise<number> {
  const badges = await db.prepare("DELETE FROM badges WHERE holder = ?1").bind(holder).run();
  await db.prepare("DELETE FROM pending_proofs WHERE holder = ?1").bind(holder).run();
  return badges.meta.changes ?? 0;
}

export async function listBadges(holder: string, env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT template, issued_at, proved_at FROM badges WHERE holder = ?1 ORDER BY issued_at DESC",
  )
    .bind(holder)
    .all<{ template: string; issued_at: number; proved_at: number }>();
  const badges = results.map((row) => ({
    ...row,
    badge: templates.find((t) => t.name === row.template)?.badge ?? OPENCERTS_METHODS[row.template]?.badge ?? null,
  }));
  return Response.json({ badges }, { headers: { "Access-Control-Allow-Origin": "*" } });
}
