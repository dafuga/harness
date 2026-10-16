-- 0003-auth-grant-generations
-- A GitHub grant row now outlives its tokens. `generation` advances on every connection and
-- revocation and is never reused: a revoked or expired row stays as a tombstone with its tokens
-- erased. An OAuth flow records the generation it started from (`grant_generation`) and may
-- publish only against it, and `refreshing_until` is the lease that lets one caller at a time
-- rotate the tokens. A connection or rotation that started before a disconnect can therefore
-- never write authority back.
-- Rollback: run the ALTER TABLE ... DROP COLUMN statements listed at the end of this file.

ALTER TABLE auth_github_grants ADD COLUMN generation INTEGER NOT NULL DEFAULT 1;
ALTER TABLE auth_github_grants ADD COLUMN revoked_at INTEGER;
ALTER TABLE auth_github_grants ADD COLUMN refreshing_until INTEGER;
ALTER TABLE auth_github_states ADD COLUMN grant_generation INTEGER NOT NULL DEFAULT 0;

-- ALTER TABLE auth_github_states DROP COLUMN grant_generation;
-- ALTER TABLE auth_github_grants DROP COLUMN refreshing_until;
-- ALTER TABLE auth_github_grants DROP COLUMN revoked_at;
-- ALTER TABLE auth_github_grants DROP COLUMN generation;
