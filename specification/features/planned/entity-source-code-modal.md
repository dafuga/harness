# Feature: Entity Source Code Modal

## Overview

Every entity detail exposes View code only within its Source tab. Catalog cards,
rows and detail headers have no code action. The shared modal shows actual file
contents from the selected committed revision. Source ownership stays in the tab;
code is loaded only after opening the modal. Closing retains the Source tab,
address and keyboard focus.

## Acceptance Criteria

- Pages, Shells, Components, Helpers, Configs, Services and Models expose the action
  only within the detail Source tab, with no inline code reader behind the modal.
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

## Source Tab Placement Coverage

The standard Reports source scenarios and Desktop source scenarios previously
required catalog and detail-header actions. They tested source reading but never
restricted its entry point. Update these same category/viewport scenarios and
concise-card assertions before the placement repair. Assert no catalog or header
action, no inline code, a Source-tab modal trigger, retained Source address/focus,
historical code, file switching, delayed reads and explicit refusal/legacy gaps.

The `source-tab-code-action` loop records this follow-up independently of the
earlier source archival implementation and its full-check boundary below.

## Original Coverage Diagnosis

The existing unified Source scenario checks ownership filenames only. It never
asserts actual code or modal actions. The normal history-index fixture checks
contracts, helpers and media but never compares owned source snapshots to Git blobs.
Extend these standardized fixtures and cases before implementation. The source
reader also needs file switching, revision isolation, refusal and delayed-read cases.

## Component Reuse

Reuse the Reports Modal text variant, HarnessAction, Select and code styles.
The source reader is shared by the Reports and Desktop Source-tab modals.
The requested placement correction reuses the existing action and modal, with no
new visual design. Existing prepared histories remain readable and show explicit gaps.

## Future Enhancements

- Editing or saving code is outside this read-only viewer.

## Verification Evidence

The final unchanged regression pair is test-only `ebc48834` and product `b07584fb`.
The preview-runner mapping is prepared before the failing checkpoint; the normal
preview inventory now includes the source spec. Desktop source checks retain
test-owned synthetic screenshots rather than requesting sealed evidence from an
unstamped dev fixture. Existing card layout and navigation assertions remain.

Root source bytes, explicit gaps and dirty-tree isolation, Reports source viewing,
Desktop source selection and the normal function-card contract pass together.
Fresh responsive captures, normal repository checks and real Git-backed browser
flows supplement that focused proof.

## Current Verification Boundary

- Product commit: `b07584fb`; unchanged failing checkpoint: `ebc48834`.
- Fresh source UI: 24 Reports cases and four Desktop cases pass at all widths.
- Reports unit suite: 613 passed; affected integration/dependency checks: 24 passed.
- The standard 1,001-helper responsiveness check passes at all three widths.
- Root audit, unit registry and all 42 required explanations pass.
- Full check: formatting, types, lint and Rust/kernel checks passed; the root unit
  stage ended with timeouts in four files. Related files pass on focused retry;
  the unchanged native toolchain case still takes 23.6s against its 5s limit.
- Full verification and the loop verify step remain pending; later full-check
  stages were not reached. Native-device and release proof are not claimed.
- Real browser proof uses 53 models from SQLite commit `edd93768`, alongside
  source-viewer commit `b07584fb`. The branches remain separate.
- Captures are retained outside the source tree and verified in private R2,
  respecting the instruction not to commit screenshots.
- The source-reader store and verification config have no explorer pages;
  handoff links use their source paths rather than invented entity URLs.
