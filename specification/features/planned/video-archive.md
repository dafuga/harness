---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Feature: Video Archive

## Overview

Retain admitted silent video and poster pairs as sealed, append-only Git evidence batches.
Batch pointers identify exact evidence ancestry and retain the original tested source and build.
An archive batch has no verification status and cannot establish a passing parent record.

## Acceptance Criteria

- Split at 64 clips or 512 MiB of unique referenced media; cap each clip and poster at 8 MiB.
- Validate source identity, metadata, decoded media, hashes, LFS pointers and batch seals.
- Read, reuse and restore fail closed on absent, changed or unrelated objects; reads never fetch.
- Reuse requires matching slot and input hash and preserves original provenance.
- Prove bounded behavior and corruption refusal in finite service tests before implementation.

## Standalone API boundary

`VideoArchiveService(root)` supports `write`, `read`, `current`, `restore` and explicit `fetch`.
Read results contain sealed batch metadata and a map of verified, batch-relative media bytes.
Only explicit fetch uses a configured Git remote alias. It retrieves the requested batch's LFS
objects and exact referenced source archive refs, preserving conflicting local refs and primary
branches. A fetched-only snapshot can be read or restored with `within = pointer.evidence.commit`;
fetch does not advance the local evidence branch. Restore writes only inside the repository.

Original source commit, tree and committed unit identity are checked without executing the app.
The admitted build ID is preserved; proving that build ran belongs to parent verification.

## Future Enhancements

- Root integration owns parent verification record links, current-input proof and flag attachment.
