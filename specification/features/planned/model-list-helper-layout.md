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
