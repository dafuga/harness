# Harness Project Discipline

Use this skill whenever you are planning, implementing, reviewing, or verifying code in this Harness CLI project.

## Operating Rules

1. Treat `harness info`, Harness generators, and `harness audit` as mandatory project controls.
2. Run `bun run dev -- info <topic>` or `bun run dev -- info scaffolds --json` before creating unfamiliar code shapes.
3. For non-trivial work, ask what the loop should prove, search templates, then create or continue a `harness loop`.
4. Prefer adding or updating generators over manually duplicating scaffold behavior.
5. Add or update unit and temp-workspace E2E tests for generator, audit, and CLI behavior changes.
6. Keep generated and hand-edited files inside the configured Harness rule limits.
7. Verify with `bun run check` before handing work back.
8. Git answer caches: establish the object format first; hex shape is not immutability. Test refs named like the other width and unknown formats.
9. Config changes: name owned helpers from the owning config file; run root and every inheriting workspace's test entrypoint before a full check.
10. Shared browser fixtures must preserve lazy setup: when their dependencies change, run an API-only case with an unavailable browser executable alongside actual browser cases. Characterize diagnostics before page announcement and overlapping context/page delivery without duplicates.
11. Helpers are pure synchronous value transformations with explicit reviewed `@pure` contracts and no I/O, mutation, hidden state, clocks or randomness. Service classes and models have separate catalog categories. A shared helper needs at least two distinct component, service or named-function consumers. Keep a single-consumer helper in its owner's folder. Preserve unit identity/history and update imports, tests and owned source when moving it; split mixed shared/private modules. Check public API and runtime references before changing an unused export. When moving definitions behind forwarding exports, extend the owning standardized test to cold-import and call both public and owner entries in fresh runtimes; a warm test-module graph does not prove initialization safety. For moved import.meta.url code, test source and packaged layouts separately; bundled output-relative addresses must keep their artifact paths. Before a broad suite for moves reachable from public SDK exports, run `bun scripts/build-api.ts --types-only`; retain the published import and type-entry addresses.

## Helper Naming Review

Before adding, cataloging or accepting a helper, read its implementation, state the
input-to-output operation and check one concrete call and result. Assess whether
the name and signature communicate that operation to a reader without extra explanation.
Purity and multiple consumers establish eligibility; they do not establish naming clarity.

For example, seconds becoming display text is `formatDuration(90) // => "1:30"`.
A name such as `audioDuration` suggests inspecting or measuring audio, which this
formatter does not do. Rename an unclear helper and update callers, contracts and
examples before accepting it. Do not change its purity or hide a valid shared helper
to compensate for a poor name. Use semantic judgment, not a universal verb-prefix rule.
A clearly named formatter with one consumer stays with its owner; reading a file
remains effectful even when the function has a clear name.

## Catalog Threshold Review

When a reuse threshold controls catalog inclusion, derive that decision and the
visible usage links from the same resolved, distinct consumer set. Cover zero,
one and multiple eligible consumers in the standardized catalog tests, including
duplicate references and excluded or missing consumers. A passing display test
must not accept a row that contradicts the collection's inclusion rule.

## Bug and Regression Loops

- Commit the strengthened failing test before product repair. Run `harness loop record <loop> --phase red --test <path> --command <command> --assertion <actual failure>` on that commit. Make a separate fix commit and run `loop record --phase green` against the same tests, fixtures, command and environment. Keep both commits when landing; never squash away this regression history. Focused red/green proof does not replace full verification.

- For a reported bug, first diagnose why existing tests missed it. Name the responsible standardized test or scenario and its missing inputs, lifecycle, fixture or assertion; record the coverage gap before product repair.
- Strengthen the existing standardized test and shared fixtures or assertions using the project's Harness scenario, state, viewport, registered-test and evidence format. Do not add a one-off bug-specific regression test.
- If no existing test covers the behavior, explain the missing coverage category and extend reusable standardized coverage before product repair.
- Run the strengthened test against the broken implementation and record the failing command, assertion and observed result before repair. A fixture or environment error is not defect proof; never manufacture a failure.
- Repair the product while keeping the strengthened test unchanged. Repeat repair and the same unchanged test until it passes; retain failing and passing evidence at their tested revisions, then run normal verification.
- During read-only planning, report the coverage diagnosis and propose the standardized test change; do not edit tests or product source. Write only within an approved implementation request.
- Use `harness loop create <name> --from bug-fix --goal <text>` for bug repairs: reproduce with a failing test before implementation, then repeat repair and the same unchanged test until it passes.
- Use `--from regression-prevention` for regressions requiring durable prevention: identify the root cause, propose the repair and guard, implement both, and include the guard in normal project verification.
- Prove the guard rejects reintroducing the original failure in an isolated fixture or temporary workspace; restore the repair and prove the guard passes.
- Record failing and passing commands, assertions, and results as step evidence. Keep green/guard/verification steps pending while proof fails; the agent retries repairs and checks. Harness does not launch an AI repair runner or automatically complete steps.
- For affected UI paths, exercise the browser flow and capture fresh screenshots, then inspect the images before recording proof. Report blockers without claiming completion.

