-- OpenCerts (opencerts.ts): which holder a certificate's badge went to, so one
-- certificate earns a method's badge for one holder. `certificate` is
-- HMAC(NULLIFIER_KEY, scope ‖ targetHash); the certificate itself isn't stored.
CREATE TABLE certificate_claims (
  method TEXT NOT NULL,       -- registry method id, e.g. education/nus-graduate
  certificate TEXT NOT NULL,
  holder TEXT NOT NULL,
  claimed_at INTEGER NOT NULL, -- ms since epoch
  PRIMARY KEY (method, certificate)
);
