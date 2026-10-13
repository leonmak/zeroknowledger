// ZK proof verification for unique-person circuits (../circuits/<name>/vk.json),
// used by the enclave issuer (../gcp/enclave/issuer.mjs).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { BarretenbergVerifier } from "@aztec/bb.js";

const circuitsDir = new URL("../circuits/", import.meta.url);

/** name -> { vk, publicInputs } */
export const circuits = new Map(
  readdirSync(circuitsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/vk.json`, circuitsDir)))
    .map((d) => {
      const meta = JSON.parse(readFileSync(new URL(`${d.name}/vk.json`, circuitsDir), "utf8"));
      return [d.name, { vk: Uint8Array.from(Buffer.from(meta.vk, "base64")), publicInputs: meta.publicInputs }];
    }),
);

let verifier;

export async function verify({ circuit, proof, publicInputs }) {
  const c = circuits.get(circuit);
  if (!c || typeof proof !== "string" || !Array.isArray(publicInputs) || publicInputs.length !== c.publicInputs) return false;
  if (!publicInputs.every((x) => typeof x === "string" && /^0x[0-9a-f]{64}$/i.test(x))) return false;
  const bytes = Uint8Array.from(Buffer.from(proof, "base64"));
  if (bytes.length > 64 * 1024) return false;
  verifier ??= new BarretenbergVerifier({ threads: 1 });
  return verifier.verifyUltraHonkProof({ proof: bytes, publicInputs }, c.vk);
}

/** Verifies each circuit's fixture.json once, so bb.js caches its CRS. */
export async function warm() {
  for (const name of circuits.keys()) {
    const fixture = JSON.parse(readFileSync(new URL(`${name}/fixture.json`, circuitsDir), "utf8"));
    const ok = await verify({ circuit: name, ...fixture });
    console.log(`warm verify ${name}: ${ok}`);
    if (!ok) return false;
  }
  return true;
}

/** A person circuit's public inputs: n commitments of 32 byte-inputs each, then H. */
export function parsePublicInputs(inputs, n) {
  if (n < 1 || !Array.isArray(inputs) || inputs.length !== 32 * n + 1) return null;
  if (!inputs.every((x) => typeof x === "string" && /^0x[0-9a-f]{64}$/i.test(x))) return null;
  const bytes = inputs.slice(0, 32 * n).map((x) => BigInt(x));
  if (bytes.some((b) => b > 255n)) return null;
  const hex = (bs) => bs.map((b) => b.toString(16).padStart(2, "0")).join("");
  const commitments = Array.from({ length: n }, (_, i) => hex(bytes.slice(32 * i, 32 * (i + 1))));
  return { commitments, h: inputs[32 * n].toLowerCase() };
}
