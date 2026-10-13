-- Uniqueness moves from one-holder-per-person to one-subject-per-person per
-- app: a person can link one account in each app (e.g. each Discord server).
DROP TABLE persons;

-- Relying parties. Registered by an admin so nobody can claim someone else's
-- app id (e.g. discord:<their guild>).
CREATE TABLE apps (
  app_id TEXT PRIMARY KEY,          -- e.g. discord:123456789 or dating:acme
  name TEXT NOT NULL,               -- shown to users on the consent screen
  api_key_hash TEXT NOT NULL,       -- hex SHA-256 of the app's API key
  webhook_url TEXT,                 -- optional: bound/unbound events are POSTed here
  webhook_secret TEXT NOT NULL,     -- signs webhook bodies (X-ZK-Signature)
  cooldown_days INTEGER NOT NULL,   -- how often a person may move to another subject
  created_at INTEGER NOT NULL
);

-- One-time links an app hands to one of its users to link their account.
CREATE TABLE challenges (
  code TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps (app_id),
  subject TEXT NOT NULL,            -- the app's account id, e.g. discord user id
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL,             -- pending | needs_confirmation | completed | rejected
  person TEXT,                      -- set while awaiting confirmation, cleared after
  move_from TEXT,                   -- the person's current subject, if moving
  reason TEXT,                      -- why it was rejected
  pairwise_id TEXT                  -- the result, once completed
);

-- The authoritative links: per app, one subject per person and one person per
-- subject. Moving replaces the row; old associations aren't kept.
CREATE TABLE bindings (
  app_id TEXT NOT NULL REFERENCES apps (app_id),
  person TEXT NOT NULL,             -- HMAC(NULLIFIER_KEY, scope ‖ NRIC); never shown to apps
  subject TEXT NOT NULL,
  bound_at INTEGER NOT NULL,
  rebind_count INTEGER NOT NULL,
  PRIMARY KEY (app_id, person),
  UNIQUE (app_id, subject)
);
