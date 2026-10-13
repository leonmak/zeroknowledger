-- One holder per person and one person per holder, per nullifier template.
-- `person` is HMAC(NULLIFIER_KEY, scope ‖ NRIC/FIN); the NRIC itself is never
-- stored. Moving a person to a new holder replaces the row, so old
-- associations aren't kept: only how often it has moved.
CREATE TABLE persons (
  template TEXT NOT NULL,
  person TEXT NOT NULL,
  holder TEXT NOT NULL,
  bound_at INTEGER NOT NULL,        -- ms since epoch of the current binding
  rebind_count INTEGER NOT NULL,
  PRIMARY KEY (template, person),
  UNIQUE (template, holder)
);
