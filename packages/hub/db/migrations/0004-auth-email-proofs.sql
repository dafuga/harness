-- 0004-auth-email-proofs
-- Mailbox proof for Google accounts whose address Google does not vouch for today.
-- auth_email_proofs: one pending proof per sign-in attempt, found by the keyed hash of its cookie.
--   The code is stored as a keyed hash; `attempts` and `claimed` change in one statement.
-- auth_email_sends: one row per actor and per address hash, to cap sends per minute and per day.
-- auth_email_verified: which address hash a Google subject has proven, and until when.
-- Rollback: run the DROP statements listed at the end of this file.

CREATE TABLE IF NOT EXISTS auth_email_proofs (
	id_hash TEXT PRIMARY KEY,
	actor_id TEXT NOT NULL,
	actor_email TEXT NOT NULL,
	actor_name TEXT NOT NULL,
	code_hash TEXT,
	code_expires_at INTEGER,
	attempts INTEGER NOT NULL DEFAULT 0,
	claimed INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0, 1)),
	expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_email_proofs_expiry ON auth_email_proofs (expires_at);

CREATE TABLE IF NOT EXISTS auth_email_sends (
	send_key TEXT PRIMARY KEY,
	send_day INTEGER NOT NULL,
	send_count INTEGER NOT NULL,
	last_sent_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_email_verified (
	actor_id TEXT PRIMARY KEY,
	email_hash TEXT NOT NULL,
	verified_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);

-- DROP TABLE IF EXISTS auth_email_verified;
-- DROP TABLE IF EXISTS auth_email_sends;
-- DROP TABLE IF EXISTS auth_email_proofs;
