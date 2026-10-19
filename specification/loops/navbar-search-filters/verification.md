# Navbar search and catalog filtering

The right navbar icon opens the shared project search modal. Cmd/Ctrl+K focuses it, Escape restores the icon, and result navigation retains the selected project, branch and commit. Every catalog has local search, changed-only, verification and sorting controls. Reports filters shared usage; the shared workspace filters planning status because its catalog projection does not include usage data.

## Committed regression proof

- Test-only commit: `35a187f7ab5f6ef1f929f9216ad4876147994dcd`.
- Red record: `ad4cf26af6b1c60f611ca9644e5b02538aa92c1ecf9f24b94da0acb49588d72f`.
- Fix commit: `c5750b7a1a5417714fbe97bfd6f99910dd3c8007`.
- Green record: `8998eaca07f394810a6e8990e07969a0b3f4c0cdedf2523d806610ad05065c6e`.
- The sealed pair uses the same committed tests, fixtures, command and environment. Later maintenance only removes blank lines for file limits, updates the older shared-navbar SSR expectation and extends shared catalog filter coverage.

## Checks

- Reports: 575 unit cases; formatting, type checks, lint and all three builds passed. Its final audit passed after trimming blank lines from two oversized test files.
- Reports browser: 76 shell cases and 65 entity cases passed. Toolbar collections and the desktop/tablet/phone fit cases were rerun after the final layout adjustment.
- Shared renderer: 16 search, scope and catalog browser cases passed; navbar SSR case, type checks, formatting and changed-source lint passed. The desktop ESLint config excludes browser specs, which were exercised by Playwright.
- Root: 13 shared-import/impact cases, TypeScript and static audit passed. Registry indexing preserved declared documentation and screenshot bindings.
- Manually exercised the existing port 5688 preview: independent local search and usage filter, global modal search, Enter navigation to Activity freshness and return to the Pages catalog. Inspected fresh screenshots with loaded images.

Opus 5.5 authored the shared search, result list, navbar styles and catalog controls in an isolated staging copy. Integration retains only supported filters rather than exposing an empty usage filter in the shared renderer.

Native Electron/iOS builds and testing remain paused at Daniel's request. The root aggregate check was not run because it includes native work. Existing preview servers remain running. Screenshots and runtime capture artifacts are kept outside tracked source; scoped evidence records must not be presented as complete repository verification.
