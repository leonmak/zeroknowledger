// Linking app accounts to unique people.
//
//   app                         registry                         user
//   POST /apps/:app/challenges ─► code, /bind?code=… link
//                                                     ◄── opens link, proves
//                                                         Singpass (unique person)
//                               issuer: completeChallenge()
//                               (moving from another subject → user confirms)
//   ◄── webhook / GET status: pairwise id for the subject
//
// Per app, a person holds one subject and a subject one person. Apps only
// ever see a pairwise id, so two apps can't tell they share a user.
import { hmacHex, type Env } from "./issuer.ts";

export const CHALLENGE_TTL_MS = 15 * 60_000;
const DAY_MS = 86_400_000;

export type AppsEnv = Env & { ADMIN_TOKEN?: string; SITE_URL: string };

type App = {
  app_id: string;
  name: string;
  api_key_hash: string;
  webhook_url: string | null;
  webhook_secret: string;
  cooldown_days: number;
};

type Challenge = {
  code: string;
  app_id: string;
  subject: string;
  expires_at: number;
  status: "pending" | "needs_confirmation" | "completed" | "rejected";
  person: string | null;
  move_from: string | null;
  reason: string | null;
  pairwise_id: string | null;
};

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type" };

const randomToken = (bytes: number) =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function pairwiseId(key: string, appId: string, person: string): Promise<string> {
  return (await hmacHex(key, `pairwise\n${appId}\n${person}`)).slice(0, 32);
}

