// Where the site talks to, set at build time.
//  - VITE_VERIFIER_URL: the TLSNotary verifier the extension proves against
//    (the Cloudflare container, or the attested enclave at enclave.<domain>).
//  - VITE_REGISTRY_URL: the badge registry API (the Cloudflare Worker).
//    Defaults to the verifier URL, where both used to live.
//  - VITE_TLSN_MODE: "Proxy" (the Cloudflare container) or "Mpc" (the enclave:
//    its host controls the network, so proxy mode isn't safe there).
export const VERIFIER_URL = import.meta.env.VITE_VERIFIER_URL ?? "http://localhost:8787";
export const REGISTRY_URL = import.meta.env.VITE_REGISTRY_URL ?? VERIFIER_URL;
export const TLSN_MODE: "Proxy" | "Mpc" = import.meta.env.VITE_TLSN_MODE === "Mpc" ? "Mpc" : "Proxy";
/** In MPC mode the verifier is the attested enclave, and person proofs are sealed to it (lib/enclave.ts). */
export const ENCLAVE_URL = TLSN_MODE === "Mpc" ? VERIFIER_URL : undefined;
