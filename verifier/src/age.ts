// Age-only authorization for Retrochat. This grants no uniqueness/personhood claim.
export const AGE_TEMPLATE = "identity/singpass-age-15-plus";
const ID = /^[a-f0-9]{64}$/;
const TTL = 20 * 60_000;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type" };
export interface AgeEnv {
  DB: D1Database;
  RETROCHAT_AGE_SECRET?: string;
  RETROCHAT_RETURN_URL?: string;
  SITE_URL: string;
  AGE_SITE_URL?: string;
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
const random = () => [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("");
export async function digest(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function authenticated(request: Request, secret?: string) {
  if (!secret || secret.length < 32) return false;
  const supplied = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  if (supplied.length > 256) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const message = new TextEncoder().encode("retrochat-age-client");
  const other = await crypto.subtle.importKey("raw", new TextEncoder().encode(supplied || "missing"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.verify("HMAC", key, await crypto.subtle.sign("HMAC", other, message), message);
}

export async function handleAge(request: Request, env: AgeEnv, now = Date.now()): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/age/")) return null;
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!env.RETROCHAT_AGE_SECRET || !env.RETROCHAT_RETURN_URL) return json({ error: "Age linking is not configured" }, 503);
  if (path === "/age/requests" && request.method === "POST") {
    if (!(await authenticated(request, env.RETROCHAT_AGE_SECRET))) return json({ error: "Unauthorized" }, 401);
    const body = await request.json().catch(() => null) as { challenge?: string; room?: string } | null;
    if (!ID.test(body?.challenge ?? "") || !/^[A-Z0-9]{4,10}$/.test(body?.room ?? "")) return json({ error: "Invalid request" }, 400);
    // Fixed operator-configured return destination, never a browser-supplied URL.
    const back = new URL(env.RETROCHAT_RETURN_URL);
    if (back.protocol !== "https:" && back.hostname !== "localhost") return json({ error: "Invalid return configuration" }, 503);
    const id = random();
    back.search = new URLSearchParams({ room: body!.room!, age_request: id }).toString();
    back.hash = "";
    await env.DB.prepare("DELETE FROM age_requests WHERE expires_at < ?1").bind(now).run();
    await env.DB.prepare("INSERT INTO age_requests (id, challenge, return_url, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind(id, body!.challenge!, back.href, now, now + TTL).run();
    const url = new URL(`/methods/${AGE_TEMPLATE}`, env.AGE_SITE_URL ?? env.SITE_URL);
    url.searchParams.set("age_request", id);
    return json({ id, url: url.href, expiresAt: now + TTL }, 201);
  }
  const id = /^\/age\/requests\/([a-f0-9]{64})$/.exec(path)?.[1];
  if (id && request.method === "GET") {
    const row = await env.DB.prepare("SELECT return_url, expires_at, proved_at, consumed_at FROM age_requests WHERE id = ?1 AND expires_at > ?2")
      .bind(id, now).first<{ return_url: string; expires_at: number; proved_at: number | null; consumed_at: number | null }>();
    if (!row) return json({ error: "This verification link has expired. Start again in Retrochat." }, 410);
    return json({ ready: row.proved_at !== null, returnUrl: row.return_url, expiresAt: row.expires_at });
  }
  if (path === "/age/exchange" && request.method === "POST") {
    if (!(await authenticated(request, env.RETROCHAT_AGE_SECRET))) return json({ error: "Unauthorized" }, 401);
    const body = await request.json().catch(() => null) as { id?: string; verifier?: string } | null;
    if (!ID.test(body?.id ?? "") || !ID.test(body?.verifier ?? "")) return json({ error: "Invalid request" }, 400);
    const challenge = await digest(body!.verifier!);
    // Atomic consumption: concurrent exchanges cannot both claim the authorization code.
    const row = await env.DB.prepare(`UPDATE age_requests SET consumed_at = ?1
      WHERE id = ?2 AND challenge = ?3 AND expires_at > ?1 AND proved_at IS NOT NULL AND consumed_at IS NULL
      RETURNING proved_at`).bind(now, body!.id!, challenge).first<{ proved_at: number }>();
    if (row) return json({ verified: true, minimumAge: 15, provedAt: row.proved_at, expiresAt: row.proved_at + 90 * 86400_000 });
    const pending = await env.DB.prepare("SELECT id FROM age_requests WHERE id = ?1 AND challenge = ?2 AND expires_at > ?3 AND consumed_at IS NULL")
      .bind(body!.id!, challenge, now).first();
    return pending ? json({ pending: true }, 202) : json({ error: "Invalid, expired or already used authorization" }, 410);
  }
  return json({ error: "Not found" }, 404);
}

/** Called ONLY after the authenticated verifier webhook passes the age issuance rules. */
export async function completeAge(db: D1Database, id: string, template: string, provedAt: number, now: number): Promise<boolean> {
  if (!ID.test(id) || template !== AGE_TEMPLATE) return false;
  const result = await db.prepare(`UPDATE age_requests SET proved_at = ?1
    WHERE id = ?2 AND expires_at > ?3 AND created_at <= ?1 + 1000 AND proved_at IS NULL AND consumed_at IS NULL`)
    .bind(provedAt, id, now).run();
  return result.meta.changes === 1;
}
