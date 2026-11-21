-- Rollback for a separately approved migration: DROP TABLE hub_home_chat;
CREATE TABLE hub_home_chat (
  actor_id TEXT NOT NULL,
  id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'refused', 'unconfirmed')),
  PRIMARY KEY (actor_id, id)
);
CREATE INDEX hub_home_chat_pending ON hub_home_chat (actor_id, status, claimed_at, created_at);
