# Feature: Navbar search and catalog filters

## Outcome

Find any entity through a right navbar search icon and modal, independently of revision controls. Filter the current catalog directly above its cards.

## Acceptance criteria

- Shared global search opens from one right aligned icon or Cmd/Ctrl+K, focuses its query, supports keyboard navigation, closes on Escape and restores focus.
- Results stay scoped to the selected project, branch and commit, with normal and modified link navigation preserved.
- All six catalog categories retain local search, changed-only and ordering. Verification filters compose with the query and changed-only; Reports additionally filters shared usage, while the shared workspace filters planning status.
- Empty results offer a reset. Controls and modal fit desktop, tablet and phone.
- Browser flows produce no unexpected console or page errors. Native Electron/iOS testing remains paused.

## Coverage gap

Existing explorer-shell-search and ui-search tests require an inline navbar combobox and dropdown. They do not exercise an icon-triggered modal, focus restoration or shortcut. Existing collection coverage checks query, changed and order only; extend those standardized cases for combined filters and reset.
