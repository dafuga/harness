-- 0007-browser-session-devices
-- Populate device metadata for already signed-in browsers without replacing their sessions.
UPDATE auth_sessions
SET device_id = lower(hex(randomblob(16))), device_name = 'Web browser', last_seen_at = created_at
WHERE kind = 'browser'
  AND device_id IS NULL
  AND revoked_at IS NULL
  AND expires_at > unixepoch() * 1000;
