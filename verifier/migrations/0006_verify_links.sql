-- Public verification links: /singpass/verified/<app>/<pairwise_id>. The
-- pairwise id is already what the app sees, so storing it reveals nothing new.
ALTER TABLE bindings ADD COLUMN pairwise_id TEXT;
CREATE UNIQUE INDEX bindings_pairwise ON bindings (app_id, pairwise_id);
