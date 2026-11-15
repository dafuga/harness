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

## Future Enhancements

- Root integration owns parent verification record links, current-input proof and flag attachment.
