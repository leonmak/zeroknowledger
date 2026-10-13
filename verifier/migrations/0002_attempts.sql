-- Outcome of every verified proof the issuer saw, issued or not. Holds no
-- revealed data or holder ids: just enough to debug why a badge didn't issue.
CREATE TABLE attempts (
  session_id TEXT NOT NULL,
  server_name TEXT NOT NULL,
  at INTEGER NOT NULL,       -- ms since epoch
  issued INTEGER NOT NULL,   -- 1 or 0
  reason TEXT NOT NULL       -- template name when issued, else why not
);
CREATE INDEX attempts_at ON attempts (at);
