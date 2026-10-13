// Synthetic witness for scripts/circuit.mjs fixture: made-up values, the same
// shape as the TLSNotary openings the browser gets from Singpass's profile API.
import { createHash, randomBytes } from "node:crypto";

const commit = (bytes, blinder) => createHash("sha256").update(bytes).update(blinder).digest();

export function inputs() {
  const idKv = Buffer.from('"singpass_id":"S1234567D"');
  const phoneKv = Buffer.from('"mobile_number":"91234567"');
  const idBlinder = randomBytes(16);
  const phoneBlinder = randomBytes(16);
  return {
    id_kv: [...idKv],
    id_blinder: [...idBlinder],
    phone_kv: [...phoneKv],
    phone_blinder: [...phoneBlinder],
    id_commitment: [...commit(idKv, idBlinder)],
    phone_commitment: [...commit(phoneKv, phoneBlinder)],
  };
}
