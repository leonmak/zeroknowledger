import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Noir and Barretenberg ship WASM that Vite's dependency prebundling breaks.
  optimizeDeps: { exclude: ["@noir-lang/noirc_abi", "@noir-lang/acvm_js", "@aztec/bb.js"] },
  build: { target: "esnext" },
  worker: { format: "es" },
});
