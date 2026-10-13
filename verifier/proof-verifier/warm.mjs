// Verifies every circuit's fixture proof once (exits non-zero on failure), so
// the image build caches bb.js's CRS and catches a stale verification key.
import { warm } from "./lib.mjs";

process.exit((await warm()) ? 0 : 1);
