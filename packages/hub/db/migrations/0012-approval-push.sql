-- 0012-approval-push
CREATE TABLE approval_web_push (
  account TEXT NOT NULL,
  device TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  PRIMARY KEY (account, device)
);

-- Rollback:
-- DROP TABLE approval_web_push;
