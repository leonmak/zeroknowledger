-- Verified TLS proofs of a unique-person template, waiting for the browser's
-- zero-knowledge proof. Holds only commitment digests, never the committed
-- NRIC/mobile. Spent (deleted) on the first proof submission.
CREATE TABLE pending_proofs (
  proof_id TEXT PRIMARY KEY,   -- chosen by the browser, sent as session data
  template TEXT NOT NULL,
  holder TEXT NOT NULL,
  challenge TEXT,              -- app link code, if any
  commitments TEXT NOT NULL,   -- JSON array of the two SHA-256 commitment digests (hex)
  proved_at INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
