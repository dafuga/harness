# Feature: Visible Helper Sharing

## Overview

Only list pure shared helpers with at least two distinct, resolved component,
service or model consumers in the Used In row. Use the same consumer set for
inclusion and display. The three-link display cap preserves the two-consumer threshold.

## Acceptance Criteria

- Every helper card has at least two distinct linked consumers in Used In.
- Exclude helpers with zero or one eligible consumer, even when other named-function references qualify the broad source contract.
- Multiple functions in one consumer unit count as one visible place.
- Excluded kinds and missing consumers do not inflate the visible count.
- Preserve pure-contract checks, three-link limit, per-export ownership, revision links and all other catalogs.
- Extend the standardized card unit test and three-viewport browser matrix; retain positive two- and three-consumer cases.

## Process Prevention

The Used In change at `5f3e02d7` exposed the older broad consumer definition without
aligning list inclusion to the visible consumer set. Its acceptance test explicitly
allowed a dash, so passing tests could not prove the existing sharing requirement.
At the acceptance-review checkpoint, require inclusion and displayed counts to use
the same resolved entity set; cover below-threshold and duplicate references in the
standardized matrix. Add this narrow rule to the project Harness skill. Prove the
matrix rejects restoring the old inclusion behavior in an isolated source archive.

## Verification Result

- Frozen red `0d1249ee` fails across all three viewports; fixed `43697a0f` passes the exact unchanged command, environment and fixtures. Green `9df47905c525f9dd6858dbb4fada0b66c21d28bff8a0a24277a78b89e6527587` pairs to red `41cfb79dcd3608d503661b06ac0e757c7cb2dff62abbfac087f6f6c3d6e82e2d`.
- Restoring allow-all inclusion in an isolated source archive makes the standardized unit guard fail. Restoring exact fixed source passes the same 19 tests and command.
- Reports `bun run check` passes: formatting, Svelte types (zero errors/warnings), lint, 605 tests, all three builds and audit. The full 65-case browser matrix passes, including search, responsiveness and revision-bound consumer links.
- Actual registry from `43697a0f` shows five helpers with visible distinct link counts `3, 3, 2, 2, 3`. Search for excluded `toCamelCase` returns zero. A two-use helper link was exercised; no browser errors. Fresh screenshots inspected.
- Root audit passes; registry check has no errors and 64 existing uncertain units. Root aggregate passes formatting, types, lint, kernel checks/build; it was interrupted during unit tests after a separate focused run reproduced existing `test/hooks.e2e.test.ts:104` source-byte expectation failure. Remaining root aggregate layers are not claimed passing. Keep verify and the report in progress.
- Local implementation only; no merge, deployment or publication. The managed viewer does not index this branch, so its entity History is not verified. Review registered `reports.function.entity-catalog` through its local source/Git history. Screenshot artifacts stay outside Git.
