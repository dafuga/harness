# Tracker snapshot union rehearsal

Use standalone SQLite online backups with independently recorded SHA-256 receipts. Keep each source checkpointed, protected, and immutable. The Mac rehearsal used separate primary and secondary snapshots. Run the legacy transfer and native replay over copies on the same machine as the protected backups.

## Build the disposable candidate

The protected rehearsal tools wrap the grbejh transfer pattern and reuse the legacy Tracker store and run log. They take a primary snapshot, a second snapshot, the corresponding digests and Tracker node names, and a new bundle path.

```sh
node "$TOOLS/transfer.mjs" \
  "$PRIMARY_SNAPSHOT" "$PRIMARY_SHA256" "$PRIMARY_NODE" \
  "$SECONDARY_SNAPSHOT" "$SECONDARY_SHA256" "$SECONDARY_NODE" \
  "$NEW_BUNDLE"
```

The bundle holds the reconciled `candidate.sqlite` and exact, sealed images of both sources. The candidate keeps the primary journal sequence, database identity, outbound cursors, launcher state, and node-local tables. It appends missing operations by operation ID, verifies the full note union and each item field against its source clocks, and checks each imported actor and receipt. The secondary node's local runs appear in the runtime through Tracker's node-scoped remote run projection. The sealed images preserve full run records, source-local launch events, metadata, queues, and superseded telemetry values with their original identities.

The `reconciliation.json` receipt records table counts and fingerprints, the operation sequence map, pending operation fingerprints, field conflicts, and status-by-agent count deltas. Keep the HMAC key with the protected bundle. An operation ID collision with a divergent payload or a conflicting row in a shared state table stops the rehearsal. Keep rejected bundles separate from verified candidates.

## Verify native replay

Use the source pinned in [the native runtime PR](https://github.com/dafuga/harness/pull/162) at `687f90c10e9614fe2afd5743bfa8071ff01f522d`.

```sh
bun "$TOOLS/native-replay.mjs" "$HARNESS_CHECKOUT" "$NEW_BUNDLE" \
  "$PRIMARY_NODE" "$SECONDARY_NODE"
```

The replay sends the secondary snapshot's exact pending operation set through signed native sync. It drops the first receipt after the hub copy commits it, verifies deduplication on retry, and compares the identity-reset replay with the legacy union. The script checks health, status, and an item read on an ephemeral loopback listener over a separate temporary copy. The before and after fingerprints must match for every table, the schema, and the pending operation set. It closes the listener, removes the temporary copies, and rechecks the sealed bundle's digests.

## Rehearse a later box delta

After the old hub is verifiably fenced, obtain a complete, standalone final online backup and its receipt through the migration owner's approved process. Use the fenced capture only after its hash, integrity, table inventory, and journal are verified. Keep the malformed partial out of the input set.

1. Retain the Mac bundle and the receipt for the final box backup. Use the Mac candidate as the base and the final box backup as the incoming snapshot. Pass the Mac bundle's evidence key as the final positional argument to reuse its hash labels. Write to a fresh bundle.
2. Repeat with the just-produced candidate as the base, the same box backup as incoming, and another fresh output bundle. Require zero added operation IDs and identical candidate hashes across the two runs. Compare table fingerprints and recover each box operation ID in the candidate using the receipt.
3. Review host ownership and address each reported state collision before building another candidate. Keep box-local jobs, local delivery destinations, queue dependencies, and sequence-based cursors tied to the source checkpoint until they have explicit migration mappings. A source journal sequence can refer to a different operation in the union. Use source operation IDs to map any cursor, verify the classified pending set, and hold activation if an exact boundary cannot be represented.
4. Rehearse the resulting candidate and its rollback on separate copies. The migration owner must verify fencing, fresh checkpoints across all writers, and the disposition of source-local state before using a candidate for a cutover.

The box-delta admission and second-pass checks were exercised with a synthetic standalone backup. The Mac candidate is an offline rehearsal checkpoint pending a complete box capture and review of any box-only data.
