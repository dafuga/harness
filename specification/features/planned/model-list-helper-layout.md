# Feature: Model List Helper Layout

## Overview

The Models collection uses the existing helper cards and responsive grid. A card
shows the model name and a smaller Used In row with direct consumer links.
Search, filters and branch/commit navigation retain their existing behavior.
The approved follow-up also retains a removed private function at its explicit
removal-commit address using its last active parent contract.

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

## Future Enhancements

- Model detail design and SQLite catalog integration are separate changes.
