-- One row per (holder, badge); re-proving refreshes it.
CREATE TABLE badges (
  holder TEXT NOT NULL,       -- hex SHA-256 prefix of the holder's browser secret
  template TEXT NOT NULL,     -- template name, e.g. identity/singpass-verified-user
  issued_at INTEGER NOT NULL, -- ms since epoch
  proved_at INTEGER NOT NULL, -- server Date header of the proved response, ms
  session_id TEXT NOT NULL,   -- verifier session, for tracing
  PRIMARY KEY (holder, template)
);
