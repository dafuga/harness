# Verification status

- Symptom: the first validated evidence read started thousands of Git processes before a page preview could load.
- Guard: the real binary Git fixture failed with four per-file blob readers where the unchanged regression requires one batch. The isolated serial fixture was removed afterward.
- Repair: one binary evidence batch and groups of up to 64 metadata reads. Validation, path order, missing-file errors and pinned revisions remain unchanged. Returned buffers do not alias.
- Focused checks: 17 tests passed, including binary framing, ordered reads, registry integration, tampered records and inherited evidence. The scenario wrapper also passes.
- Independent read-only review found no blocking integrity issue.
- Diagnostic comparison: identical full evidence answers at source `ff47c377`, notes `af402442`, evidence `bcc7e1b4`. Serial: 88,608 ms and 8,093 blob-reader processes. Batched: 8,037 ms and 94 blob-reader processes. Bun 1.2.18, macOS arm64; changing host load means this is not an approved benchmark baseline.
- Full repository checks, final native inspection and final exact-revision verification remain pending.

Diagnostic logs and screenshots stay outside the source repository in the task delivery directory.
