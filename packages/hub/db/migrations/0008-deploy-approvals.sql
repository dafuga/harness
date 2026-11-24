-- Native owner decisions for exact scripted deploy plans. No bearer values or provider data.
CREATE TABLE deploy_approval_requests (
	id TEXT PRIMARY KEY,
	plan TEXT NOT NULL,
	project TEXT NOT NULL,
	environment TEXT NOT NULL CHECK (environment IN ('preprod', 'prod')),
	owner TEXT NOT NULL,
	runner_hash TEXT NOT NULL,
	card TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	receipt TEXT UNIQUE,
	decision TEXT CHECK (decision IN ('allow', 'deny')),
	session_hash TEXT,
	decided_at INTEGER,
	used_at INTEGER
);
CREATE INDEX deploy_approval_expiry ON deploy_approval_requests (expires_at);
CREATE INDEX deploy_approval_owner ON deploy_approval_requests (owner, expires_at);

-- Rollback after the approval lane is disabled and all requests have expired:
-- DROP TABLE IF EXISTS deploy_approval_requests;