/** Routes for apps and the bind page. Returns null for paths it doesn't own. */
export async function handleAppsRequest(request: Request, env: AppsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const method = request.method;

  if (method === "OPTIONS" && (parts[0] === "challenges" || parts[0] === "verify")) return new Response(null, { headers: CORS });

  // Admin: register an app. Returns its API key and webhook secret once.
  if (parts.length === 1 && parts[0] === "apps" && method === "POST") {
    if (!env.ADMIN_TOKEN || !safeEqual(bearer(request), env.ADMIN_TOKEN)) return json({ error: "unauthorized" }, 401);
    const body = (await request.json()) as { app_id?: string; name?: string; webhook_url?: string; cooldown_days?: number };
    if (!body.app_id || !/^[a-z0-9][a-z0-9:._-]{1,99}$/.test(body.app_id) || !body.name) {
      return json({ error: "app_id (lowercase, [a-z0-9:._-]) and name are required" }, 400);
    }
    if (body.webhook_url && !/^https:\/\//.test(body.webhook_url)) return json({ error: "webhook_url must be https" }, 400);
    const apiKey = `zk_${randomToken(32)}`;
    const webhookSecret = randomToken(32);
    const inserted = await env.DB.prepare(
      `INSERT INTO apps (app_id, name, api_key_hash, webhook_url, webhook_secret, cooldown_days, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT (app_id) DO NOTHING`,
    )
      .bind(body.app_id, body.name, await sha256Hex(apiKey), body.webhook_url ?? null, webhookSecret, body.cooldown_days ?? 30, Date.now())
      .run();
    if (!inserted.meta.changes) return json({ error: "app_id already registered" }, 409);
    return json({ app_id: body.app_id, api_key: apiKey, webhook_secret: webhookSecret }, 201);
  }

  // App API, authenticated with the app's key.
  if (parts[0] === "apps" && parts.length >= 3) {
    const app = await authApp(request, env, parts[1]);
    if (!app) return json({ error: "unauthorized" }, 401);

    if (parts.length === 3 && parts[2] === "challenges" && method === "POST") {
      const { subject } = (await request.json()) as { subject?: string };
      if (!subject || subject.length > 200) return json({ error: "subject is required" }, 400);
      const code = randomToken(16);
      const now = Date.now();
      await env.DB.prepare(
        "INSERT INTO challenges (code, app_id, subject, created_at, expires_at, status) VALUES (?1, ?2, ?3, ?4, ?5, 'pending')",
      )
        .bind(code, app.app_id, subject, now, now + CHALLENGE_TTL_MS)
        .run();
      return json({ code, url: `${env.SITE_URL}/bind?code=${code}`, expires_at: now + CHALLENGE_TTL_MS }, 201);
    }

    if (parts.length === 4 && parts[2] === "challenges" && method === "GET") {
      const ch = await getChallenge(env.DB, parts[3]);
      if (!ch || ch.app_id !== app.app_id) return json({ error: "not found" }, 404);
      return json({ code: ch.code, subject: ch.subject, status: effectiveStatus(ch), pairwise_id: ch.pairwise_id, reason: ch.reason });
    }

    // Current link for one of the app's subjects: how apps re-check.
    if (parts.length === 4 && parts[2] === "subjects" && method === "GET") {
      const row = await env.DB.prepare("SELECT person, bound_at, rebind_count FROM bindings WHERE app_id = ?1 AND subject = ?2")
        .bind(app.app_id, parts[3])
        .first<{ person: string; bound_at: number; rebind_count: number }>();
      if (!row) return json({ subject: parts[3], bound: false }, 404);
      const pairwise = await pairwiseId(env.NULLIFIER_KEY!, app.app_id, row.person);
      return json({
        subject: parts[3],
        bound: true,
        pairwise_id: pairwise,
        verify_url: verifyUrl(env, app.app_id, pairwise),
        bound_at: row.bound_at,
        rebind_count: row.rebind_count,
      });
    }
    return json({ error: "not found" }, 404);
  }

  // Public, for the bind page: what the user is being asked to do.
  if (parts[0] === "challenges" && parts.length === 2 && method === "GET") {
    const ch = await getChallenge(env.DB, parts[1]);
    if (!ch) return json({ error: "not found" }, 404, CORS);
    const app = await env.DB.prepare("SELECT name FROM apps WHERE app_id = ?1").bind(ch.app_id).first<{ name: string }>();
    return json(
      {
        app_id: ch.app_id,
        app_name: app?.name ?? ch.app_id,
        subject: ch.subject,
        status: effectiveStatus(ch),
        expires_at: ch.expires_at,
        move_from: ch.status === "needs_confirmation" ? ch.move_from : null,
        reason: ch.reason,
      },
      200,
      CORS,
    );
  }

  // Public: is this app-specific id linked to a unique person right now? Backs
  // the badge link an app shows. Returns nothing about the person or the
  // app's account id, only the app, the badge and since when.
  if (parts[0] === "verify" && parts.length === 3 && method === "GET") {
    if (!/^[0-9a-f]{32}$/.test(parts[2])) return json({ verified: false }, 404, CORS);
    const row = await env.DB.prepare(
      "SELECT b.bound_at, a.name FROM bindings b JOIN apps a USING (app_id) WHERE b.app_id = ?1 AND b.pairwise_id = ?2",
    )
      .bind(parts[1], parts[2])
      .first<{ bound_at: number; name: string }>();
    if (!row) return json({ verified: false }, 404, CORS);
    return json(
      { verified: true, badge: "identity/singpass-unique-person", app_id: parts[1], app_name: row.name, since: row.bound_at },
      200,
      CORS,
    );
  }

  // Public: the user agrees to move their link from another subject.
  if (parts[0] === "challenges" && parts.length === 3 && parts[2] === "confirm" && method === "POST") {
    const ch = await getChallenge(env.DB, parts[1]);
    if (!ch || effectiveStatus(ch) !== "needs_confirmation" || !ch.person) {
      return json({ error: "nothing to confirm" }, 409, CORS);
    }
    const result = await bind(env, ch, ch.person, Date.now());
    return json(result, result.status === "completed" ? 200 : 409, CORS);
  }

  return null;
}

/**
 * Called by the issuer after a verified unique-person proof that carried a
 * challenge code. Binds right away unless that moves the person away from
 * another subject, which the user must confirm on the bind page first.
 */
export async function completeChallenge(env: AppsEnv, code: string, person: string, now = Date.now()) {
  const ch = await getChallenge(env.DB, code);
  if (!ch) return { status: "rejected" as const, reason: "unknown challenge" };
  if (effectiveStatus(ch, now) !== "pending") return { status: "rejected" as const, reason: `challenge is ${effectiveStatus(ch, now)}` };

  const current = await env.DB.prepare("SELECT subject FROM bindings WHERE app_id = ?1 AND person = ?2")
    .bind(ch.app_id, person)
    .first<{ subject: string }>();
  if (current && current.subject !== ch.subject) {
    const blocked = await cooldownReason(env.DB, ch.app_id, person, now);
    if (blocked) return reject(env.DB, ch.code, blocked);
    await env.DB.prepare("UPDATE challenges SET status = 'needs_confirmation', person = ?2, move_from = ?3 WHERE code = ?1")
      .bind(ch.code, person, current.subject)
      .run();
    return { status: "needs_confirmation" as const };
  }
  return bind(env, ch, person, now);
}

async function bind(env: AppsEnv, ch: Challenge, person: string, now: number) {
  const app = await env.DB.prepare("SELECT * FROM apps WHERE app_id = ?1").bind(ch.app_id).first<App>();
  if (!app) return reject(env.DB, ch.code, "app no longer registered");
  const existing = await env.DB.prepare("SELECT subject, bound_at, rebind_count FROM bindings WHERE app_id = ?1 AND person = ?2")
    .bind(ch.app_id, person)
    .first<{ subject: string; bound_at: number; rebind_count: number }>();
  const moving = existing && existing.subject !== ch.subject;
  if (moving) {
    // Re-checked here too: the confirm step can come later.
    const blocked = await cooldownReason(env.DB, ch.app_id, person, now);
    if (blocked) return reject(env.DB, ch.code, blocked);
  }
  const displaced = await env.DB.prepare("SELECT person FROM bindings WHERE app_id = ?1 AND subject = ?2 AND person != ?3")
    .bind(ch.app_id, ch.subject, person)
    .first<{ person: string }>();

  const pairwise = await pairwiseId(env.NULLIFIER_KEY!, ch.app_id, person);
  await env.DB.batch([
    // Whoever this subject belonged to before is unlinked from it.
    env.DB.prepare("DELETE FROM bindings WHERE app_id = ?1 AND subject = ?2 AND person != ?3").bind(ch.app_id, ch.subject, person),
    existing
      ? env.DB.prepare(
          "UPDATE bindings SET subject = ?3, pairwise_id = ?5, bound_at = CASE WHEN subject = ?3 THEN bound_at ELSE ?4 END, rebind_count = rebind_count + CASE WHEN subject = ?3 THEN 0 ELSE 1 END WHERE app_id = ?1 AND person = ?2",
        ).bind(ch.app_id, person, ch.subject, now, pairwise)
      : env.DB.prepare(
          "INSERT INTO bindings (app_id, person, subject, bound_at, rebind_count, pairwise_id) VALUES (?1, ?2, ?3, ?4, 0, ?5)",
        ).bind(ch.app_id, person, ch.subject, now, pairwise),
    env.DB.prepare("UPDATE challenges SET status = 'completed', pairwise_id = ?2, person = NULL WHERE code = ?1").bind(ch.code, pairwise),
  ]);

  const events: object[] = [];
  if (moving) events.push({ type: "unbound", app_id: app.app_id, subject: existing.subject, reason: "person moved to another subject", at: now });
  events.push({
    type: "bound",
    app_id: app.app_id,
    subject: ch.subject,
    pairwise_id: pairwise,
    verify_url: verifyUrl(env, app.app_id, pairwise),
    replaced_other_person: Boolean(displaced),
    rebind_count: (existing?.rebind_count ?? 0) + (moving ? 1 : 0),
    at: now,
  });
  await Promise.all(events.map((e) => sendWebhook(app, e)));
  return { status: "completed" as const, pairwise_id: pairwise };
}

/** Public page an app can link its badge to; shows only "verified for this app". */
export const verifyUrl = (env: AppsEnv, appId: string, pairwise: string) =>
  // App ids are [a-z0-9:._-] (checked on registration), all valid in a path: no escaping needed.
  `${env.SITE_URL}/singpass/verified/${appId}/${pairwise}`;

async function cooldownReason(db: D1Database, appId: string, person: string, now: number): Promise<string | null> {
  const row = await db
    .prepare("SELECT b.bound_at, a.cooldown_days FROM bindings b JOIN apps a USING (app_id) WHERE b.app_id = ?1 AND b.person = ?2")
    .bind(appId, person)
    .first<{ bound_at: number; cooldown_days: number }>();
  if (!row) return null;
  const next = row.bound_at + row.cooldown_days * DAY_MS;
  return now < next ? `already linked to another account here; it can move after ${new Date(next).toISOString().slice(0, 10)}` : null;
}

async function reject(db: D1Database, code: string, reason: string) {
  await db.prepare("UPDATE challenges SET status = 'rejected', reason = ?2, person = NULL WHERE code = ?1").bind(code, reason).run();
  return { status: "rejected" as const, reason };
}

async function sendWebhook(app: App, event: object): Promise<void> {
  if (!app.webhook_url) return;
  const body = JSON.stringify(event);
  const signature = await hmacHex(app.webhook_secret, body);
  try {
    const res = await fetch(app.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-ZK-Signature": `sha256=${signature}` },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.log(`webhook to ${app.app_id} returned ${res.status}`);
  } catch (e) {
    // Apps can always re-check with GET /apps/:app/subjects/:subject.
    console.log(`webhook to ${app.app_id} failed: ${e}`);
  }
}

function effectiveStatus(ch: Challenge, now = Date.now()): string {
  if ((ch.status === "pending" || ch.status === "needs_confirmation") && now > ch.expires_at) return "expired";
  return ch.status;
}

const getChallenge = (db: D1Database, code: string) =>
  db.prepare("SELECT * FROM challenges WHERE code = ?1").bind(code).first<Challenge>();

async function authApp(request: Request, env: AppsEnv, appId: string): Promise<App | null> {
  const key = bearer(request);
  if (!key) return null;
  const app = await env.DB.prepare("SELECT * FROM apps WHERE app_id = ?1").bind(appId).first<App>();
  return app && safeEqual(app.api_key_hash, await sha256Hex(key)) ? app : null;
}

const bearer = (request: Request) => request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers });
