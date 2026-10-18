# Feature: Compact Contract Examples

## Overview

Contract tables show Name, Type and Example. Each row ends with an info action that opens the full existing example modal.

## Acceptance Criteria

- Replace the Description column with a one-line example preview for inputs, outputs and errors/config provisions.
- Clip long examples with an ellipsis inside their cell. Preserve full values and descriptions in the modal.
- Put the accessible info action in the final column, with the existing keyboard and focus behavior.
- Preserve false, zero, null, empty strings, structured data and escaped markup. Show missing or illustrative examples honestly.
- Preserve revision routing and fit desktop, tablet and phone viewports.

## Verification

Strengthen the existing entity-contract, entity-details and responsive entity preview checks, including a long shared fixture. Commit and record their failing checkpoint before the UI change, then record the unchanged passing checkpoint.

The initial browser check tested overflow and ellipsis, but missed a pinned action covering the preview. The shared responsive helper now checks visible preview width and button containment at all three viewports. Red `e3119d67` rejects the clipped layout; unchanged green `beef845c` proves the repair.

At `890e82c0`, formatting, types, lint, 569 unit checks, builds, 62 browser preview checks and all five capture checks pass. Captures exercise 48 states at three viewports, the example modal, audio and mismatched-build rejection.

The package check remains blocked by existing file-length findings in `entity-preview-marks.spec.ts` (222), `Harness.types.ts` (222) and `EntityTests.svelte` (228); the loop's verification step stays pending. Electron acceptance remains paused. Peak sampled physical memory was 7.17 GB against the 10 GB combined budget.
