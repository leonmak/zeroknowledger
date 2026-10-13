// Talking to the attested enclave (gcp/enclave/issuer.mjs) when ENCLAVE_URL is set.
//
// The enclave signs every answer with an Ed25519 key made at boot. Before
// trusting that key, we check a Google Confidential Space attestation token:
// signed by Google, for our audience, from a production Confidential Space
// image on Intel TDX, running a container whose digest we published, and
// carrying sha256(signing key || encryption key) as its nonce. So a signature
// can only come from that exact code, in a TEE the operator can't read into.
// Person proofs arrive here sealed (HPKE) to the encryption key by the browser,
// which checks the same attestation (src/lib/enclave.ts); we only relay them.
import type { PersonRequest } from "./issuer.ts";

export type EnclaveEnv = {
  ENCLAVE_URL?: string;
  /** Comma-separated sha256:… digests of published enclave images. */
  ENCLAVE_IMAGE_DIGESTS?: string;
  ENCLAVE_AUDIENCE?: string;
};

const ISSUER = "https://confidentialcomputing.googleapis.com";
const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

type Claims = {
  iss: string;
  aud: string | string[];
  exp: number;
  swname?: string;
  hwmodel?: string;
  dbgstat?: string;
  eat_nonce?: string | string[];
  submods?: { container?: { image_digest?: string } };
};

let jwks: { keys: (JsonWebKey & { kid: string })[]; fetched: number } | null = null;
async function googleKey(kid: string): Promise<CryptoKey> {
  if (!jwks || Date.now() - jwks.fetched > 3600_000 || !jwks.keys.some((k) => k.kid === kid)) {
    const conf = (await (await fetch(`${ISSUER}/.well-known/openid-configuration`)).json()) as { jwks_uri: string };
    jwks = { ...((await (await fetch(conf.jwks_uri)).json()) as { keys: (JsonWebKey & { kid: string })[] }), fetched: Date.now() };
  }
  const jwk = jwks.keys.find((k) => k.kid === kid);
  if (!jwk) throw new Error(`unknown attestation signing key ${kid}`);
  return crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}

/** Checks a Confidential Space attestation token and returns its claims. */
export async function checkAttestation(token: string, env: EnclaveEnv, now = Date.now()): Promise<Claims> {
  const [h, p, sig] = token.split(".");
  const header = JSON.parse(new TextDecoder().decode(b64url(h))) as { alg: string; kid: string };
  if (header.alg !== "RS256") throw new Error(`unexpected alg ${header.alg}`);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", await googleKey(header.kid), b64url(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error("attestation signature invalid");
  const claims = JSON.parse(new TextDecoder().decode(b64url(p))) as Claims;
  assertClaims(claims, env, now);
  return claims;
}

/** The claim checks, separate so they can be tested without Google's keys. */
export function assertClaims(claims: Claims, env: EnclaveEnv, now = Date.now()) {
  const fail = (why: string) => {
    throw new Error(`attestation rejected: ${why}`);
  };
  const audience = env.ENCLAVE_AUDIENCE ?? "zeroknowledger-registry";
  const digests = (env.ENCLAVE_IMAGE_DIGESTS ?? "").split(",").map((d) => d.trim()).filter(Boolean);
  if (claims.iss !== ISSUER) fail("issuer");
  if (!(Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(audience)) fail("audience");
  if (claims.exp * 1000 < now) fail("expired");
  if (claims.swname !== "CONFIDENTIAL_SPACE") fail("not Confidential Space");
  if (claims.hwmodel !== "GCP_INTEL_TDX") fail("not Intel TDX");
  if (claims.dbgstat !== "disabled-since-boot") fail("debug image");
  if (!digests.includes(claims.submods?.container?.image_digest ?? "")) fail("image digest not published");
}

let enclaveKey: { key: CryptoKey; until: number } | null = null;

/** The enclave's current signing key, after checking its attestation. */
async function signingKey(env: EnclaveEnv): Promise<CryptoKey> {
  if (enclaveKey && Date.now() < enclaveKey.until) return enclaveKey.key;
  const res = await fetch(`${env.ENCLAVE_URL}/enclave/attestation`);
  if (!res.ok) throw new Error(`enclave attestation ${res.status}`);
  const { public_key, encryption_key, token } = (await res.json()) as { public_key: string; encryption_key: string; token: string };
  const claims = await checkAttestation(token, env);
  const raw = b64(public_key);
  const nonce = hex(await crypto.subtle.digest("SHA-256", new Uint8Array([...raw, ...b64(encryption_key ?? "")])));
  if (!(Array.isArray(claims.eat_nonce) ? claims.eat_nonce : [claims.eat_nonce]).includes(nonce)) {
    throw new Error("attestation rejected: nonce doesn't bind this key");
  }
  const key = await crypto.subtle.importKey("raw", raw, { name: "Ed25519" }, false, ["verify"]);
  enclaveKey = { key, until: Math.min(claims.exp * 1000, Date.now() + 10 * 60_000) };
  return key;
}

/** Whether `body` was signed by the attested enclave. */
export async function signedByEnclave(env: EnclaveEnv, body: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const check = async () => crypto.subtle.verify("Ed25519", await signingKey(env), b64(signature), new TextEncoder().encode(body));
  if (await check()) return true;
  // The enclave may have restarted with a new key: re-attest once.
  enclaveKey = null;
  return check();
}

/**
 * Relays the browser's sealed openings and asks the enclave for a person id;
 * its answer must carry a valid signature.
 */
export async function enclavePerson(env: EnclaveEnv, req: PersonRequest): Promise<{ person: string } | { reason: string }> {
  const res = await fetch(`${env.ENCLAVE_URL}/enclave/person`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proof_id: req.proofId, circuit: req.circuit, scope: req.scope, app: req.app, sealed: req.sealed }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`enclave person ${res.status}`);
  if (!(await signedByEnclave(env, body, res.headers.get("X-Enclave-Signature")))) throw new Error("enclave answer not signed");
  const out = JSON.parse(body) as { ok: boolean; proof_id: string; scope: string; app?: string; person?: string; reason?: string };
  if (out.proof_id !== req.proofId) throw new Error("enclave answered a different request");
  if (!out.ok || !out.person) return { reason: out.reason ?? "enclave refused" };
  // A person id is only valid for the scope it was keyed under.
  if (out.scope !== req.scope) throw new Error("enclave answered for a different scope");
  if (out.app !== req.app) throw new Error("enclave answered for a different app");
  return { person: out.person };
}
