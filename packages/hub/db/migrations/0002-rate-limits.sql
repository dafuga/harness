CREATE TABLE IF NOT EXISTS hub_rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS hub_rate_limits_expiry ON hub_rate_limits(expires_at);
-- rollback: DROP TABLE IF EXISTS hub_rate_limits;
