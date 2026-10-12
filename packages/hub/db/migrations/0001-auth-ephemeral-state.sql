-- auth-ephemeral-state
-- Ephemeral authentication state only: sessions, one-time challenges, GitHub OAuth proof and
-- native handoffs. Projects, members, invitations and comments live in GitHub, never here.
-- Opaque secrets are stored as keyed hashes; GitHub tokens are stored AES-GCM sealed.
-- Rollback: run the DROP statements listed at the end of this file.

CREATE TABLE IF NOT EXISTS auth_challenges (
	id_hash TEXT PRIMARY KEY,
	nonce TEXT NOT NULL,
	csrf_hash TEXT NOT NULL,
	expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
	id_hash TEXT PRIMARY KEY,
	kind TEXT NOT NULL CHECK (kind IN ('browser', 'native')),
	parent_hash TEXT,
	actor_id TEXT NOT NULL,
	actor_email TEXT NOT NULL,
	actor_name TEXT NOT NULL,
	resource TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL,
	revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS auth_sessions_parent ON auth_sessions (parent_hash);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS auth_github_states (
	id_hash TEXT PRIMARY KEY,
	session_hash TEXT NOT NULL,
	actor_id TEXT NOT NULL,
	verifier_cipher TEXT NOT NULL,
	expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_github_grants (
	actor_id TEXT PRIMARY KEY,
	github_user_id INTEGER NOT NULL,
	login TEXT NOT NULL,
	token_cipher TEXT NOT NULL,
	token_expires_at INTEGER,
	refresh_cipher TEXT,
	refresh_expires_at INTEGER,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_native_exchanges (
	id TEXT PRIMARY KEY,
	challenge TEXT NOT NULL,
	nonce_hash TEXT NOT NULL,
	code_hash TEXT NOT NULL,
	resource TEXT NOT NULL,
	audience TEXT NOT NULL,
	action TEXT NOT NULL,
	environment TEXT NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
	origin TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'consumed')),
	subject TEXT,
	parent_hash TEXT,
	expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_native_exchanges_expiry ON auth_native_exchanges (expires_at);

-- DROP TABLE IF EXISTS auth_native_exchanges;
-- DROP TABLE IF EXISTS auth_github_grants;
-- DROP TABLE IF EXISTS auth_github_states;
-- DROP TABLE IF EXISTS auth_sessions;
-- DROP TABLE IF EXISTS auth_challenges;
