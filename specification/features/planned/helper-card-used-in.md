# Feature: Helper Card Used In

## Overview

Show each helper's first three distinct component, service or model consumers beneath
its example invocation. Use smaller text and real links that preserve revision scope.

## Acceptance Criteria

- Every helper card has a smaller Used In row; absent eligible consumers show a dash.
- Resolve each exported helper's own runtime consumers, not module-wide dependencies.
- Skip missing units, pages, functions and duplicate consumer ids before limiting to three.
- Preserve recorded consumer order and use readable entity names.
- Component, service and model links open their entity within the same branch and current/commit scope.
- Keep the invocation link, concise layout, responsive grid and existing shared navigation.
- Extend the standardized catalog browser matrix and card unit tests. Existing tests required a single link and did not cover usage; update those assertions before product changes.

## Verification Result

- Final source is `5f3e02d7`; corrected frozen tests are `802a20bc`. The same command and environment first fail on missing consumer links, then pass Svelte typechecking, three viewport/current/commit browser cases and 19 card/catalog unit tests. Latest green record is `e6a666e828d942b5a176cc02021c3a0379d3f6b7a8e1200ed751f1800df45287`, paired to red `746376c98f63f2e1c3de7be01396964d6935633350bc97a3e6f5b308b3129145`.
- The first broader check caught a missing test-fixture import and optional consumer typing. Corrected the fixture before a fresh frozen red/green pair; preserved earlier proof and repair history.
- Reports `bun run check` passes: formatting, Svelte types (zero errors/warnings), lint, 605 tests, three builds and audit.
- The complete 65-case entity browser matrix passes, including 1,001-helper responsiveness, search, every viewport, examples and revision navigation.
- Five root shared-UI, readable-contract and indexing suites pass (25 tests). Root audit and units check pass; 64 existing uncertain units remain.
- Root aggregate passed formatting, types, lint and kernel checks/build, then was interrupted during unit tests after a focused run reproduced the existing `test/hooks.e2e.test.ts:104` source-byte expectation failure. Remaining root unit/E2E/package/workspace layers are not claimed passing. Keep loop verification and the report in progress.
- Actual-commit local preview uses the registry from `5f3e02d7`. Component and service destinations were exercised; no console errors. Fresh actual desktop and test-owned desktop/mobile screenshots were inspected. Screenshot artifacts are uncommitted.
- The managed viewer does not index this branch, so its entity History pages are not verified. The affected registered units are `reports.component.explorer-function-card` and `reports.function.entity-catalog`; their local source and Git history are the reviewable implementation. No merge, deployment or publication occurred.
