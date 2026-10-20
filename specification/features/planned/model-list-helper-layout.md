# Feature: Model List Helper Layout

## Overview

The Models collection uses the existing helper cards and responsive grid. A card
shows the model name and a smaller Used In row with direct consumer links.
Search, filters and branch/commit navigation retain their existing behavior.
The approved follow-up also retains a removed private function at its explicit
removal-commit address using its last active parent contract.
The approved compatibility repair restores Desktop's expandable verification
coverage beside documented examples and bounds the shared browser fixture typing.
The approved Remote follow-up simplifies approval validation to meet its existing
complexity limit while preserving project selection and optional comment permissions.

## Acceptance Criteria

- Models and helpers use identical card appearance, spacing and responsive columns.
- Model cards open model details, and consumer links retain the selected branch/commit.
- Cards omit the former purpose, shared, verification and separate Open columns.
- Search, empty states and filters work at desktop, tablet and phone widths.
- The existing standardized card-grid scenario includes Models and fails before repair.
- The same unchanged scenario passes afterward with test-owned before/after captures.

- Private functions remain absent from shared collections at every revision.
- At a recorded removal commit, private detail addresses show their parent contract
  and the Removed at this commit verdict, for tombstones and fully deleted entries.
- Missing parents and revisions without that recorded removal remain explicit gaps.

- Desktop Examples displays documented usage or its stated gap, with recorded tests
  available in a collapsed disclosure that opens and closes without leaving the tab.
- The shared evidence fixture typechecks without changing its synthetic reads,
  artifact admission rules or serialization behavior.
- Remote approval keeps exact input keys, one to 64 distinct local project IDs,
  boolean agent permission, and the existing optional comment-permission rules.
- Remote lint passes its unchanged complexity limit; the same approval cases pass
  before and after the cleanup.

## Compatibility Coverage

The existing `ui-evidence-review` address scenario opens recorded verification but
did not assert the closed state or preserve an assertion-owned capture. Strengthen
that scenario to cover both states alongside the documented-usage gap. Desktop's
normal typecheck is the guard for the evidence fixture's excessive type inference.
The shared Examples component intentionally accepts documentation only; Desktop
owns its recorded-verification disclosure.

Remote's existing control-input cases miss part of the comment-permission matrix
and conflate the project-count ceiling with duplicate rejection. Extend those
standard cases with exact output shape, omitted comments, invalid comment values,
64 distinct projects and 65 distinct projects. The existing lint failure is the
red check; behavior is already correct and must remain unchanged.

## Future Enhancements

- Model detail design and SQLite catalog integration are separate changes.

## Local Verification Handoff: 2026-10-20

The code is committed on `fix/model-list-helper-layout`. Application code has not
been pushed, merged or deployed. The SQLite catalog remains in its separate
`feat/sqlite-model-storage` worktree at `edd93768`.
The verified source base is `cd36c21c5b2e593e2e30ea549146c519f246a2f8`.
During verification, `origin/main` advanced to
`c6d8a8706bf2848ead437c107854ca9df58d5a2c`; that upstream change is not integrated
or covered by this branch's results.

| Repair                                             | Product commit | Result                                                                                       |
| -------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| Models reuse helper cards                          | `06fbc6d4`     | Unchanged card-grid regression passes at all covered widths.                                 |
| Private removal details retain the parent contract | `2eb9c49b`     | Unchanged history regression and browser case pass.                                          |
| Desktop fixture initializer typing                 | `f34b49d6`     | Typecheck passes with both trusted initializer boundaries bounded.                           |
| Desktop Examples verification disclosure           | `9e324911`     | Unchanged red/green scenario, authored examples and manual current/history/phone flows pass. |
| Remote approval guard extraction                   | `0bf42a0f`     | Identical lint and approval characterization command changes from failing to passing.        |

Remote red record `492a14014c14eceecd60f72210326c9fd36fd820b12ceaf771540e4567035925`
belongs to test-only commit `6c9bccb5`. Green record
`161dea3d308765842efcd4b0ea9c9e7a698462940d7f0b539bfb1f021d608175`
belongs to `0bf42a0f`. Tests, fixtures, command and environment are unchanged.
The red failure is the existing complexity limit; all four runtime cases pass
before and after repair. Field-read order and optional comment omission are retained.

