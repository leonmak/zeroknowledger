// Sealing commitment openings to the attested enclave (verifier/gcp/enclave).
//
// The openings are the committed NRIC/mobile bytes and their blinders, so they
// must only reach the enclave. We check the enclave's Google Confidential
// Space attestation here, in the browser, then HPKE-encrypt to the key it
// binds. The registry Worker and Cloudflare only relay ciphertext.
import { Aes256Gcm, CipherSuite, HkdfSha256 } from "@hpke/core";
import { DhkemX25519HkdfSha256 } from "@hpke/dhkem-x25519";
import publishedDigests from "../../verifier/gcp/published-digests.txt?raw";

const ISSUER = "https://confidentialcomputing.googleapis.com";
// Google's signing keys for Confidential Space tokens. (The discovery document
// that points here doesn't allow cross-origin reads; this URL does.)
const JWKS = "https://www.googleapis.com/service_accounts/v1/metadata/jwk/signer@confidentialspace-sign.iam.gserviceaccount.com";
const AUDIENCE = "zeroknowledger-registry";
const DIGESTS = publishedDigests.split("\n").map((d) => d.trim()).filter(Boolean);

// Must match the enclave (issuer.mjs).
const hpke = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
const HPKE_INFO = new TextEncoder().encode("zeroknowledger person proof v1");

export type SealedProof = { sealed: { enc: string; ct: string } };

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (s: string) => b64(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

type Claims = {
  iss: string;
  aud: string | string[];
  exp: number;
  swname?: string;
  hwmodel?: string;
  dbgstat?: string;
  eat_nonce?: string | string[];
  submods?: { container?: { image_digest?: string }; confidential_space?: { support_attributes?: string[] } };
};

async function verifyToken(token: string): Promise<Claims> {
  const [h, p, sig] = token.split(".");
  const header = JSON.parse(new TextDecoder().decode(b64url(h))) as { alg: string; kid: string };
  if (header.alg !== "RS256") throw new Error("unexpected attestation algorithm");
  const { keys } = (await (await fetch(JWKS)).json()) as { keys: (JsonWebKey & { kid: string })[] };
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("attestation signed with an unknown Google key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(sig), new TextEncoder().encode(`${h}.${p}`)))) {
    throw new Error("attestation signature invalid");
  }
  return JSON.parse(new TextDecoder().decode(b64url(p))) as Claims;
}

/**
 * The enclave's encryption key, after checking that Google attests it belongs
 * to a published enclave image running in production Confidential Space on
 * Intel TDX with debugging off.
 */
async function attestedKey(enclaveUrl: string) {
  const res = await fetch(`${enclaveUrl}/enclave/attestation`);
  if (!res.ok) throw new Error(`enclave attestation ${res.status}`);
  const { public_key, encryption_key, token } = (await res.json()) as { public_key: string; encryption_key?: string; token: string };
  if (!encryption_key) throw new Error("this enclave can't receive sealed proofs");
  const c = await verifyToken(token);
  const fail = (why: string) => {
    throw new Error(`enclave attestation rejected: ${why}`);
  };
  if (c.iss !== ISSUER) fail("issuer");
  if (!(Array.isArray(c.aud) ? c.aud : [c.aud]).includes(AUDIENCE)) fail("audience");
  if (c.exp * 1000 < Date.now()) fail("expired");
  if (c.swname !== "CONFIDENTIAL_SPACE") fail("not Confidential Space");
  if (!c.submods?.confidential_space?.support_attributes?.includes("STABLE")) fail("not a production image");
  if (c.hwmodel !== "GCP_INTEL_TDX") fail("not Intel TDX");
  if (c.dbgstat !== "disabled-since-boot") fail("debugging enabled");
  if (!DIGESTS.includes(c.submods?.container?.image_digest ?? "")) fail("image isn't a published build");
  const raw = b64(encryption_key);
  const nonce = hex(await crypto.subtle.digest("SHA-256", new Uint8Array([...b64(public_key), ...raw])));
  if (!(Array.isArray(c.eat_nonce) ? c.eat_nonce : [c.eat_nonce]).includes(nonce)) fail("key isn't the attested one");
  return hpke.kem.deserializePublicKey(raw.buffer as ArrayBuffer);
}

/** Encrypts `payload` so only the attested enclave can read it, bound to `proofId`. */
export async function sealToEnclave(enclaveUrl: string, proofId: string, payload: unknown): Promise<SealedProof> {
  const recipientPublicKey = await attestedKey(enclaveUrl);
  const { enc, ct } = await hpke.seal(
    { recipientPublicKey, info: HPKE_INFO },
    new TextEncoder().encode(JSON.stringify(payload)),
    new TextEncoder().encode(proofId),
  );
  return { sealed: { enc: toB64(new Uint8Array(enc)), ct: toB64(new Uint8Array(ct)) } };
}
