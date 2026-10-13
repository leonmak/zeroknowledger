// "Example App": a built-in demo of how a third-party app uses account links
// (apps.ts), so the flow can be tried from the site without registering an app.
//
// A real app creates challenges with its API key, server-side. The demo app has
// no usable key; instead these public endpoints act for it, and only for it:
// subjects are random demo-* ids the site keeps in the browser.
//
//   POST /demo/challenges {subject}  -> { code, url }        (like POST /apps/<id>/challenges)
//   GET  /demo/subjects/<subject>    -> { bound, pairwise_id, verify_url }
import { CHALLENGE_TTL_MS, pairwiseId, verifyUrl, type AppsEnv } from "./apps.ts";

export const DEMO_APP = "demo:example";
const SUBJECT = /^demo-[a-z0-9]{8,32}$/;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "Content-Type" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
const randomHex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Registers the demo app on first use. Its API key hash matches no key. */
async function ensureDemoApp(db: D1Database, now: number) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO apps (app_id, name, api_key_hash, webhook_url, webhook_secret, cooldown_days, created_at)
       VALUES (?1, 'Example App', ?2, NULL, ?3, 0, ?4)`,
    )
    .bind(DEMO_APP, randomHex(32), randomHex(32), now)
    .run();
}

export async function handleDemo(request: Request, env: AppsEnv, now = Date.now()): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith("/demo/")) return null;
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (pathname === "/demo/challenges" && request.method === "POST") {
    const { subject } = ((await request.json().catch(() => ({}))) ?? {}) as { subject?: string };
    if (typeof subject !== "string" || !SUBJECT.test(subject)) return json({ error: "subject must be demo-<8-32 lowercase letters/digits>" }, 400);
    await ensureDemoApp(env.DB, now);
    const code = randomHex(16);
    await env.DB.prepare(
      "INSERT INTO challenges (code, app_id, subject, created_at, expires_at, status) VALUES (?1, ?2, ?3, ?4, ?5, 'pending')",
    )
      .bind(code, DEMO_APP, subject, now, now + CHALLENGE_TTL_MS)
      .run();
    return json({ code, url: `${env.SITE_URL}/bind?code=${code}` }, 201);
  }

  const subject = /^\/demo\/subjects\/([^/]+)$/.exec(pathname)?.[1];
  if (subject && request.method === "GET") {
    if (!SUBJECT.test(subject)) return json({ bound: false }, 404);
    const row = await env.DB.prepare("SELECT person, bound_at FROM bindings WHERE app_id = ?1 AND subject = ?2")
      .bind(DEMO_APP, subject)
      .first<{ person: string; bound_at: number }>();
    if (!row) return json({ bound: false });
    const pairwise = await pairwiseId(env.NULLIFIER_KEY!, DEMO_APP, row.person);
    return json({ bound: true, pairwise_id: pairwise, verify_url: verifyUrl(env, DEMO_APP, pairwise), bound_at: row.bound_at });
  }
  return json({ error: "not found" }, 404);
}
