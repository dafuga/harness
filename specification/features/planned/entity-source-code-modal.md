# Feature: Entity Source Code Modal

## Overview

All seven catalog categories expose View code on cards or rows and entity details.
The shared modal shows actual file contents from the selected committed revision.
The existing Source tab remains available and shows the same source reader.
Closing the modal retains catalog search, filters, address and keyboard focus.

## Acceptance Criteria

- Pages, Shells, Components, Helpers, Configs, Services and Models all expose the action.
- Source belongs to the entity's owned files at the selected revision, including
  multiple files, historical versions and explicitly retained removal contracts.
- History builds retain source as content-addressed text beside existing protected
  media. File contents are loaded only when requested; no working-tree fallback is used.
- Binary or unavailable files and older histories without source snapshots state a gap.
- Closing with Escape or the close control restores the initiating control and view.
- Selecting files, reopening, changing entity/revision and delayed reads cannot show
  stale contents. Source is rendered as escaped text rather than executable markup.
- Desktop uses its existing authorized source bridge and the same shared reader/modal.
- Standard browser scenarios cover all kinds and desktop, tablet and phone widths.
- Unchanged committed red/green proof, exact-commit measurements, relevant full checks
  and fresh manually inspected real-project screenshots are retained.

## Coverage Diagnosis

The existing unified Source scenario checks ownership filenames only. It never
asserts actual code or modal actions. The normal history-index fixture checks
contracts, helpers and media but never compares owned source snapshots to Git blobs.
Extend these standardized fixtures and cases before implementation. The source
reader also needs file switching, revision isolation, refusal and delayed-read cases.

## Component Reuse

Reuse the Reports Modal text variant, HarnessAction, Select and code styles.
The source reader is shared with Desktop's Source panel and catalog actions.
Claude owns the bounded visual edits; Codex owns source archival, state, tests and
integration. Existing prepared histories remain readable and show explicit gaps.

## Future Enhancements

- Editing or saving code is outside this read-only viewer.
