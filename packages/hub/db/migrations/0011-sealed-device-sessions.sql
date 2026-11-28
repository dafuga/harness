-- 0011-sealed-device-sessions
-- A verified installation key binds to the existing Google session lifecycle.
ALTER TABLE auth_sessions ADD COLUMN sealed_device_id TEXT;

-- Rollback:
-- ALTER TABLE auth_sessions DROP COLUMN sealed_device_id;
