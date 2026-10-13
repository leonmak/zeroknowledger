// Build helpers for unique-person circuits (circuits/<name>/, after `nargo compile`).
//
//   node scripts/circuit.mjs vk <name>        # writes circuits/<name>/vk.json
//   node scripts/circuit.mjs fixture <name>   # proves circuits/<name>/fixture-inputs.mjs,
//                                             # verifies it, writes circuits/<name>/fixture.json
//
// fixture-inputs.mjs exports `inputs()`: a synthetic witness built the way the
// browser would, from TLSNotary-style commitments (SHA256(bytes || blinder)).
import { readFileSync, writeFileSync } from "node:fs";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend, BarretenbergVerifier } from "@aztec/bb.js";

const [cmd, name] = process.argv.slice(2);
if (!name || !["vk", "fixture"].includes(cmd)) {
  console.log("usage: node scripts/circuit.mjs vk|fixture <circuit name>");
  process.exit(1);
}
const dir = new URL(`../circuits/${name}/`, import.meta.url);
const circuit = JSON.parse(readFileSync(new URL(`target/${name}.json`, dir), "utf8"));

if (cmd === "vk") {
  const backend = new UltraHonkBackend(circuit.bytecode);
  const vk = await backend.getVerificationKey();
  await backend.destroy();
  // Public inputs = every `pub` parameter element plus the return value.
  const publicInputs = circuit.abi.parameters
    .filter((p) => p.visibility === "public")
    .reduce((n, p) => n + (p.type.kind === "array" ? p.type.length : 1), circuit.abi.return_type ? 1 : 0);
  writeFileSync(new URL("vk.json", dir), JSON.stringify({ vk: Buffer.from(vk).toString("base64"), publicInputs }) + "\n");
  console.log(`wrote circuits/${name}/vk.json (${vk.length} bytes, ${publicInputs} public inputs)`);
} else {
  const { inputs } = await import(new URL("fixture-inputs.mjs", dir));
  const t0 = Date.now();
  const { witness } = await new Noir(circuit).execute(inputs());
  const backend = new UltraHonkBackend(circuit.bytecode, { threads: 4 });
  const proof = await backend.generateProof(witness);
  await backend.destroy();
  const { vk } = JSON.parse(readFileSync(new URL("vk.json", dir), "utf8"));
  const verifier = new BarretenbergVerifier();
  const ok = await verifier.verifyUltraHonkProof(proof, Uint8Array.from(Buffer.from(vk, "base64")));
  await verifier.destroy();
  console.log(`proved in ${Date.now() - t0} ms, verified: ${ok}, ${proof.publicInputs.length} public inputs`);
  if (!ok) process.exit(1);
  writeFileSync(
    new URL("fixture.json", dir),
    JSON.stringify({ proof: Buffer.from(proof.proof).toString("base64"), publicInputs: proof.publicInputs }) + "\n",
  );
}
