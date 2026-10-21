# Feature: Duration Formatter Naming

## Overview

Rename the numeric duration formatter to `formatDuration`. Its name must explain
that supplied seconds become display text; it does not inspect or measure audio.
The previous review verified purity and reuse but did not assess naming clarity.
The old name predates this review; this is a review-process gap, not a new runtime regression.

## Acceptance Criteria

- The export, three runtime callers and registered contracts use `formatDuration`.
- Existing formatting, flooring and invalid-input behavior remain unchanged.
- Preserve the registered unit identity `reports.function.evidence-media`.
- Review helper naming separately from purity and multiple-consumer eligibility.
- Read the implementation, describe its input/output operation and inspect a concrete call/result before accepting a helper.
- The existing media unit test enforces the descriptive export and preserves representative outputs. Its old coverage tested only results under the old name.
- The same unchanged test fails before repair, passes after repair and rejects restoring the old export in an isolated workspace.
- Inspect fresh before/after catalog screenshots and exercise helper navigation/search.

## Scope

Update the project and installed Harness skills. Do not impose a generic verb-prefix
regex: the review must compare the actual transformation with the name and signature.
A well-named single-consumer formatter still belongs with its owner; a file-reading
operation is effectful regardless of its name. Keep the existing purity/reuse rules.

## Verification Result

- Preserved red `213ae47f` and green `741c2b5e` with the same test, command and environment; the isolated old-name mutation fails and exact restoration passes.
- Reports `bun run check` passes: formatting, Svelte types, lint, 604 tests, three builds and audit. Three standardized catalog viewport cases pass.
- Manual browser uses the actual registry from `741c2b5e`: old-name search returns zero, `formatDuration(90)` opens the same unit and its string-output contract. Fresh screenshots inspected; no browser errors.
- Root audit passes; unit registry has no errors (64 existing uncertain units). Five focused root contract/index/shared-control suites pass (25 tests); the four-case hook suite has three passes and one existing failure at `test/hooks.e2e.test.ts:104`, expecting source bytes 87 to 148 while observing 100 to 161. This file is unchanged from baseline `24fcba33`.
- Root `bun run check` passes formatting, types, lint and kernel checks/build. The aggregate was interrupted during root unit tests after the focused hook test confirmed the known blocker. Remaining aggregate unit, E2E, packaging and workspace layers are not claimed passing. Keep the loop verification step and report in progress.
- Installed `harness-project` skill passes `quick_validate.py`; it lives outside project Git. The project root naming rule and reports-package link are committed. Manual semantic review distinguishes formatting, effectful file reads and single-consumer ownership; no naming regex was added.
- Local source only; no merge, deployment or publication. Managed viewer history for this branch is not indexed, so screenshot proof comes from the actual-commit local fixture rather than a live managed History entry.