## API and Naming Corrections

- Function and parameter names describe their domain role or transformation. Avoid vague names such as `value` when the domain is known; generic abstractions may use genuinely generic names. Rename actual declarations, callers and contracts, not just UI labels.
- When Daniel requests a naming or API correction, trace why the earlier implementation passed the generator, skill or review checkpoint. Repair the earliest responsible control within Harness, including generated tenant guidance where applicable, and verify the emitted instructions. Record cause and prevention alongside the regression proof.
- A helper detail page selects one callable. Standard catalog-to-detail coverage must prove distinct links for helpers in the same module, isolated parameters/return/throws, and identity retained across tabs and historical revisions. Missing helpers stay explicit; preserve owning module identity and label module-level history and evidence honestly.

## Concise Writing

- Behaviour note of a reason: 30 words and 200 characters. Each attempt: 15 words and 140 characters.
- That is `"writing": 2` in `harness.verify.json`; a revision that declares 1 keeps 20 words an attempt. The revision a reason explains decides, not its date.
- Commit subject: 72 characters, starting with `feat:`, `fix:`, `chore:` or `cleanup:`. Optional body with trailers: 60 words and 400 characters.
- `harness explain add` and the commit-msg hook refuse more; verification checks both again.
- Hooks are shared by every worktree; a stage acts only where that stage was opted into. A change to the wrappers passes `test/hooks-shared-stages.e2e.test.ts` first.
- Say what changed here and what was tried. Never shorten tests, contracts or evidence to fit.

- Browser normal flows, including screenshot/video runs, must have no unexpected console.error or pageerror events. Use the shared browserTest fixture and watch extra contexts before navigation. Preserve logs for expected errors and declare their exact messages and reasons in that test. For unexpected errors, prove a failing log assertion before repair, then rerun the same unchanged regression until the error disappears.

## Screenshot Evidence

- A changed UI is not ready to hand off or merge while any required screenshot is missing. Capture each applicable page, tab/state and desktop, tablet and mobile viewport through its standard test, from the exact committed build. Fix capture failures and rerun; a green assertion alone is insufficient.
- Register and retain the original image bytes, hashes, unit, state, viewport, served build and revision in Harness evidence before temporary workspace cleanup. A scratch path, broken image URL or image in chat is not durable screenshot delivery.
- Resolve a scenario screenshot slot to its declared units. A slot name is not a page identity; never fill a missing preview with another page's image.
- Rebuild or reopen the delivered history from its Git evidence, decode every required image, and inspect fresh screenshots before reporting completion. Both comparison sides need their own images; never substitute another unit, state or revision.
- After a squash landing, verify the actual remote base commit's prepared history and visible previews. Feature-commit screenshots alone do not prove merged delivery. Reuse focused pixels only for an identical complete Git source tree, retain their original commit and focused status, and require fresh captures for any different tree. Include sibling squash commits and changed-tree rejection in the standard Git-backed history tests.
- Complete and format tracked loop metadata before the final capture run. Keep the captured tree unchanged through landing; further tracked changes require fresh captures.
- Keep focused screenshots available even when full verification fails, with their focused run and outcome clearly labelled. They grant no full verification verdict. Missing or corrupt bytes keep the visual check open; report the exact blocker and continue the repair.

## Measurement Evidence

- Every code change must collect source bytes, source lines, complexity and dependency counts for each added or directly changed unit from the exact committed tree. Measure each applicable emitted target from that snapshot's real build output. A failed or missing full verification record must not hide readable source measurements.
- Every changed executable unit must also have a representative measured workload in its normal behavior tests, even without a performance budget. Record fresh timing and a meaningful memory observation with the unit or callable, workload, method, samples, target, runtime profile and tested revision. Focused regression evidence and full verification both retain these observations.
- For pages, collect real route navigation timing and page JavaScript heap after fonts and images settle. Bind the capture to the server's verified build and revision. A client-side route change must not borrow the previous document's navigation timing. Name whole-page heap or whole-process RSS accurately, including shared code or runner overhead; never describe it as isolated unit memory.
- Page screenshot scenarios require navigation timing and scoped renderer memory at every required viewport. Collect both through the shared capture helper and retain them with the images.
- Do not complete a changed executable unit with applicable metrics left unmeasured. Extend its standard workload coverage and rerun it. If source, runtime, toolchain or safe memory attribution is unavailable, record the exact reason, keep that check open, and report the blocker; absence is never zero or a passing measurement.
- Refresh prepared history when measurement support changes and verify the delivered data as well as the renderer. Every entity kind must show figures from its selected commit; old missing placeholders must not override current source observations. A portable index without its Git source must be rebuilt from that source rather than borrowing the working tree.
- Show actual performance observations independently of budget declarations. Preserve workload, target and profile boundaries. A changed unit requires a fresh run; inherited observations of an unchanged unit keep their original revision and label. A focused benchmark does not grant full verification or approve a budget baseline.

