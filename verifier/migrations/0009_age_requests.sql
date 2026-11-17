CREATE TABLE age_requests (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  return_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  proved_at INTEGER,
  consumed_at INTEGER
);
CREATE INDEX age_requests_expiry ON age_requests(expires_at);
