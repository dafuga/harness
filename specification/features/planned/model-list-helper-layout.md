# Feature: Model List Helper Layout

## Overview

The Models collection uses the existing helper cards and responsive grid. A card
shows the model name and a smaller Used In row with direct consumer links.
Search, filters and branch/commit navigation retain their existing behavior.

## Acceptance Criteria

- Models and helpers use identical card appearance, spacing and responsive columns.
- Model cards open model details, and consumer links retain the selected branch/commit.
- Cards omit the former purpose, shared, verification and separate Open columns.
- Search, empty states and filters work at desktop, tablet and phone widths.
- The existing standardized card-grid scenario includes Models and fails before repair.
- The same unchanged scenario passes afterward with test-owned before/after captures.

## Future Enhancements

- Model detail design and SQLite catalog integration are separate changes.
