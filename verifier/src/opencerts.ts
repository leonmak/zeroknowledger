// OpenCerts / OpenAttestation selective disclosure (registry proof type "opencerts").
//
// The browser (src/lib/opencerts.ts on the site) hides every field of the
// certificate except the ones a method reveals, and sends:
//   { revealed: { "<flattened path>": "<salt>:<type>:<value>" }, obfuscated: [field hashes], signature }
// We check, the same way OpenAttestation does:
//   1. targetHash = keccak256(JSON of the sorted hashes of every field, revealed or not)
//   2. the Merkle path from targetHash reaches signature.merkleRoot
//   3. the method's pinned certificate store issued that root, and neither the
//      root nor the certificate is revoked (Ethereum, via the injected `chain`)
//   4. exactly the method's required (and allowed optional) fields are revealed,
//      and the revealed store address is the pinned one
// Uniqueness is HMAC(NULLIFIER_KEY, scope ‖ targetHash): the targetHash commits
// to salted fields, so it can't be guessed from a name or student ID.
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { hmacHex, holderId, upsertBadge } from "./issuer.ts";
import nusGraduate from "../../registry/methods/education/nus-graduate/0.1.0.json" with { type: "json" };

export type OpenCertsConfig = {
  issuer: { name: string; network: "ethereum-mainnet"; certificate_store: string };
  schemas?: string[];
  reveal: { required: string[]; optional?: string[] };
};

export type OpenCertsMethod = {
  id: string;
  version: string;
  nullifier: { scope: string };
  badge: { label: string; icon: string; color: string };
  config: OpenCertsConfig;
};

/** Methods this verifier accepts, straight from the (immutable) registry versions. */
export const OPENCERTS_METHODS: Record<string, OpenCertsMethod> = {
  [nusGraduate.id]: nusGraduate as OpenCertsMethod,
};

export type Disclosure = {
  schema?: string;
  revealed: Record<string, unknown>;
  obfuscated: string[];
  signature: { type: string; targetHash: string; proof: string[]; merkleRoot: string };
};

export type Chain = {
  /** CertificateStore.isIssued(root) / isRevoked(hash) on the given store. */
  isIssued(store: string, root: string): Promise<boolean>;
  isRevoked(store: string, hash: string): Promise<boolean>;
};

export type Checked =
  | { ok: true; targetHash: string; revealed: Record<string, string> }
  | { ok: false; reason: string };

const HASH = /^[0-9a-f]{64}$/;
const SALTED = /^[0-9a-f-]{36}:(string|number|boolean|null|undefined):(.*)$/s;
const keccakHex = (data: string | Uint8Array) =>
  bytesToHex(keccak_256(typeof data === "string" ? new TextEncoder().encode(data) : data));

/** OpenAttestation's per-field hash: keccak256(JSON.stringify({ [path]: saltedValue })). */
export const fieldHash = (path: string, value: unknown) => keccakHex(JSON.stringify({ [path]: value }));

/** "salt:type:value" -> value, as the issuer wrote it. */
export function unsalt(value: unknown): string | null {
  return typeof value === "string" ? (SALTED.exec(value)?.[2] ?? null) : null;
}

export async function checkDisclosure(body: Disclosure, method: OpenCertsMethod, chain: Chain): Promise<Checked> {
  const { config } = method;
  const sig = body?.signature;
  if (!sig || sig.type !== "SHA3MerkleProof") return { ok: false, reason: "not a SHA3MerkleProof signature" };
  if (!HASH.test(sig.targetHash) || !HASH.test(sig.merkleRoot) || !Array.isArray(sig.proof) || !sig.proof.every((p) => HASH.test(p)))
    return { ok: false, reason: "malformed signature" };
  if (!Array.isArray(body.obfuscated) || !body.obfuscated.every((h) => HASH.test(h)))
    return { ok: false, reason: "malformed obfuscated hashes" };
  if (!body.revealed || typeof body.revealed !== "object") return { ok: false, reason: "no revealed fields" };
  if (config.schemas && !config.schemas.includes(body.schema ?? "")) return { ok: false, reason: `unsupported schema ${body.schema}` };

  // Only what the method declares, so a badge never carries more than it says.
  const allowed = new Set([...config.reveal.required, ...(config.reveal.optional ?? [])]);
  const paths = Object.keys(body.revealed);
  const extra = paths.filter((p) => !allowed.has(p));
  if (extra.length) return { ok: false, reason: `reveals fields this method doesn't use: ${extra.join(", ")}` };
  const missing = config.reveal.required.filter((p) => !(p in body.revealed));
  if (missing.length) return { ok: false, reason: `missing required fields: ${missing.join(", ")}` };

  const revealed: Record<string, string> = {};
  for (const p of paths) {
    const v = unsalt(body.revealed[p]);
    if (v === null) return { ok: false, reason: `field ${p} isn't a salted value` };
    revealed[p] = v;
  }

  // 1. every field's hash, revealed or hidden, makes up the certificate's targetHash
  const hashes = [...paths.map((p) => fieldHash(p, body.revealed[p])), ...body.obfuscated].sort();
  if (keccakHex(JSON.stringify(hashes)) !== sig.targetHash) return { ok: false, reason: "fields don't match the certificate's targetHash" };

  // 2. Merkle path: each step hashes the sorted pair of 32-byte nodes
  let node = sig.targetHash;
  for (const sibling of sig.proof) node = keccakHex(hexToBytes([node, sibling].sort().join("")));
  if (node !== sig.merkleRoot) return { ok: false, reason: "Merkle proof doesn't reach the root" };

  // 3. the pinned issuer's store issued this root; neither root nor certificate revoked
  const store = config.issuer.certificate_store;
  if (revealed["issuers.0.certificateStore"]?.toLowerCase() !== store.toLowerCase())
    return { ok: false, reason: `not issued through ${config.issuer.name}'s certificate store` };
  if (!(await chain.isIssued(store, sig.merkleRoot))) return { ok: false, reason: "batch isn't recorded as issued" };
  if ((await chain.isRevoked(store, sig.merkleRoot)) || (await chain.isRevoked(store, sig.targetHash)))
    return { ok: false, reason: "certificate has been revoked" };

  return { ok: true, targetHash: sig.targetHash, revealed };
}

