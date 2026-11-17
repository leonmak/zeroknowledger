// Mailbox fingerprints for standupfor.xyz signer groups (the zkalumni project).
//
// Enrolling proves a DKIM-signed email sent from a work address (the zksender circuit). Its public
// nullifier is a hash of the address, which anyone can recompute for a guessed address, so only
// this enclave sees it: it returns HMAC(mailbox key, nullifier), a fingerprint that dedupes
// mailboxes but can't be recomputed without the sealed mailbox key.
//
// So that the enclave isn't a guessing oracle, it only fingerprints a proof that
//  - verifies, against a DKIM key the enclave fetched itself (DNS-over-HTTPS, TLS ends in here), and
//  - is over an email whose subject is the seven words derived from this enrollment's random code
//    and identity commitment. A subject can't be steered to match an old email, so the prover must
//    be able to send new mail from the address, not merely hold mail it once sent.
//
// Everything here mirrors zkalumni/shared (public-inputs.mjs, inputs.mjs, company-email-subject.mjs).
import { createHash, createPublicKey } from "node:crypto";
import WORDS from "./subject-words.json" with { type: "json" };

const N = 18, DOMAIN_MAX = 64, KEY_BITS = 2048;
export const PUBLIC_INPUT_COUNT = 2 * N + 1 + 1 + DOMAIN_MAX + 1; // modulus, redc, binding, nullifier, domain, len
export const NULLIFIER_INDEX = 2 * N + 1;
const SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/;

export const isCode = (s) => typeof s === "string" && /^[a-f0-9]{32}$/.test(s);
export const isDomain = (s) => typeof s === "string" && s.length <= DOMAIN_MAX && DOMAIN.test(s);
export const isSelector = (s) => typeof s === "string" && /^[A-Za-z0-9._-]{1,63}$/.test(s);
export const isCommitment = (s) => typeof s === "string" && /^[1-9][0-9]{0,77}$/.test(s) && BigInt(s) < SNARK_FIELD;

const limbs = (x) => Array.from({ length: N }, (_, i) => (x >> BigInt(120 * i)) & ((1n << 120n) - 1n));
const redc = (modulus) => (1n << BigInt(2 * KEY_BITS + 4)) / modulus;

/** The zksender circuit's public inputs, or null. */
export function readInputs(publicInputs) {
  if (!Array.isArray(publicInputs) || publicInputs.length !== PUBLIC_INPUT_COUNT) return null;
  if (!publicInputs.every((x) => typeof x === "string" && /^0x[0-9a-f]{64}$/i.test(x))) return null;
  const big = publicInputs.map((x) => BigInt(x));
  const len = Number(big[2 * N + 2 + DOMAIN_MAX]);
  if (len > DOMAIN_MAX) return null;
  const domainBytes = big.slice(2 * N + 2, 2 * N + 2 + len);
  if (domainBytes.some((b) => b > 127n)) return null;
  return {
    modulus: big.slice(0, N),
    redc: big.slice(N, 2 * N),
    binding: big[2 * N],
    nullifier: "0x" + big[NULLIFIER_INDEX].toString(16).padStart(64, "0"),
    domain: String.fromCharCode(...domainBytes.map(Number)),
  };
}

/** True if the proof's key limbs are exactly this RSA modulus. */
export const keyMatches = (inputs, modulus) =>
  [...limbs(modulus), ...limbs(redc(modulus))].every((x, i) => x === [...inputs.modulus, ...inputs.redc][i]);

/**
 * What the zkalumni Worker can check without the nullifier: every public input, the nullifier
 * blanked. The enclave signs it, so the Worker knows the enclave verified the same statement.
 */
export const inputsHash = (publicInputs) =>
  createHash("sha256")
    .update(publicInputs.map((x, i) => (i === NULLIFIER_INDEX ? 0n : BigInt(x)).toString(16).padStart(64, "0")).join(","))
    .digest("hex");

/** The seven-word enrollment subject for this code and commitment (zkalumni worker/groups.mjs). */
export async function enrollSubject(code, commitment, domain) {
  const namespace = domain ? `group-enroll:${domain}:${commitment}` : `group-enroll:${commitment}`;
  const digest = new DataView(createHash("sha256").update(`${namespace}:words:v1:${code}`).digest().buffer.slice(0));
  const words = [];
  for (let i = 0; i < 7; i++) words.push(WORDS[digest.getUint32(i * 4) % WORDS.length]);
  return words.join(" ");
}

/** The circuit's base-27 encoding of a word subject (space = 0, a..z = 1..26, from 1). */
export function wordBinding(subject) {
  let value = 1n;
  for (const char of subject) value = value * 27n + BigInt(char === " " ? 0 : char.charCodeAt(0) - 96);
  return value;
}

/** The domain's DKIM modulus for `selector`, from DNS-over-HTTPS (TLS-authenticated, ends in the enclave). */
export async function dnsModulus(domain, selector, doh) {
  const name = `${selector}._domainkey.${domain}`;
  const res = await fetch(`${doh}?name=${encodeURIComponent(name)}&type=TXT`, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`DNS ${res.status}`);
  const { Status, Answer = [] } = await res.json();
  if (Status !== 0) throw new Error(`DNS rcode ${Status}`);
  for (const a of Answer.filter((r) => r.type === 16)) {
    const txt = [...a.data.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\(.)/g, "$1")).join("");
    const p = /(?:^|;)\s*p=([^;]*)/.exec(txt)?.[1]?.replace(/\s+/g, "");
    if (!p) continue;
    const jwk = createPublicKey({ key: Buffer.from(p, "base64"), format: "der", type: "spki" }).export({ format: "jwk" });
    return BigInt("0x" + Buffer.from(jwk.n, "base64url").toString("hex"));
  }
  throw new Error(`no DKIM key at ${name}`);
}
