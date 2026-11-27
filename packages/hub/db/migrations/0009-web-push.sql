-- Rollback for a separately approved migration: DROP TABLE web_push_subscriptions; DROP TABLE web_push_settings
CREATE TABLE web_push_subscriptions (
  actor_id TEXT NOT NULL,
  id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  delivered_at INTEGER,
  PRIMARY KEY (actor_id, id)
);
CREATE TABLE web_push_settings (
  actor_id TEXT PRIMARY KEY,
  quiet_enabled INTEGER NOT NULL CHECK (quiet_enabled IN (0, 1)),
  quiet_start TEXT NOT NULL,
  quiet_end TEXT NOT NULL
);
