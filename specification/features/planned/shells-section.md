# Feature: Shells Section

## Overview

Shells is a category of its own, after Pages, in the shared app that Web, Electron and iOS
render and in the `/harness` viewer. A shell is app or workspace composition: the frame that puts
navigation and content together for a host, or what mounts that frame into a host. Components
keeps reusable visual UI: the navigation bar, selects, the project agent and the like.

## Acceptance Criteria

- Both apps navigate Pages, Shells, Components, Functions, Configs, Services with the existing
  dark and gold navigation bar, icons and selectors; no new bar is drawn.
- A unit is a shell only when its manifest declares kind `shell`. Nothing is inferred from an id,
  a title or a file name. Declared now, kind alone, every id, source, owner, dependency, scenario
  and budget unchanged: `desktop.component.workspace-shell` (the shared workspace shell),
  `hub.component.hosted-workspace` (mounts it for hosted projects),
  `reports.component.harness-harness-console` (the viewer's frame of bar and screen), and
  `reports.component.harness-harness-shell` and `reports.component.harness-screen` (mount that
  frame without a router and on a route page).
- Each revision lists a unit under the category its own recorded manifest declares. A commit that
  recorded kind `component` stays in Components. No snapshot, record or note is rewritten.
- `/components/<id>` of an entity that is a shell at the shown revision opens `/shells/<id>` with
  the same branch, commit, section and tab; at a revision where it is a component it stays.
- A shell has its index, overview, Details, Source, History, Used In and Uses at a branch tip and
  at a pinned or retained commit. Its evidence is the captures and tests already recorded for it;
  nothing is made up.
- Plans and agent requests accept Shells and plan them with images, as pages and components are
  planned. Hosted projects stay comments-only; every other category behaves as before.
- Reindexing keeps a declared shell kind and the stable id. The component generator is unchanged
  and no new code shape is needed.
- Tests are written first and fail on the unchanged product; the same tests pass afterwards. The
  browser checks keep before and after screenshots at desktop and mobile widths.
- The five categories named by the earlier explorer-shell, explorer-entities, explorer-data and
  agent-creation specs are six from this feature on; those records are left as they were written.

## Future Enhancements

- A generator for new shell units, if a shell ever needs a source layout of its own.
- Reviewing other compositions, such as layouts, case by case rather than by kind.
