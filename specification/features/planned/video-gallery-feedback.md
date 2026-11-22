---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Feature: Video Gallery Feedback

## Overview

Review attached video clips in the existing state and evidence galleries, then flag an exact frame with a note for the owning unit.

## Acceptance Criteria

- Videos retain their original verification record, revision, clip identity and viewport through the gallery projection.
- Playback is user controlled, uses metadata preload and an available poster, and never autoplays.
- A reviewer can seek flagged frames, read active/stale/resolved standing, and submit the current frame with a note through the owner-protected API.
- Missing attachment references disable flagging. Loading and submission failures remain visible.
- Existing screenshot previews and image navigation retain their behavior.
- The unchanged projection and component assertions pass; the parent task owns browser verification and screenshots.

## Future Enhancements

- Region selection in the player; the backend already accepts optional normalized regions.