const PUBLIC_RPCS = ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com", "https://cloudflare-eth.com"];
const selector = (signature: string) => keccakHex(signature).slice(0, 8);

/** CertificateStore reads over JSON-RPC eth_call. Tries ETH_RPC_URL, then public endpoints. */
export function ethereumChain(rpcUrl?: string): Chain {
  const call = async (store: string, signature: string, arg: string): Promise<boolean> => {
    const data = `0x${selector(signature)}${arg}`;
    let lastError = "no RPC reachable";
    for (const rpc of rpcUrl ? [rpcUrl] : PUBLIC_RPCS) {
      try {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: store, data }, "latest"] }),
        });
        const json = (await res.json()) as { result?: string; error?: { message: string } };
        if (json.result) return BigInt(json.result) === 1n;
        lastError = json.error?.message ?? `RPC ${res.status}`;
      } catch (e) {
        lastError = (e as Error).message;
      }
    }
    // An unreachable chain must not read as "not revoked".
    throw new Error(`Ethereum lookup failed: ${lastError}`);
  };
  return {
    isIssued: (store, root) => call(store, "isIssued(bytes32)", root),
    isRevoked: (store, hash) => call(store, "isRevoked(bytes32)", hash),
  };
}

export type OpenCertsEnv = { DB: D1Database; NULLIFIER_KEY?: string; ETH_RPC_URL?: string };

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" };
const reply = (body: object, status = 200) => Response.json(body, { status, headers: CORS });

/**
 * POST /opencerts/<namespace>/<name>  { holder: <browser secret>, disclosure }
 * Issues the method's badge to the holder. One holder per certificate: the
 * first holder to prove a certificate keeps it. Revealed values are only
 * checked, never stored or logged.
 */
export async function handleOpenCerts(request: Request, env: OpenCertsEnv, chain: Chain = ethereumChain(env.ETH_RPC_URL), now = Date.now()) {
  const id = /^\/opencerts\/([a-z0-9-]+\/[a-z0-9-]+)$/.exec(new URL(request.url).pathname)?.[1];
  const method = id ? OPENCERTS_METHODS[id] : undefined;
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!method) return reply({ ok: false, reason: "unknown method" }, 404);
  if (!env.NULLIFIER_KEY) return reply({ ok: false, reason: "issuing isn't configured" }, 503);

  const body = (await request.json().catch(() => null)) as { holder?: string; disclosure?: Disclosure } | null;
  if (!body?.holder || !/^[0-9a-f]{64}$/.test(body.holder)) return reply({ ok: false, reason: "missing holder" }, 400);

  let checked: Checked;
  try {
    checked = await checkDisclosure(body.disclosure as Disclosure, method, chain);
  } catch (e) {
    return reply({ ok: false, reason: (e as Error).message, retry: true }, 503);
  }
  if (!checked.ok) return reply(checked, 400);

  const holder = await holderId(body.holder);
  const certificate = await hmacHex(env.NULLIFIER_KEY, `${method.nullifier.scope}\n${checked.targetHash}`);
  // First holder to prove a certificate keeps it; the insert is a no-op after that.
  await env.DB.prepare(
    "INSERT OR IGNORE INTO certificate_claims (method, certificate, holder, claimed_at) VALUES (?1, ?2, ?3, ?4)",
  )
    .bind(method.id, certificate, holder, now)
    .run();
  const owner = await env.DB.prepare("SELECT holder FROM certificate_claims WHERE method = ?1 AND certificate = ?2")
    .bind(method.id, certificate)
    .first<{ holder: string }>();
  if (owner?.holder !== holder) return reply({ ok: false, reason: "This certificate has already earned this badge for someone else." }, 409);

  await upsertBadge(env.DB, holder, method.id, now, now, `opencerts:${method.version}`);
  return reply({ ok: true, method: method.id, version: method.version, badge: method.badge, holder });
}
