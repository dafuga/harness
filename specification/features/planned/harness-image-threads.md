# Feature: Harness Image Threads

## Overview

Daniel approved the final image concepts and authorized implementation on October 11, 2026. Build a local Electron Harness app with committed designs and image-specific Plan / Change threads.

[Final image gallery](../../designs/harness-image-threads/README.md) and [proposed per-unit folders](../../designs/harness-image-threads/folder-structure.md).

## Acceptance Criteria

- Keep the existing five-category Harness navbar; remove the global mode toggle.
- Place Plan / Change, Codex CLI / Claude CLI, and model selection inside the image comment input.
- Highlight an image region to open an entity-specific thread with its design and commit history.
- Commit image versions under each proposed page/component's designs folder; record exact hashes and approvals.
- Keep design approval separate from runtime verification and subsequent code requests.
- Show no source files in the ordinary entity view; retain Details → Source.
- Use a native project picker and show only the selected repository's entities and history.
- Keep draft plans separate from active unit manifests until real implementation exists.
- Preserve immutable designs, approvals and threads across branches and full commit paths.
- Run the selected Codex or Claude CLI with its selected model; discover available models and report provider failures without substitution.
- Generate Plan images through the signed-in Codex image capability, using the referenced image and highlighted region when revising.
- Make approval bind the current image hash and contract; a new version needs approval again.
- Require an explicit Change message before coding, and retain actual changed paths and job outcomes.
- Constrain desktop IPC to trusted local renderer frames and the chosen project.
- Preserve unrelated work and staged files when committing designs through Git LFS.
- Prove concurrency, historical viewing, tamper rejection, approval invalidation, annotation scope and cancellation in isolated fixtures.
- Verify actual Electron flows and fresh responsive screenshots.

## Integration

- The planning workspace owns typed artifact contracts, per-unit planning scaffolds and Git-backed persistence.
- The desktop workspace owns the Electron renderer, trusted IPC and CLI jobs.
- Both workspaces begin with Harness generators and retain their audits and verification loops.
- The other active Harness task owns the existing core explorer. Integrate its tested commit and public contracts without editing its unfinished files.
- Design approval and CLI success never imply runtime verification. Existing test evidence stays in the Harness evidence system.
- Delivery remains local on the feature branch. Production publication needs separate authorization.
