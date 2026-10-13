#!/usr/bin/env node
// Plays the part of an app (e.g. a Discord bot) against the registry.
//
//   node scripts/app.mjs register <app_id> <name> [--webhook https://…] [--cooldown <days>]
//   node scripts/app.mjs link <app_id> <subject>     # prints a /bind link, waits for the result
//   node scripts/app.mjs check <app_id> <subject>    # current link for a subject
//
// register needs ADMIN_TOKEN (env or .admin-token). Keys are kept in .apps/
// (gitignored). VERIFIER_URL defaults to the deployed verifier.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const VERIFIER_URL = process.env.VERIFIER_URL ?? "https://api.zeroknowledger.com";
const dir = new URL("../.apps/", import.meta.url);
const keyFile = (appId) => new URL(`${appId.replace(/[^a-z0-9._-]/g, "_")}.json`, dir);

const [cmd, appId, arg, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : rest[i + 1];
};

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${VERIFIER_URL}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

function appKey(id) {
  if (!existsSync(keyFile(id))) throw new Error(`no key for ${id}; run register first`);
  return JSON.parse(readFileSync(keyFile(id), "utf8")).api_key;
}

if (cmd === "register" && appId && arg) {
  const admin =
    process.env.ADMIN_TOKEN ?? (existsSync(new URL("../.admin-token", import.meta.url)) ? readFileSync(new URL("../.admin-token", import.meta.url), "utf8").trim() : "");
  const cooldown = flag("cooldown");
  const { status, body } = await api("POST", "/apps", {
    token: admin,
    body: { app_id: appId, name: arg, webhook_url: flag("webhook"), cooldown_days: cooldown === undefined ? undefined : Number(cooldown) },
  });
  if (status !== 201) throw new Error(`${status}: ${JSON.stringify(body)}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(keyFile(appId), JSON.stringify(body, null, 2) + "\n", { mode: 0o600 });
  console.log(`registered ${appId}; key saved to .apps/`);
} else if (cmd === "link" && appId && arg) {
  const token = appKey(appId);
  const { status, body } = await api("POST", `/apps/${encodeURIComponent(appId)}/challenges`, { token, body: { subject: arg } });
  if (status !== 201) throw new Error(`${status}: ${JSON.stringify(body)}`);
  console.log(`Send this to ${arg}:\n  ${body.url}\n(expires ${new Date(body.expires_at).toLocaleTimeString()})\nwaiting…`);
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = (await api("GET", `/apps/${encodeURIComponent(appId)}/challenges/${body.code}`, { token })).body;
    if (s.status === "completed") {
      console.log(`✓ linked ${arg} → pairwise id ${s.pairwise_id}`);
      break;
    }
    if (s.status === "rejected" || s.status === "expired") {
      console.log(`✗ ${s.status}${s.reason ? `: ${s.reason}` : ""}`);
      break;
    }
  }
} else if (cmd === "check" && appId && arg) {
  const { body } = await api("GET", `/apps/${encodeURIComponent(appId)}/subjects/${encodeURIComponent(arg)}`, { token: appKey(appId) });
  console.log(JSON.stringify(body, null, 2));
} else {
  console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 11).join("\n"));
  process.exitCode = 1;
}
