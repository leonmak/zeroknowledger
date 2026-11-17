import { test } from "node:test";
import assert from "node:assert/strict";
import { testDb } from "./d1.ts";
import { handleAge, completeAge, digest, AGE_TEMPLATE } from "../src/age.ts";
import { issue, type Webhook } from "../src/issuer.ts";

const now = Date.now();
const secret = "s".repeat(64), verifier = "a".repeat(64);
function setup() {
  const env = { DB: testDb(), RETROCHAT_AGE_SECRET: secret, RETROCHAT_RETURN_URL: "https://chat.test/retro-chat/", SITE_URL: "https://zk.test" };
  const call = async (path: string, body?: unknown, key = secret, at = now) => {
    const res = await handleAge(new Request(`https://api.test${path}`, {
      method: body === undefined ? "GET" : "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), env, at);
    return { status: res!.status, body: await res!.json() as Record<string, any> };
  };
  const start = async () => (await call('/age/requests', { challenge: await digest(verifier), room: 'ABCD' })).body.id as string;
  return { env, call, start };
}
function proof(id: string, under15 = false): Webhook {
  return { server_name: 'portal.singpass.gov.sg', session: { id: 'verified-session', holder: 'holder-secret', age_request: id }, transcript: {
    sent: 'GET /home/api/secured/profile-update-details HTTP/1.1\r\n',
    recv: `HTTP/1.1 200 OK\r\nDate: ${new Date(now).toUTCString()}\r\n\r\n{"status":"SUCCESS","result":{"is_u15_user":${under15}}}`,
  } };
}
test('age callback needs a matching verified proof and consumes the code once', async () => {
  const t = setup(), id = await t.start();
  assert.equal((await t.call('/age/exchange', { id, verifier })).status, 202);
  assert.equal((await issue(proof(id, true), t.env, now)).ok, false);
  assert.equal((await t.call(`/age/requests/${id}`)).body.ready, false);
  assert.equal((await issue(proof(id), t.env, now)).ok, true);
  const meta = (await t.call(`/age/requests/${id}`)).body;
  assert.equal(meta.ready, true);
  assert.equal(new URL(meta.returnUrl).origin, 'https://chat.test');
  assert.equal(new URL(meta.returnUrl).searchParams.get('room'), 'ABCD');
  assert.equal((await t.call('/age/exchange', { id, verifier: 'b'.repeat(64) })).status, 410);
  const results = await Promise.all([t.call('/age/exchange', { id, verifier }), t.call('/age/exchange', { id, verifier })]);
  assert.deepEqual(results.map(x => x.status).sort(), [200, 410]);
  assert.equal(results.find(x => x.status === 200)!.body.minimumAge, 15);
  assert.equal((await issue(proof(id), t.env, now)).ok, false);
});
test('client auth and fixed return destination prevent untrusted requests and redirects', async () => {
  const t = setup();
  assert.equal((await t.call('/age/requests', { challenge: await digest(verifier), room: 'ABCD' }, 'wrong')).status, 401);
  const r = await t.call('/age/requests', { challenge: await digest(verifier), room: 'ABCD', returnUrl: 'https://evil.test' });
  assert.equal(r.status, 201);
  assert.match((await t.call(`/age/requests/${r.body.id}`)).body.returnUrl, /^https:\/\/chat.test\//);
  assert.equal((await t.call('/age/exchange', { id: r.body.id, verifier }, 'wrong')).status, 401);
});
test('a request without a room returns to the app itself; a bad room is refused', async () => {
  const t = setup();
  const r = await t.call('/age/requests', { challenge: await digest(verifier) });
  assert.equal(r.status, 201);
  const back = new URL((await t.call(`/age/requests/${r.body.id}`)).body.returnUrl);
  assert.equal(back.searchParams.get('room'), null);
  assert.equal(back.searchParams.get('age_request'), r.body.id);
  assert.equal((await t.call('/age/requests', { challenge: await digest(verifier), room: 'bad room' })).status, 400);
});
test('expired requests, older proofs and wrong badge types cannot grant age', async () => {
  const t = setup(), id = await t.start();
  assert.equal(await completeAge(t.env.DB, id, AGE_TEMPLATE, now - 60_000, now), false);
  assert.equal(await completeAge(t.env.DB, id, 'identity/singpass-unique-person', now, now), false);
  assert.equal(await completeAge(t.env.DB, id, AGE_TEMPLATE, now, now + 21 * 60_000), false);
  assert.equal((await t.call(`/age/requests/${id}`, undefined, secret, now + 21 * 60_000)).status, 410);
});
test('a proof cannot complete a different pending request', async () => {
  const t = setup(), a = await t.start(), b = await t.start();
  await issue(proof(a), t.env, now);
  assert.equal((await t.call('/age/exchange', { id: b, verifier })).status, 202);
});
