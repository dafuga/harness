# Feature: Global Search

## Overview

One search field sits in the top bar of every Harness page: in the embedded `/harness` explorer
and in the one workspace that Web, Electron and iOS share (hosted projects included, since they
mount the same workspace). It finds entities of all six categories, Pages, Shells, Components,
Functions, Configs and Services, in the project and revision that are shown, and opens the chosen
one at once. The search logic and its presentation are one shared component and one shared
function; each host only adapts its own entities and its own way of navigating.

## Acceptance Criteria

- The field is visible at the top of every explorer route and every workspace project page, at
  desktop, tablet and mobile widths, without widening the page.
- Results come from every category of the shown revision, not only the open list. Each result
  shows its display name, a readable category badge and its purpose; source paths are never
  shown or searched.
- A query matches display names, unit IDs, purposes and, where the host has them, the names of
  declared contract inputs, outputs and errors. Exact and prefix matches of names and IDs rank
  first.
- The scope is the current project and the revision in view. With a commit pinned, the results
  are those recorded at that commit, each link keeps the full commit, and the field says which
  commit it searches; the branch tip is never searched in its place. Another project's entities
  never appear.
- Choosing a result opens its canonical address (a shell under `/shells/`) with the project,
  branch and pinned commit kept, in the normal URL grammar of the host.
- Keyboard: typing opens the list, Up and Down move the active result, Enter opens it, Escape
  closes the list and then clears the field; focus stays visible. The list is a labelled listbox
  of a combobox.
- With nothing matching, the list says so. While the host has no catalog yet, the field says it
  is loading and offers no stale results.
- Each result carries the revision it was found in, so a later option to search across history
  can list entries from other revisions without changing the presentation.

## Future Enhancements

- An explicit option to search across history, listing each result with its own revision.
