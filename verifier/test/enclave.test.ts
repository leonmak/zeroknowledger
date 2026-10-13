import assert from "node:assert/strict";
import { test } from "node:test";
import { assertClaims } from "../src/enclave.ts";

const DIGEST = "sha256:" + "a".repeat(64);
const env = { ENCLAVE_IMAGE_DIGESTS: `sha256:${"b".repeat(64)}, ${DIGEST}` };
const NOW = 1_800_000_000_000;
const good = {
  iss: "https://confidentialcomputing.googleapis.com",
  aud: "zeroknowledger-registry",
  exp: NOW / 1000 + 600,
  swname: "CONFIDENTIAL_SPACE",
  hwmodel: "GCP_INTEL_TDX",
  dbgstat: "disabled-since-boot",
  submods: { container: { image_digest: DIGEST } },
};

test("accepts a production TDX Confidential Space token for a published image", () => {
  assert.doesNotThrow(() => assertClaims(good, env, NOW));
});

for (const [why, patch] of [
  ["issuer", { iss: "https://evil.example" }],
  ["audience", { aud: "someone-else" }],
  ["expired", { exp: NOW / 1000 - 1 }],
  ["not Confidential Space", { swname: "GCE" }],
  ["not Intel TDX", { hwmodel: "GCP_AMD_SEV" }],
  ["debug image", { dbgstat: "enabled" }],
  ["image digest not published", { submods: { container: { image_digest: "sha256:" + "c".repeat(64) } } }],
] as const) {
  test(`rejects a token failing: ${why}`, () => {
    assert.throws(() => assertClaims({ ...good, ...patch }, env, NOW), new RegExp(why));
  });
}
