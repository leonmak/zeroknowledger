-- On-demand enclave (src/enclaveControl.ts). The enclave VM is started when a
-- unique-person proof begins and stopped by a per-minute check once nothing is
-- waiting: no unexpired ticket here and no unexpired pending_proofs row.
CREATE TABLE enclave_tickets (
  proof_id   TEXT PRIMARY KEY,   -- the id the browser will prove under
  expires_at INTEGER NOT NULL    -- ms; covers the Singpass login and the MPC-TLS proof
);
