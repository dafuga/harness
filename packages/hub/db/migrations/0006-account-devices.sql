-- 0006-account-devices
ALTER TABLE auth_native_exchanges ADD COLUMN callback TEXT;
ALTER TABLE auth_native_exchanges ADD COLUMN device_name TEXT;
ALTER TABLE auth_sessions ADD COLUMN device_id TEXT;
ALTER TABLE auth_sessions ADD COLUMN device_name TEXT;
ALTER TABLE auth_sessions ADD COLUMN last_seen_at INTEGER;

UPDATE auth_sessions
SET device_id = lower(hex(randomblob(16))), device_name = 'Harness device', last_seen_at = created_at
WHERE kind = 'native';

CREATE UNIQUE INDEX auth_sessions_device ON auth_sessions (device_id);
CREATE INDEX auth_sessions_devices_by_actor ON auth_sessions (actor_id, last_seen_at DESC) WHERE device_id IS NOT NULL;

-- Rollback: run the following statements in order.
-- DROP INDEX auth_sessions_devices_by_actor;
-- DROP INDEX auth_sessions_device;
-- ALTER TABLE auth_sessions DROP COLUMN last_seen_at;
-- ALTER TABLE auth_sessions DROP COLUMN device_name;
-- ALTER TABLE auth_sessions DROP COLUMN device_id;
-- ALTER TABLE auth_native_exchanges DROP COLUMN device_name;
-- ALTER TABLE auth_native_exchanges DROP COLUMN callback;
