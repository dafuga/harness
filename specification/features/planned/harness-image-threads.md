# Feature: Harness Image Threads

## Overview

Design proposal only. Daniel requested GPT Image concepts for a future Electron Harness app and explicitly deferred implementation.

[Final image gallery](../../designs/harness-image-threads/README.md) and [proposed per-unit folders](../../designs/harness-image-threads/folder-structure.md).

## Acceptance Criteria

- Keep the existing five-category Harness navbar; remove the global mode toggle.
- Place Plan / Change, Codex CLI / Claude CLI, and model selection inside the image comment input.
- Highlight an image region to open an entity-specific thread with its design and commit history.
- Commit image versions under each proposed page/component's designs folder; record exact hashes and approvals.
- Keep design approval separate from runtime verification and subsequent code requests.
- Show no source files in the ordinary entity view; retain Details → Source.

## Future Enhancements

- Electron, CLI dispatch, annotations and planned-entity lifecycle await implementation authorization.
- Extend Harness generators for the proposed layout before creating implementation files.
- Preserve the canonical unit registry, current Opus scope and existing verification/evidence system.
