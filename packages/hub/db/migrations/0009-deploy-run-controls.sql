undefined
-- Controlled runs have a separate execution claim. Existing native approval rows stay in 0008.
CREATE TABLE deploy_control_requests (
	id TEXT PRIMARY KEY,
	plan TEXT NOT NULL,
	project TEXT NOT NULL,
	environment TEXT NOT NULL CHECK (environment IN ('staging', 'preprod', 'prod')),
	owner TEXT NOT NULL,
	runner_hash TEXT NOT NULL,
	card TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	receipt TEXT UNIQUE,
	decision TEXT CHECK (decision IN ('allow', 'deny')),
	session_hash TEXT,
	decided_at INTEGER,
	used_at INTEGER,
	go_at INTEGER,
	go_session_hash TEXT,
	admitted_at INTEGER,
	progress TEXT
);

CREATE INDEX deploy_control_expiry ON deploy_control_requests (expires_at);
CREATE INDEX deploy_control_owner ON deploy_control_requests (owner, expires_at);

-- Rollback: disable controlled runners, reconcile active runs and keep the decision log.
-- The previous Hub uses only deploy_approval_requests. Leave this table intact for read-back.
