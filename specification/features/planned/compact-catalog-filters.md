# Feature: Compact catalog filter dialog

## Outcome

Every catalog shows one row: its local search field on the left and one filter icon on the right. Changed-only, verification, usage or planning, and ordering live in the shared modal.

## Acceptance

- No inline filter or sort controls outside the modal, on any supported catalog or viewport.
- Icon opens Filters with all existing choices, Done/Escape/backdrop closes and restores focus.
- Choices persist when reopening; filtering stays immediate and composes with local search.
- Reset filters leaves the local search query intact. An active indicator stays on the same icon.
- Search and icon stay in one row without horizontal overflow on desktop, tablet and phone.

## Coverage gap

Existing collection and shared-workspace cases assumed inline controls. Extend those same cases to open the modal, apply choices, close it, and verify the list and compact geometry. Keep source-bound screenshots outside tracked source.
