// OpenCerts selective disclosure, browser side. The certificate is read and
// hashed here; only the fields a method reveals leave the device, everything
// else goes as salted hashes. Must hash exactly like verifier/src/opencerts.ts
// (which is OpenAttestation's scheme).
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex } from "@noble/hashes/utils";
import { REGISTRY_URL } from "./config";
import { holderSecret } from "./holder";

export type Disclosure = {
  schema?: string;
  revealed: Record<string, unknown>;
  obfuscated: string[];
  signature: { type: string; targetHash: string; proof: string[]; merkleRoot: string };
};

export type Field = { path: string; value: string | null; hash: string; raw: unknown };

export type Certificate = {
  schema?: string;
  fields: Field[];
  obfuscated: string[];
  signature: Disclosure["signature"];
};

const keccakHex = (s: string) => bytesToHex(keccak_256(new TextEncoder().encode(s)));
const SALTED = /^[0-9a-f-]{36}:(string|number|boolean|null|undefined):(.*)$/s;

/** OpenAttestation flattening (the `flat` package): dot paths, array indexes, empty containers kept as values. */
function flatten(v: unknown, prefix = "", out: Record<string, unknown> = {}) {
  const entries = v !== null && typeof v === "object" ? Object.entries(v as object) : [];
  if (entries.length === 0) {
    if (prefix) out[prefix] = v;
    return out;
  }
  for (const [k, x] of entries) flatten(x, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

export class CertificateError extends Error {}

/** Parses a .opencert file and checks its fields hash to its signed targetHash. */
export function readCertificate(text: string): Certificate {
  let doc: { schema?: string; version?: string; data?: unknown; privacy?: { obfuscatedData?: string[] }; signature?: Disclosure["signature"] };
  try {
    doc = JSON.parse(text);
  } catch {
    throw new CertificateError("That file isn't an OpenCerts certificate (not JSON).");
  }
  if (!doc.data || doc.signature?.type !== "SHA3MerkleProof")
    throw new CertificateError("That file isn't a supported OpenCerts certificate (no SHA3MerkleProof signature).");

  const fields = Object.entries(flatten(doc.data)).map(([path, raw]) => ({
    path,
    raw,
    value: typeof raw === "string" ? (SALTED.exec(raw)?.[2] ?? null) : null,
    hash: keccakHex(JSON.stringify({ [path]: raw })),
  }));
  const obfuscated = doc.privacy?.obfuscatedData ?? [];
  if (keccakHex(JSON.stringify([...fields.map((f) => f.hash), ...obfuscated].sort())) !== doc.signature.targetHash)
    throw new CertificateError("This certificate has been modified: its contents don't match its signature.");
  return { schema: doc.schema ?? doc.version, fields, obfuscated, signature: doc.signature };
}

/** Reveal only `keep`; every other field is replaced by its hash. */
export function disclose(cert: Certificate, keep: Set<string>): Disclosure {
  const revealed: Record<string, unknown> = {};
  const obfuscated = [...cert.obfuscated];
  for (const f of cert.fields) {
    if (keep.has(f.path)) revealed[f.path] = f.raw;
    else obfuscated.push(f.hash);
  }
  return { schema: cert.schema, revealed, obfuscated, signature: cert.signature };
}

export type IssueResult =
  | { ok: true; badge: { label: string; icon: string; color: string }; holder: string }
  | { ok: false; reason: string; retry?: boolean };

export async function requestBadge(methodId: string, disclosure: Disclosure): Promise<IssueResult> {
  const res = await fetch(`${REGISTRY_URL}/opencerts/${methodId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holder: holderSecret(), disclosure }),
  });
  return (await res.json().catch(() => ({ ok: false, reason: `verifier returned ${res.status}` }))) as IssueResult;
}
