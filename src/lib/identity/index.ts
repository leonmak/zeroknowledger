// Identity sources for unique-person proofs (see verifier/IDENTITY_SOURCES.md).
// Each maps the extension's commitment openings to its circuit's private and
// public inputs; the proving, submission and issuing around it are shared.
import type { Opening } from "../personProof";
import { singpass } from "./singpass";

export type IdentitySource = {
  /** circuits/<circuit> in the verifier; also the template's issue_when.person_proof.circuit. */
  circuit: string;
  /** The compiled Noir circuit (loaded only when someone proves). */
  loadCircuit: () => Promise<{ bytecode: string }>;
  /** Circuit inputs from the openings of the template's commit_fields. */
  inputs: (openings: Opening[]) => Record<string, unknown>;
};

const sources: IdentitySource[] = [singpass];

export function identitySource(circuit: string): IdentitySource {
  const source = sources.find((s) => s.circuit === circuit);
  if (!source) throw new Error(`No identity source for circuit ${circuit}`);
  return source;
}