## Hard Limits

- Files: 220 lines.
- Functions: 55 lines.
- Classes: 120 lines.
- Methods: 35 lines.
- Nesting: 4 levels.
- Parameters: 4.
- Classes per file: 1.

## Callable usage examples

Every public helper needs committed examples with a real invocation, argument values and expected output or error. Execute authored examples against the actual implementation. `harness units check` rejects missing examples; indexing must preserve them and the detail page must select only the current callable and revision.

Use descriptive behavior titles, never numbered placeholders. Choose one representative example per distinct behavior; combine redundant inputs. Review implementation features and meaningful error or empty states. Equal outputs alone do not establish duplication. Keep exhaustive boundary cases in tests. Registry checks reject placeholder titles and repeated titles or calls; semantic overlap requires agent review.

## Route identity and UI state

When changing URL structure or moving tabs between query strings and paths, key the rendered page by its logical entity, helper, branch, revision and section; tab or canonical-alias changes must preserve the frame. Extend the existing host browser matrix to assert DOM continuity across tabs, refresh and correctly scoped links. Capture after canonical navigation, fonts and layout settle, and inspect the original images; a passing text assertion alone does not establish a ready screenshot.

## Shared Catalog Interaction Review

When reusing a catalog item in relationships or another context, review the rendered
variants and their supplied data, not only the component import. The existing
standardized catalog and relationship matrix must exercise the same consumer
footer, clickable references, hover/focus preview and branch/revision navigation.
Include empty usage and missing screenshots. A class-name or entity-name assertion
alone does not prove interaction parity. Keep screenshot evidence at the failing
and passing checkpoints; do not substitute another entity or revision's image.

Consumer views must group references by declared module type in both relationship
sections and shared card footers. Screenshot UI belongs to visual pages, shells
and components; helpers, services, models and configs use compact code previews.
A missing screenshot does not make a visual component nonvisual. Extend the normal
mixed-consumer browser matrix to prove both visual and nonvisual preview variants.

When changing a previously relocated helper's behavior, review its ownership
migration follow-up as well as its callers and contract. Keep the original move
and identity intact; record the intentional new definition and source commit in
the existing follow-up ledger, then run the standardized unit-index guard.

## Native Unload Verification

Whenever a change adds, removes or alters unload prevention (`beforeNavigate` cancel, `beforeunload`), verify it in the native host: close, reload and quit each offer Stay or Discard; Stay keeps the document and a working backend; shutdown starts only after every window accepted closing. Browser-only or automation-intercepted dialogs do not prove this.

## Authoring Failure Coverage

When a form protects unsaved work, type in each affected control without blurring it, including partial numbers and comma-separated lists. Verify dirty state immediately, cancel keyboard reload or native close, retain the focused draft, and save the exact parsed values. A blur-before-save case alone is insufficient.

When a project-creation flow owns a new directory, test failure after files were written or Git initialization began, then retry the same name. Remove only that attempt's partial target; preserve existing paths and a completed project if only opening it fails.

## Concurrent Main Integration

Pin head, main and their merge base before reviewing removals. A behind-main diff is not proof that the branch deleted a feature. When integrating new main work, preserve its source behavior and original assertions alongside branch changes. Review conflicted tests against the merged source; never select an older implementation together with weaker expectations to obtain green checks.

When reconciling changed assertions, map each expected state to its selected fixture revision and manifest status. Run every reconciled standardized test before broad verification; active, retired and never-present entities have different history behavior.

Before a broad run after importing main changes, run the existing standard tests owned by each imported source change, including unchanged test files. Check their expectations against the imported contract before retaining or revising them.

When integrating project-specific navigation into a changed shared header, exercise each project variant at the declared viewports. The standard acceptance test must assert separation from reserved search/settings controls and activate the added entry and a retained control; visibility alone does not prove usable navigation.
