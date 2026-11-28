-- 0012-approval-push
CREATE TABLE approval_web_push (
  account TEXT NOT NULL,
  device TEXT NOT NULL,
  session_hash TEXT NOT NULL REFERENCES auth_sessions(id_hash) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  PRIMARY KEY (account, device)
);
CREATE INDEX approval_web_push_session ON approval_web_push (session_hash);

-- Rollback:
-- DROP TABLE approval_web_push;
