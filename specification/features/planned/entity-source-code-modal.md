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

## Original Source-Viewer Verification

The final unchanged regression pair is test-only `ebc48834` and product `b07584fb`.
The preview-runner mapping is prepared before the failing checkpoint; the normal
preview inventory now includes the source spec. Desktop source checks retain
test-owned synthetic screenshots rather than requesting sealed evidence from an
unstamped dev fixture. Existing card layout and navigation assertions remain.

Root source bytes, explicit gaps and dirty-tree isolation, Reports source viewing,
Desktop source selection and the normal function-card contract pass together.
Fresh responsive captures, normal repository checks and real Git-backed browser
flows supplement that focused proof.

## Original Source-Viewer Verification Boundary

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

## Source-Tab Placement Delivery

- Catalog cards, rows and entity headers have no View code action. Every entity's
  Source tab retains ownership details and a button opening the shared modal;
  implementation text is never shown inline behind it.
- Placement commit: `9d465581`; final executable source: `5a309df8`.
- Test-only checkpoint: `c42b186b`; immutable red record:
  `aa5764e06be8e73569962b00a830b6e043d5377ce595e9315ba1ad6609284ec2`.
- Unchanged green at `5a309df8`:
  `6aa2deca42de1d1769444cfed5cef8377c22268af05a27ec5d4c1d9008972798`.
- Reports source/navigation coverage: 44 browser cases passed, including seven
  entity categories at desktop, tablet and phone widths. Desktop source and card
  coverage: 11 passed. The existing 1,001-helper responsiveness checks passed.
- At metadata revision `66fb79fe`, Reports' complete check passed with 613 unit
  tests; Desktop's complete check passed with 870 unit tests and three skips.
  Both include formatting, types, lint, build and audit. Desktop's iOS limit
  check inspected 53 Swift files with no findings; this is not device proof.
- Root audit, the 1,316-unit registry and all 25 required explanations pass.
  The 13 shared component dependency checks pass; dependency/import files are
  unchanged from their tested revision through the final source revision.
- All 12 changed units have exact-source size/complexity observations. Whole
  console output is 362,935 JavaScript bytes and 90,138 CSS bytes. The rebuilt
  console bytes match the tested source build. Twenty-one modal flows record
  timing and coarse whole-page heap; these are not per-component allocations.
- Fresh real-project captures show the 53-model SQLite catalog without code
  actions, the detail Source button and its modal at three widths. Displayed
  `CatalogBranch.ts` equals its selected Git blob at `edd93768` byte for byte.
  Renderer and SQLite branches remain separate. No browser errors were observed.
- Captures are retained outside Git and verified in private R2. The active
  feature report is `e96cc3a9-5130-41be-9a71-21bd084fede2`.

## Open Full-Verification Boundary

`bun run check` at `66fb79fe` passed formatting, types, lint, Rust, build, 891
root unit tests, 230 CLI/history tests and 32 package/report-isolation tests.
It skipped 25 unit and three scale cases. One package case failed:
`test/reports-concurrent-runs.e2e.test.ts` exceeded its unchanged 180-second
deadline while waiting for its first synthetic history. The unchanged isolated
retry seeded the first history but exceeded the same deadline for the second.
Both failures are fixture history-readiness assertions; their underlying
performance cause is unproven.

The root command stopped in the package stage. Its later stages were not
reached. Reports and Desktop complete checks, root audit, registry and reasons
were run separately afterward as recorded above. Full verification, the loop's
verify step and report finalization remain open. No application promotion,
publication or physical-device install is claimed.

The sampled root-check process-tree peak RSS was 2,925,772,800 bytes across 21
processes, sampled each second. Shared Codex/browser and other project usage is
not attributed to that figure.

## Proposed Audit Checkpoint

The earlier viewer introduced a store factory at complexity 12. Its root check
stopped before the child Reports audit, which caught it during this correction.
The factory now shares guarded error formatting and passes at complexity 10.
The prevention proposal is an affected-workspace audit checkpoint in the existing
AGENTS verification rules, before the long root check. The existing audit rejects
the original factory and accepts the repaired one. This proposal is recorded;
no new workflow or policy change was applied.
