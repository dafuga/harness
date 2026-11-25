-- 0008-sealed-sync
-- Sealed account sync: Cloudflare keeps ciphertext, public device keys and opaque ids only.
-- `account` is the signed-in actor id. Envelopes are base64url text of bytes the server never opens.

-- The device chain: one signed entry per row, appended in order from seq 0 (genesis).
CREATE TABLE sealed_chain (
  account TEXT NOT NULL,
  seq INTEGER NOT NULL,
  hash TEXT NOT NULL,
  entry TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account, seq)
);

-- HPKE key grants, one per scope, epoch and device. The first write wins.
CREATE TABLE sealed_grants (
  account TEXT NOT NULL,
  scope TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  device TEXT NOT NULL,
  grant_body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account, scope, epoch, device)
);
CREATE INDEX sealed_grants_by_device ON sealed_grants (account, device);

-- The op log of a scope. `seq` is assigned by the server; `op_id` is the envelope's own object id.
CREATE TABLE sealed_ops (
  account TEXT NOT NULL,
  scope TEXT NOT NULL,
  seq INTEGER NOT NULL,
  op_id TEXT NOT NULL,
  device TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  envelope TEXT NOT NULL,
  PRIMARY KEY (account, scope, seq)
);
CREATE UNIQUE INDEX sealed_ops_by_op ON sealed_ops (account, scope, op_id);

-- Snapshots and session state: the newest revision of each object. Large envelopes live in R2.
-- `change` counts the writes of a scope, so a device can ask for what changed since it last looked.
CREATE TABLE sealed_objects (
  account TEXT NOT NULL,
  scope TEXT NOT NULL,
  object_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  size INTEGER NOT NULL,
  r2_key TEXT,
  envelope TEXT,
  change INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account, scope, object_id),
  CHECK ((r2_key IS NULL) <> (envelope IS NULL))
);

CREATE UNIQUE INDEX sealed_objects_by_change ON sealed_objects (account, scope, change);

-- Rollback: run the following statements in order. This drops every sealed row, so export first.
-- DROP INDEX sealed_objects_by_change;
-- DROP TABLE sealed_objects;
-- DROP INDEX sealed_ops_by_op;
-- DROP TABLE sealed_ops;
-- DROP INDEX sealed_grants_by_device;
-- DROP TABLE sealed_grants;
-- DROP TABLE sealed_chain;
