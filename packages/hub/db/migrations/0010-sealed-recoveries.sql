-- 0010-sealed-recoveries
-- A bootstrap's encrypted recovery device. Its decryption secret is held separately.
CREATE TABLE sealed_recoveries (
  account TEXT PRIMARY KEY,
  recovery TEXT NOT NULL
);

-- Rollback: export recovery blobs first.
-- DROP TABLE sealed_recoveries;
