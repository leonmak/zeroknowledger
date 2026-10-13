/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VERIFIER_URL?: string;
  readonly VITE_REGISTRY_URL?: string;
  readonly VITE_TLSN_MODE?: "Proxy" | "Mpc";
}
