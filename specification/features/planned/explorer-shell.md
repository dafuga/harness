# Feature: Explorer Shell

## Overview

Every route of the Harness explorer shares one horizontal bar and one set of shared pieces. The
bar holds the gold mark, the Harness name and the repository the website shows, five categories
(Pages, Modules, Styles, Configs, Platforms, in that order) with an outline icon above each
label and a gold line under the one that is shown, and on the right the branch with the hash of
its tip, the commit that is viewed with what it is to that tip, and Go to tip. The same icon
set, binary verification badge, outlined action, row of tabs and style tokens are used by the
entity screens, so nothing in the explorer draws a second version of them.

The shell decides no address. It is given the resolved scope of the route, a function that
formats a location into an address and a function that follows one; every link is a real link
to the formatted address, and a plain click or a choice in a field is handed to the host.

## Acceptance Criteria

- `HarnessNavbar` renders five primary controls, Pages first, each an icon above its
  label and centred over it; only the category of the route has `aria-current="page"`, its own
  colour and the line under it. Details and History of an entity keep that entity's category.
- Clicking Modules opens a compact navigation bubble containing Layouts, Components, Models,
  Services, Helpers and Types from every resolved route. Opening it keeps the current address
  and header height. The six categories have real scoped links and no persistent second row.
- Escape returns focus to Modules; clicking outside, choosing a category or changing routes
  closes the bubble. It stays within desktop, tablet and phone viewports, and highlights the
  current module category. Modified category clicks retain normal browser link behavior.
- No link to reports, analytics, activity, growth or a legacy view is in the bar, and the
  header draws no title row or "Other views" links when it is given a navbar.
- Every category link stays in the branch and commit that are viewed and drops the entity,
  section and tab. The brand opens Pages at the tip of the branch.
- The branch and the commit are the shared `Select`; no other select markup is written.
- On a current-branch route the commit field holds the tip, the labels read `Tip · <7 hex>` and
  `Current · branch tip`, and Go to tip is a disabled button.
- On a selected-commit route the labels read the tip of the branch and `Historical commit`
  (or `Selected commit · branch tip` when the selected commit is the tip), the closed commit
  field shows the short hash once, and Go to tip is a link to the same entity, section and tab
  on the current branch.
- Choosing a branch stays in current mode on the same entity; choosing a commit always gives
  the explicit commit address, also for the tip. A commit no branch reaches has no tip, says
  `Retained commit`, and is listed although no branch lists it.
- Browser back, forward and a reload each show the scope their address names.
- `HarnessVerdict` shows the green check only for `passed === true`; false, missing, unknown and
  every other value show the red cross. It has no third state, no amber and no percentage.
- A verdict draws its icon and no words, through every caller. Its status is the name of the
  mark, and the status with the reasons is a tooltip that opens on pointer hover, keyboard focus
  and tap, closes on leave, blur, Escape and a tap elsewhere, and stays wholly on the screen at
  either edge of a narrow table.
- `HarnessIcon` covers the five categories, the two verdicts, contract, size, performance,
  tests, history, relationships, revision and the controls, from one table of path data.
- `HarnessAction` is a link when it has an address, a button otherwise, and a disabled button
  when it is disabled; a plain click on the link is followed inside the application and a
  modified click is left to the browser.
- `HarnessTabs` without a list is the row of views the console had; with a list it is the tabs
  of an entity, each a link where it has an address.
- A row of tabs narrower than its tabs scrolls sideways and keeps the tab that is shown wholly
  inside it: when it opens, when another tab is shown from anywhere on the page, and when the
  screen changes its width. Only the strip moves; the page is not scrolled, nothing is focused,
  and the keyboard still walks the strip tab by tab.
- `HarnessHeader`, `HarnessSelectors` and `HarnessTabs` keep the calls the console made at
  b4afb74 and render what they rendered for those calls.
- Every explorer rule is under an `hx-` class and the explorer palette is defined on
  `.hx-shell`; outside it the console that was keeps its colours.
- The bar spans the screen whatever frame the root also names, no rule of the earlier console
  reaches headings inside the explorer, and content a host puts under the bar without a column
  keeps the page gutters.
- An installed console is handed its address with the query, so a tab of a section survives a
  reload.
- The standalone host, `HarnessShell`, names the generic content itself and hands it to the
  console as its required `content`; the console has no screen of its own, so a page that
  mounts the console with its own screen depends on no generic renderer.
- At 1440, 920 and 390 pixels the page is never wider than the screen, every control of the bar
  is at least 44 pixels high and wholly on the screen, and at 1440 the bar is one row.
- At tablet widths from 600 to 1024 pixels, Branch and Commit share a row. Revision controls
  and search together use at most 120 pixels vertically, retaining 44-pixel controls, visible
  labels and revision status, keyboard navigation and search results without overlap.
- The keyboard reaches the brand, the five categories, the branch and the commit in that order,
  shows where it is, and Enter on a category follows it.

## Proof

- Unit: `test/components/harness-navbar.test.ts`, `harness-shell-legacy.test.ts`,
  `harness-icon.test.ts`, `harness-verdict.test.ts`, `harness-action.test.ts`,
  `harness-shell-address.test.ts`, `test/utils/harness-shell.test.ts`, `harness-icons.test.ts`,
  `tooltip-place.test.ts` (43 tests).
- Browser: `tests/e2e/explorer-shell.spec.ts`, `explorer-shell-pieces.spec.ts` and
  `explorer-shell-verdict.spec.ts` over a synthetic fixture the specs build themselves (24 tests
  at three widths), run alone with
  `bun x playwright test --config src/config/shellPlaywrightConfig.ts` and once in `test:e2e`.
- Scenario: `specification/scenarios/explorer-shell.json` declares seven states at three
  widths. Under verification the fixture is the declared build `shell-fixture`, compiled in
  setup and served unchanged, and each capture carries its build and revision.
- Red on a pristine export of b4afb74 and green on the change with the same test files, by
  hash: `work/explorer-shell/redgreen.sh`, logs and captures under `work/explorer-shell/`.
- Root: `test/format-ignore.test.ts` holds that what the checks of the reports package generate
  under `packages/reports/output` is left unformatted, and that no source path is.

## Future Enhancements

- A custom list for the commit field that shows the subject and the verdict of each commit as
  rows, when a native select can be styled that far in every supported browser.

## Tablet Compaction Verification

- Codex implemented two scoped CSS changes after the bounded Opus attempt returned no edits in seven minutes. Existing Select, Search and Action components remain unchanged.
- The standardized search-fit test now covers 685, 834 and 1024 pixels alongside its other widths and guards compactness, touch targets, focus, popup fit and navigation.
- Failing test commit: `1952fe5126db1dddfdff10c763da302ae93d7a75`. Fix commit: `2c42b8736231c7b142cafed2290f13da4b9c13fd`.
- Sealed red `7bef4f6578a757bea47b5fd0edb60f1024dc9cc7f363bbb1a8fcd02a57e89ef3` and green `8c31aed076fda6a0d3e2e37bcaf0eed98454f07cdf9924341b68e3a76c33b0cb` share 1,257 frozen inputs, command and environment.
- All 569 web unit tests and 58 shell browser cases pass, with web formatting, types, lint and builds. Registry validation and change explanations pass.
- Reports audit retains the existing file-length failures in `entity-preview-marks.spec.ts`, `Harness.types.ts` and `EntityTests.svelte`; full verification remains pending. Native Electron testing and its aggregate checks remain paused.
- Manual browser checks cover historical selection, Go to tip and search at tablet width. The 685-pixel toolbar uses 120 pixels vertically, down from 256; captures remain under `/tmp`.
