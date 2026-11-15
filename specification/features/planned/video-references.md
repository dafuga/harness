# Feature: Video References

## Overview

Bind parent captures to sealed video batches and retain the original attached clip's source,
build, timestamp and metadata while the enclosing scenario observes its current revision.

## Acceptance Criteria

- Parent manifests omit batch-backed video and poster copies; verified readers restore virtual paths.
- Reused clips require intact original attached full or exact-owner successful scoped proof.
- Every original dependency remains intact, with cycles, changed metadata and wrong owners refused.
- Metadata discovery is newest first and grants no media or current-input proof.
- Selected clip reads isolate unrelated corrupt media; archive batch metadata remains fully sealed.
- Preserve graph coverage and library metadata in DTOs and original clip references in the gallery.

## Public helper

`VideoReferenceService.resolve({source,capture,batches})` returns selected clip bytes, pointer,
original provenance and original input hash. The caller must prove the current input hash and
normal current build stamp, or explicitly validate an original stamp through this helper.
`candidates(selection)` returns sealed parent-linked proposals without loading media.
`materialize(record)` verifies virtual file keys. A full parent materialization is bounded at
512 MiB; origin lineage verifies then discards ancestor media, retaining only metadata.
No helper fetches automatically or upgrades a batch/scoped record to a full verdict.

## Future Enhancements

- Recording controller, current input admission, graph UI and normal verifier assembly are coordinated owners.
