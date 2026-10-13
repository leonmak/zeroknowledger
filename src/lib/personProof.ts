// Unique-person proofs, made on this device.
//
// The TLSNotary proof hash-commits the identifying fields (for Singpass:
// singpass_id and mobile_number) instead of revealing them. The extension hands
// back each commitment's opening (the committed bytes and blinder); here we
// prove in zero knowledge that H = Poseidon2(NRIC, mobile) comes from those
// commitments, then seal only the proof (with H) to the attested enclave
// (lib/enclave.ts), which verifies it and keys H. The NRIC and mobile never
// leave this device. Per-country details live in ./identity; circuits in
// verifier/circuits.
import { ENCLAVE_URL, REGISTRY_URL } from "./config";
import { sealToEnclave } from "./enclave";
import { identitySource } from "./identity";

/** One hash-committed range, as returned by the (patched) extension. Hex-encoded. */
export type Opening = { start: number; end: number; algorithm: string; hash: string; blinder: string; plaintext: string };

export type PersonProof = { proof: string; publicInputs: string[] };

export class OpeningsUnavailable extends Error {
  constructor() {
    super("Your TLSNotary extension doesn't return commitment openings yet. It needs the build that exposes them.");
  }
}

export const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
const ascii = (bytes: Uint8Array) => String.fromCharCode(...bytes);
const sha256Hex = async (bytes: Uint8Array<ArrayBuffer>) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * The hash-commitment openings in a prove() result (from the patched
 * extension). The extension pairs each committed range with an opening by
 * position, but TLSNotary may return the openings in another order (e.g. by
 * byte offset), so each range's bytes can come with another range's hash and
 * blinder. Re-pair them: the right one is where SHA256(bytes || blinder) == hash.
 */
export async function openingsFrom(output: string): Promise<Opening[]> {
  let recv: Opening[] | undefined;
  try {
    recv = (JSON.parse(output) as { commitments?: { recv?: Opening[] } }).commitments?.recv;
  } catch {
    // fall through
  }
  if (!recv?.length) throw new OpeningsUnavailable();
  const pairs = recv.map(({ hash, blinder }) => ({ hash: hash.toLowerCase(), blinder }));
  return Promise.all(
    recv.map(async (o) => {
      const bytes = fromHex(o.plaintext);
      for (const p of pairs) {
        const b = fromHex(p.blinder);
        const data = new Uint8Array(bytes.length + b.length);
        data.set(bytes);
        data.set(b, bytes.length);
        if ((await sha256Hex(data)) === p.hash) return { ...o, ...p };
      }
      throw new Error("The extension's openings don't match its own commitments.");
    }),
  );
}

/** The opening whose committed bytes start with `prefix` (a JSON key). */
export function openingFor(openings: Opening[], prefix: string, what: string): Opening {
  const found = openings.find((o) => ascii(fromHex(o.plaintext)).startsWith(prefix));
  if (!found) throw new Error(`The proof is missing the ${what} commitment.`);
  return found;
}

/** Proves on this device with the identity source for `circuit`. */
export async function provePerson(circuitName: string, output: string): Promise<PersonProof> {
  const source = identitySource(circuitName);
  const [{ Noir }, { UltraHonkBackend }, circuit] = await Promise.all([
    import("@noir-lang/noir_js"),
    import("@aztec/bb.js"),
    source.loadCircuit(),
  ]);
  const { witness } = await new Noir(circuit as never).execute(source.inputs(await openingsFrom(output)) as never);
  // Multithreaded proving needs cross-origin isolation; otherwise one thread.
  const threads = globalThis.crossOriginIsolated ? navigator.hardwareConcurrency : 1;
  const backend = new UltraHonkBackend(circuit.bytecode, { threads });
  try {
    const { proof, publicInputs } = await backend.generateProof(witness);
    return { proof: btoa(String.fromCharCode(...proof)), publicInputs };
  } finally {
    await backend.destroy();
  }
}

/**
 * Seals the proof (with H, its last public input) to the enclave and submits it
 * for the TLS proof registered under `proofId`. Retries while the verifier's
 * webhook hasn't landed yet (404) or the enclave is unreachable (503).
 */
export async function submitPersonProof(proofId: string, proof: PersonProof): Promise<{ ok: boolean; reason?: string; challenge?: string }> {
  if (!ENCLAVE_URL) return { ok: false, reason: "unique-person badges need the enclave verifier" };
  const body = JSON.stringify(await sealToEnclave(ENCLAVE_URL, proofId, proof));
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${REGISTRY_URL}/proofs/${proofId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.status !== 404 && res.status !== 503) return (await res.json()) as { ok: boolean; reason?: string; challenge?: string };
    await new Promise((r) => setTimeout(r, res.status === 503 ? 3000 : 1000));
  }
  return { ok: false, reason: "the verifier never registered this TLS proof" };
}

/**
 * Queues this proof with the registry and waits until the enclave is up. The
 * enclave VM only runs while proofs are queued, so after a quiet spell it takes
 * about a minute to start. `onStarting` fires once if we have to wait.
 */
export async function wakeEnclave(proofId: string, onStarting: () => void): Promise<void> {
  if (!ENCLAVE_URL) return;
  const deadline = Date.now() + 5 * 60_000;
  let waiting = false;
  while (Date.now() < deadline) {
    const res = await fetch(`${REGISTRY_URL}/enclave/wake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof_id: proofId }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { ready?: boolean; starting?: boolean } | null;
    if (body?.ready) return;
    if (body && body.starting === false) throw new Error("The secure enclave is offline right now. Try again later.");
    if (!waiting) {
      waiting = true;
      onStarting();
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("The secure enclave didn't start in time. Try again in a minute.");
}

export const newProofId = () => crypto.randomUUID().replace(/-/g, "");
