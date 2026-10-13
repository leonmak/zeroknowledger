import assert from "node:assert/strict";
import { test } from "node:test";
import { completeChallenge } from "../src/apps.ts";
import { DEMO_APP, handleDemo } from "../src/demo.ts";
import { testDb } from "./d1.ts";

const env = () => ({ DB: testDb(), NULLIFIER_KEY: "k", ADMIN_TOKEN: "admin", SITE_URL: "https://site" });
const call = async (e: ReturnType<typeof env>, method: string, path: string, body?: unknown) => {
  const res = (await handleDemo(new Request(`https://v${path}`, { method, body: body ? JSON.stringify(body) : undefined }), e))!;
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

test("the Example App links a demo account like a real app would", async () => {
  const e = env();
  assert.deepEqual((await call(e, "GET", "/demo/subjects/demo-abcd1234")).body, { bound: false });
  const ch = await call(e, "POST", "/demo/challenges", { subject: "demo-abcd1234" });
  assert.equal(ch.status, 201);
  assert.match(ch.body.url as string, /^https:\/\/site\/bind\?code=[0-9a-f]{32}$/);
  // The unique-person proof completes the challenge (as finishPersonProof does).
  assert.equal((await completeChallenge(e, ch.body.code as string, "person-1")).status, "completed");
  const sub = await call(e, "GET", "/demo/subjects/demo-abcd1234");
  assert.equal(sub.body.bound, true);
  assert.match(sub.body.pairwise_id as string, /^[0-9a-f]{32}$/);
  assert.equal(sub.body.verify_url, `https://site/singpass/verified/${DEMO_APP}/${sub.body.pairwise_id}`);
});

test("demo endpoints only act for demo subjects", async () => {
  const e = env();
  assert.equal((await call(e, "POST", "/demo/challenges", { subject: "user:alice" })).status, 400);
  assert.equal((await call(e, "GET", "/demo/subjects/user:alice")).status, 404);
});
