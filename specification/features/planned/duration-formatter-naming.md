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
