-- 0007-browser-session-devices
-- Keep migrations small and reversible when the database supports it.

-- Populate device metadata for already signed-in browsers without replacing their sessions.
UPDATE auth_sessions
SET device_id = lower(hex(randomblob(16))), device_name = 'Web browser', last_seen_at = created_at
WHERE kind = 'browser'
  AND device_id IS NULL
  AND revoked_at IS NULL
  AND expires_at > unixepoch() * 1000;

-- Before rolling back to the pre-inventory app, clear browser device metadata:
-- UPDATE auth_sessions SET device_id = NULL, device_name = NULL, last_seen_at = NULL WHERE kind = 'browser';
