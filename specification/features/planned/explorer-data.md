# Feature: Explorer Data

## Overview

The Harness console is an explorer of the entities of one repository: Pages and revision-scoped module collections. This feature is its address, its data and its verdicts: where a
page is in history, which units it lists, what proves each of them, what a commit is compared
with and which commits changed an entity. The shared bar and the entity screens render what is
decided here and decide none of it.

## Addresses

- `/harness/branch/{branch}/{category}[/{entity}[/details|/history]]` shows a branch at whatever
  its tip is in the built history. `/harness/branch/{branch}/commit/{sha}/…` shows one selected
  commit and keeps the tip beside it. A branch is one encoded segment; a commit is a full hash.
- A commit that no branch reaches has the form without a branch. No branch is invented for it.
- `/harness`, a branch alone and a commit alone open Pages in the same scope.
- A tab of a section is kept in `?tab=`, so Details → Source can be linked to and reloaded.
- Every earlier address leads into the explorer: the map, compare, history, growth and activity
  views, the query form, branches written with their slashes, and the report and analytics pages.
  A selected unit opens as the entity it is. A report link opens Pages at the commit the report
  names when this history holds it, else Pages at the branch tip.
- An address whose branch, commit or pairing of the two the history does not hold is reported as
  missing. An entity that is absent at a revision stays absent; no other revision is shown.

## Navigation

- Primary navigation is Pages, Modules, Styles, Configs and Platforms.
- Modules contains Layouts, Components, Models, Services, Helpers and Types, using shared tabs.
- Category changes preserve branch and selected commit, clearing the entity and selected helper.
- The same navigation works at desktop, tablet and mobile widths without widening the page.

## Classification

- A page is a unit that renders an address, whatever kind it was registered as. A route file that
  renders nothing is a service, and a visual layout is a reusable frame with child content.
- Helpers require explicit purity and distinct runtime consumers. Rules, guides, templates,
  entry points, scripts and style sheets retain their own roles where used.
- Models are persisted data wrappers proven by their selected-revision source declarations.
  Existing shared interface and type-alias modules belong under Types, with stable identities and
  source paths. Display names omit `.types`. Unproven runtime classes stay unclassified.
- Type companions owned by components and services remain with those owners. Types lists existing
  shared type modules, rather than every exported declaration. Type details show their own fields,
  optionality, method signatures and alias expressions through the shared contract tables.
- A page leads to its components, those to their components and those to functions. Configs and
  services are sections of their own.

## Verdict

- Proven only when the newest usable record of exactly that commit passed its gates and tests,
  every scenario that covers the unit has a result, every required state has a passed capture of
  that commit for each declared viewport, and no limit of the unit is open.
- Anything missing, stale, rejected, failed or unknown is not proven. There is no share of it.
- A unit no scenario covers is not proven by tests alone, except a config.

## Evidence

- A branch tip is shown with the captures of the tip alone: one set, no before.
- A selected commit is compared with its first parent, each side from its own record. A revision
  that is not the first parent is refused, and a first commit says it has none.
- End-to-end results of a function or service are united by scenario, state and evidence on both
  sides. Equal recorded bytes are unchanged behaviour. Behaviour is unknown, and never unchanged,
  when a side has no usable record, the profiles differ, or a result is rejected, stale or missing.
- An artifact is read from the protected media path and checked against its recorded hash before
  anything in it is shown.

## Acceptance Criteria

- Unit tests of each helper fail on the unchanged implementation and pass after it.
- The classification holds for the registry of this repository. Types has dedicated catalog,
  entity, contract and history routes, with required visual captures for each settled page.
- Browser acceptance on an isolated synthetic history fails on the unchanged console and passes on
  the explorer: five primary destinations, scoped module tabs, tip and commit addresses, earlier addresses, page to function
  traversal, source only on request, binary verdicts, one current capture against a parent pair,
  end-to-end behaviour, history, and no sideways scrolling at tablet and phone widths.
- Page, data, media and export requests still pass the admin policy first.
- Same-revision tabs retain loaded content. Category changes reuse revision calculations, and
  tabs, navigation and search complete within 500 ms in the standardized 1,000-function console
  fixture at desktop, tablet and mobile sizes. Recorded history is read-only data, not deeply
  reactive state. Reused calculations stay scoped to their actual revision and parent; switching
  commits never borrows a previous revision's verdict, contract or evidence.

## Future Enhancements

- The index does not say which units a test file covers, so a failed test of a record leaves
  every unit of that commit unproven. Recording the units of each test would narrow that.
- The index does not list the units each commit changed, so the history of an entity reads the
  stored revision of a commit to say whether it changed there.
