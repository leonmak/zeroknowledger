// Singpass: NRIC/FIN + mobile from the portal's profile API, committed as the
// JSON key-value bytes `"singpass_id":"S1234567D"` and `"mobile_number":"91234567"`.
import type { IdentitySource } from ".";
import { fromHex, openingFor } from "../personProof";

export const singpass: IdentitySource = {
  circuit: "singpass_person",
  loadCircuit: () => import("../circuits/singpass_person.json") as Promise<{ bytecode: string }>,
  inputs: (openings) => {
    const id = openingFor(openings, '"singpass_id":"', "NRIC/FIN");
    const phone = openingFor(openings, '"mobile_number":"', "mobile number");
    return {
      id_kv: [...fromHex(id.plaintext)],
      id_blinder: [...fromHex(id.blinder)],
      phone_kv: [...fromHex(phone.plaintext)],
      phone_blinder: [...fromHex(phone.blinder)],
      id_commitment: [...fromHex(id.hash)],
      phone_commitment: [...fromHex(phone.hash)],
    };
  },
};