Newly run checks include the complete Remote package check (27 files, 135 tests),
seven Desktop approval/binding integration cases, current registry validation and
root audit. Final root formatting, types and lint pass; current Desktop typecheck
reports zero errors and warnings, and Desktop lint passes.
Desktop's complete unit/integration run passed 870 tests with three
skips. Its renderer and Electron builds, project-local audit and 53 Swift file
limits passed. Earlier Reports verification passed 613 unit tests, 68 entity
browser cases and nine hosted-catalog cases; those unaffected suites were not rerun
for the Remote extraction.

The full Desktop browser suite finished with **152 passed and 42 failed**. Failures
include project-agent expectations, evidence layouts, native navigation, design
images, remote-host approval selectors and search flows. Some assertions reference
older navigation or inline-search contracts; a complete baseline attribution was
not performed. Their diagnostics are retained, and the checks were not weakened.
Hub also retains its separately observed projects-controller complexity 11 failure
against limit 10. Full repository verification has not passed; loop verification
steps remain pending. Project Reports run `f5eee44e-d1dc-4426-9766-1172744a9463`
stays active. Its earlier media connection failure recovered and the Desktop
regression captures were uploaded successfully; no completed report is published.

Fresh in-app browser captures show the Models list at 1280 and 390 pixels, model
detail navigation and the restored Desktop Examples disclosure. These use the
normal compiled renderer with synthetic Orders fixtures, not a live project DB or
physical device. Both inspected browser tabs reported no console errors.
Evidence and full logs are outside Git under
`~/.codex/project-reports/work/model-list-verification/` and its parent directory.

### Changed Unit Sources and History

The managed real-project preview is occupied by another active session. Actual
registered entity and History pages cannot be served here without disturbing that
session. The following sources and explicit commits identify each changed unit;
the synthetic preview is not presented as a real Harness project history page.

| Registered unit                                     | Source                                                                                                        | History commit |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------- |
| `reports.component.harness-explorer-catalog-screen` | [ExplorerCatalogScreen.svelte](../../../packages/reports/src/components/harness/ExplorerCatalogScreen.svelte) | `06fbc6d4`     |
| `reports.component.explorer-function-card`          | [ExplorerFunctionCard.svelte](../../../packages/reports/src/components/ExplorerFunctionCard.svelte)           | `06fbc6d4`     |
| `reports.component.harness-explorer-index`          | [ExplorerIndex.svelte](../../../packages/reports/src/components/harness/explorer-index/ExplorerIndex.svelte)  | `06fbc6d4`     |
| `reports.function.entity-catalog`                   | [entityCatalog.ts](../../../packages/reports/src/utils/entityCatalog.ts)                                      | `06fbc6d4`     |
| `reports.component.harness-entity-frame`            | [EntityFrame.svelte](../../../packages/reports/src/components/harness/EntityFrame.svelte)                     | `2eb9c49b`     |
| `reports.function.explorer-entities`                | [explorerEntities.ts](../../../packages/reports/src/utils/explorerEntities.ts)                                | `2eb9c49b`     |
| `desktop.component.entity-view`                     | [EntityView.svelte](../../../packages/desktop/src/components/entity-view/EntityView.svelte)                   | `9e324911`     |
| `desktop.model.desktop-types`                       | [Desktop.types.ts](../../../packages/desktop/src/models/Desktop.types.ts)                                     | `404ad1c1`     |
| `remote.validator.remote-input`                     | [RemoteInputValidator.ts](../../../packages/remote/src/validators/RemoteInputValidator.ts)                    | `0bf42a0f`     |

The browser-only fixture initializer has no entity page; its source is
[ui-evidence-fixture.ts](../../../packages/desktop/tests/e2e/ui-evidence-fixture.ts)
at `f34b49d6`. The Desktop model type file has only a blank-line removal at
`404ad1c1` to meet the unchanged file limit; its types and behavior are unchanged.
