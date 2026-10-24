---
name: harness
description: Use this repository's Harness generators, audits, loops and revision-bound evidence when changing its code or verification.
---

# Harness Project Discipline

Use this skill whenever you are planning, implementing, reviewing, or verifying code in this Harness CLI project.

## Operating Rules

Harness application's own UI uses the documented shared design tokens across Reports, Desktop/iOS and Hub. Add missing design categories or named tokens to Styles before using them; run the standardized app-style-tokens admission checks. This application-specific palette must not be imposed on generated tenant projects. Preserve data-derived geometry, structural CSS and external asset branding.

Choose component colors from Styles → Colors, defined in `appStyleTokensConfig`. Follow each role's usage guidance and the shared control's actual variant; decorative accents do not define action semantics. Keep that guide and the standard Styles assertions aligned when adding a semantic use. Keep one base primary color; document fill, border and contrasting-text treatments beneath it in the same Colors inventory.

1. Treat `harness info`, Harness generators, and `harness audit` as mandatory project controls.
2. Run `bun run dev -- info <topic>` or `bun run dev -- info scaffolds --json` before creating unfamiliar code shapes.
3. For non-trivial work, ask what the loop should prove, search templates, then create or continue a `harness loop`.
4. Prefer adding or updating generators over manually duplicating scaffold behavior.
5. Add or update unit and temp-workspace E2E tests for generator, audit, and CLI behavior changes.
6. Keep generated and hand-edited files inside the configured Harness rule limits.
7. Verify with `bun run check` before handing work back.
8. Git answer caches: establish the object format first; hex shape is not immutability. Test refs named like the other width and unknown formats.
9. Config changes: name owned helpers from the owning config file; update generator output and public SDK export plans together, then run the standard every-scaffold export-to-emission guard. Run root and every inheriting workspace's test entrypoint before a full check.
10. Shared browser fixtures must preserve lazy setup: when their dependencies change, run an API-only case with an unavailable browser executable alongside actual browser cases. Characterize diagnostics before page announcement and overlapping context/page delivery without duplicates.
11. Helpers are pure synchronous value transformations with explicit reviewed `@pure` contracts and no I/O, mutation, hidden state, clocks or randomness. Service classes and models have separate catalog categories. A shared helper needs at least two distinct component, service or named-function consumers. Keep a single-consumer helper in its owner's folder. Preserve unit identity/history and update imports, tests and owned source when moving it; split mixed shared/private modules. Check public API and runtime references before changing an unused export. When moving definitions behind forwarding exports, extend the owning standardized test to cold-import and call both public and owner entries in fresh runtimes; a warm test-module graph does not prove initialization safety. For moved import.meta.url code, test source and packaged layouts separately; bundled output-relative addresses must keep their artifact paths. Before a broad suite for moves reachable from public SDK exports, run `bun scripts/build-api.ts --types-only`; retain the published import and type-entry addresses.

## Shared preview lifecycle

- Keep one persistent Harness browsing preview across chats and worktrees. The shared endpoint is currently `http://127.0.0.1:5690`, with ownership status at `http://127.0.0.1:47840/__harness_preview__`. Verify the live owner and served source/history; Platforms currently owns updates.
- Reuse that preview. When a different revision or data set is needed, coordinate its update with the owner; do not describe an older served build as proof of unmerged work.
- Do not evade the singleton through `HARNESS_PREVIEW_OWNER_PORT`, another free port, direct Vite or `build/index.js` launches, or `report serve`. An additional persistent preview requires Daniel's explicit request.
- Isolated automated test servers are allowed only for their fixture lifetime. Use existing test configuration, retain task-owned process handles, and tear down in `finally` on success, failure, timeout and cancellation. Do not leave a fixture detached for browsing or stop another task's server.
- Preserve the shared preview and all source/history/evidence. After authorized cleanup, re-inventory listeners and check ownership, HTTP readiness and the browser; a stopped worker may otherwise respawn under its supervisor.

## Service Ownership

Before changing a recorded implementation, search every ownership ledger by its stable unit/class identity and historical, owner and forwarding paths. Catalog privacy does not remove migration ownership. Preserve original move definitions and prior reviews; use the ledger's existing review mechanism and committed-source pack, then run the unchanged unit-index guard before broader qualification.

A shared service needs at least two distinct active runtime owner units. Single-consumer implementations and their private helpers live inside the owner code area. Count runtime references to exported operations or classes; exclude types, unused imports, repeated references by one owner, forwarding modules and indirect page reachability. Keep public entry and route contracts stable, preserve registered identity and source history, and review dynamic/runtime use before relocating an export with no statically proven owner.

Before committing a cross-workspace relocation, run every affected workspace structure audit as well as the root audit. Use supported owner areas such as `src/lib/<owner>` when the original owner folder enforces another scaffold shape, and retain framework or store entry filenames as named forwards.

When relocating source, rewrite module specifiers and source-layout URLs only. Ordinary string literals, including traversal checks, stay identical. Compare declaration ASTs before and after; template contents and operators are part of that proof.

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

For helpers recorded by `specification/loops/local-helper-ownership/migration.json`, preserve the original move definition and update the existing intentional `followUps` record with the implementation commit, reason and current definition. Run the root `test/services/unit-index.test.ts` guard alongside the owning workspace's tests before landing; workspace-only checks do not cover this repository-wide ownership record.

When a reuse threshold controls catalog inclusion, derive that decision and the
visible usage links from the same resolved, distinct consumer set. Keep every resolved module
category eligible for usage links, exclude the callable itself, and cover all supported kinds
in the normal card matrix; a legacy category whitelist can silently lose valid consumers. Cover zero,
one and multiple eligible consumers in the standardized catalog tests, including
duplicate references and excluded or missing consumers. A passing display test
must not accept a row that contradicts the collection's inclusion rule. Resolve consumer owners
from the selected revision's full active registry, independently of public catalog filtering.
Distinct named procedural callers use owner-plus-symbol identity, including siblings in the
helper's own unit; duplicate references and the helper itself do not count twice. Components and
classes remain distinct owner units. Private callers never become public Helpers merely because
they consume a shared helper. Select a recorded callable when available; otherwise open its real
owner source, preserving template/audit roles without inventing a helper API or entity route.
When a reference carries a callable identity separately from its owner, the normal mixed-consumer
matrix must assert that its link text, hover or focus preview, and opened destination identify the
same callable. Exercise distinct owner and callable names at current and historical revisions.

## Bug and Regression Loops

- Commit the strengthened failing test before product repair. Run `harness loop record <loop> --phase red --test <path> --command <command> --assertion <actual failure>` on that commit. Make a separate fix commit and run `loop record --phase green` against the same tests, fixtures, command and environment. Keep both commits when landing; never squash away this regression history. Focused red/green proof does not replace full verification.

- Freeze scenario slot/state declarations and shared browser marker assertions in the test-only checkpoint alongside the strengthened test. The complete test corpus is frozen, including tests outside the declared command. A repair commit changes product source only; partition scenario or fixture corrections before recording the matched pair.

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

- Before extending an alias resolver, strengthen its standard lookup matrix with canonical-name collisions, plural forms and normalization. Canonical names keep precedence over new aliases.
- Function and parameter names describe their domain role or transformation. Avoid vague names such as `value` when the domain is known; generic abstractions may use genuinely generic names. Rename actual declarations, callers and contracts, not just UI labels.
- When Daniel requests a naming or API correction, trace why the earlier implementation passed the generator, skill or review checkpoint. Repair the earliest responsible control within Harness, including generated tenant guidance where applicable, and verify the emitted instructions. Record cause and prevention alongside the regression proof.
- A selected helper’s Uses must come from runtime references attributed to that exact caller, never its owning module’s import graph. Hide Uses when that callable has no recorded helper callees; cover independent siblings, same-module callees, imported callees and old empty Uses links in the shared callable matrix.
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

Use source-and-run-specific output directories for verification attempts. Before reporting progress or a pass, check the tested commit, served build/revision and capture timestamps; reject logs and images left by an earlier attempt. A reused filename or successful file read does not establish fresh proof.

- For a new or changed table layout, extend its existing viewport matrix beyond text presence
  and document fit: preserve readable identifiers/types and short labels, contain horizontal
  scrolling, and exercise full-example keyboard access. Capture both panes before assertions;
  a compressed unreadable table can fit the page and still fail acceptance.
- A changed UI is not ready to hand off or merge while any required screenshot is missing. Capture each applicable page, tab/state and desktop, tablet and mobile viewport through its standard test, from the exact committed build. Fix capture failures and rerun; a green assertion alone is insufficient.
- Register and retain the original image bytes, hashes, unit, state, viewport, served build and revision in Harness evidence before temporary workspace cleanup. A scratch path, broken image URL or image in chat is not durable screenshot delivery.
- Resolve a scenario screenshot slot to its declared units. A slot name is not a page identity; never fill a missing preview with another page's image.
- Rebuild or reopen the delivered history from its Git evidence, decode every required image, and inspect fresh screenshots before reporting completion. Both comparison sides need their own images; never substitute another unit, state or revision.
- After a squash landing, verify the actual remote base commit's prepared history and visible previews. Feature-commit screenshots alone do not prove merged delivery. Reuse focused pixels only for an identical complete Git source tree, retain their original commit and focused status, and require fresh captures for any different tree. Include sibling squash commits and changed-tree rejection in the standard Git-backed history tests.
- Apply the same complete-tree identity rule to focused runtime measurements. A source-identical squash may display the original observations with their tested revision intact; it must neither discard those figures nor promote focused evidence into a full verification verdict.
- Complete and format tracked loop metadata before the final capture run. Keep the captured tree unchanged through landing; further tracked changes require fresh captures.
- When scoping formatting checks to changed files, include loop and contract metadata after the final evidence update; source-only formatting misses generated metadata changes.
- For screenshot metadata crossing projections or transports, run the directly changed units' existing isolation and re-derivation tests alongside browser captures, even if full verification is deferred. Carry opaque source-tree identity and original provenance without forwarding prepared-history cache filenames. A browser-only result does not cover that boundary.
- For a screenshot-viewer change, include the entity being reviewed in the capture command even when its app source is unchanged. Reopen it at the delivered revision and verify every required device image and page workload figure. A current renderer over historical evidence is not proof of current-commit delivery.
- Keep focused screenshots available even when full verification fails, with their focused run and outcome clearly labelled. They grant no full verification verdict. Missing or corrupt bytes keep the visual check open; report the exact blocker and continue the repair.

## Measurement Evidence

- Every code change must collect source bytes, source lines, complexity and dependency counts for each added or directly changed unit from the exact committed tree. Measure each applicable emitted target from that snapshot's real build output. A failed or missing full verification record must not hide readable source measurements.
- Every changed executable unit must also have a representative measured workload in its normal behavior tests, even without a performance budget. Record fresh timing and a meaningful memory observation with the unit or callable, workload, method, samples, target, runtime profile and tested revision. Focused regression evidence and full verification both retain these observations.
- After source ownership changes, compare workload unit IDs with the current indexed owners. Preserve historical IDs at their original revisions; current captures must use the new ownership.
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

## Module Naming

Models are persisted data wrappers with source-declared storage schemas. Existing shared type modules belong under Types. Preserve their registered IDs and source paths; omit the .types suffix on cards, links and headings.

Read `harness info naming` and the scaffold guide before naming a module. Classes keep PascalCase and their role suffix; models and components keep PascalCase; functions, pure helpers and value modules keep their actual camelCase name. Match source filenames and primary declarations, preserve framework entries and stable registered IDs, and keep descriptive responsibilities separate from code names. Use the same canonical code identity on cards, usage links and detail headings. Standard catalog coverage compares those surfaces for class, callable, component and model consumers at current and historical revisions; card-only naming overrides are not allowed.

Before freezing a naming regression, format and lint the strengthened tests and shared fixtures. Record the failing assertion only after that preflight so green can use the unchanged test inputs.

Keep registered test titles stable when extending naming coverage; verification records bind to those names.

Shared Services lists require source-proven concrete instantiated classes with multiple public instance methods (including inherited methods) and two distinct active runtime owner units for that class. Exclude functions, objects, static namespaces and source-unproven historical entries. Preserve actual PascalCase class identifiers; never capitalize a function label to imply a class. Review responsibilities and real method usage separately: structural eligibility cannot prove absence of semantic redundancy.

## Responsibility Categories

Group related list, detail and history pages by feature in meaningful domain
folders. Reuse that feature category with `--group`; use route groups when public
URLs must stay unchanged. Avoid broad technical catch-alls when a feature is known.

Config modules use the plural `src/configs/<category>/` folder, one focused source file per config. Generate new configs there and preserve stable IDs when relocating existing files. The Configs explorer shows one table per source file; responsibility grouping must not combine unrelated configs. Decode only static source literals for presentation, preserve raw expressions for inspection, and never execute configuration or read host secrets to populate the catalog. Variable labels omit only the matching table title plus its dot; preserve nested paths and unrelated export names. Search, inspection and source links retain canonical identities. Extend the standard mixed-config browser fixture whenever grouping or value presentation changes.

For typed-value presentation changes, review the fixture's decoded metadata as well as its source text. Cover short, long and multiline string literals independently from computed expressions and collections; do not omit literal metadata to force an inspection path. The standard parser matrix must prove that these string forms decode without executing code, and the browser matrix must check initial inline text, overflow and inspection behavior at every declared viewport.

Regex and computed-expression source text also stays inline, constrained to one ellipsized line with its full committed source available on hover. Keep collection inspection separate. The standard mixed-config matrix covers short expressions, long regexes and multiline expressions at current and historical revisions without evaluating them.

Place every module type in `src/<kind>/<category>/` using the project taxonomy in
`harness.groups.json`. Use `harness generate <kind> <name> --group <category>` for
new code; a new explicit group extends the taxonomy. Reuse an existing category
when its responsibility fits. Unambiguous names or declared responsibilities can
select it automatically; ambiguity requires a deliberate category choice. Keep
private helpers and single-owner services inside their owner category. Preserve
registered IDs, framework entries and public URLs. The explorer reads category
folders and titles from the selected source revision for every collection.

## Helper implementation ownership

- Public shared helper implementations belong under src/helpers/<responsibility>/<camelName>.ts, with pure functions separated from component/service orchestration. Keep single-consumer helpers with their owner. Point helper source contracts and Source tabs only at the selected callable implementation, never all files of its owning module. Preserve supported import addresses with forwarding exports when needed; update active callers to the canonical helper source. Run the registry helper-source guard and the standard selected-helper Source browser test.

## Callable usage examples

Every public helper needs committed examples with a real invocation, argument values and expected output or error. Execute authored examples against the actual implementation. `harness units check` rejects missing examples; indexing must preserve them and the detail page must select only the current callable and revision.

Use descriptive behavior titles, never numbered placeholders. Choose one representative example per distinct behavior; combine redundant inputs. Review implementation features and meaningful error or empty states. Equal outputs alone do not establish duplication. Keep exhaustive boundary cases in tests. Registry checks reject placeholder titles and repeated titles or calls; semantic overlap requires agent review.

## Route identity and UI state

When changing explorer routes or tab canonicalization, run `test/utils/explorer-route.test.ts`, `test/utils/explorer-legacy.test.ts` and `test/utils/console-canonical.test.ts` together, alongside the affected public-entry tests. Check page-specific aliases and retained contracts for other module types against the selected revision; keep both assertions.

When changing URL structure or moving tabs between query strings and paths, key the rendered page by its logical entity, helper, branch, revision and section; tab or canonical-alias changes must preserve the frame. Extend the existing host browser matrix to assert DOM continuity across tabs, refresh and correctly scoped links. Capture after canonical navigation, fonts and layout settle, and inspect the original images; a passing text assertion alone does not establish a ready screenshot.

## Shared Catalog Interaction Review

When reusing a catalog item in relationships or another context, review the rendered
variants and their supplied data, not only the component import. The existing
standardized catalog and relationship matrix must exercise the same consumer
footer, clickable references, hover/focus preview and branch/revision navigation.
Include empty usage and missing screenshots. Inventory every relationship input, including
private callables and unclassified support dependencies; checking only existing article
elements cannot detect modules that bypass the card renderer. Keep at least one fourth
eligible consumer through the data projection and assert both three visible links and
the overflow indicator. A class-name or entity-name assertion
alone does not prove interaction parity. Keep screenshot evidence at the failing
and passing checkpoints; do not substitute another entity or revision's image.

Relationship sections group references by declared module type. Every catalog and
relationship module card uses `ExplorerModuleCard`, including visual and nonvisual
variants; legacy card entries only forward to it. Its sole metadata field is Used In:
the first three distinct consumer links in provided order, then an ellipsis when more
exist. Never add consumer category labels or a second card implementation. Screenshot UI belongs to visual pages, layouts
and components; helpers, services, models and configs use compact code previews.
A missing screenshot does not make a visual component nonvisual. Extend the normal
mixed-consumer browser matrix to prove both visual and nonvisual preview variants.

Ownership review follows ledger membership rather than the file's module kind. Bridge factories
and initializers recorded in `shared-service-ownership` are included; their owning workspace checks
must include `test/services/unit-index.test.ts` even when full CLI/native suites are deferred.

When changing a previously relocated helper or service workflow's behavior, review its ownership
migration follow-up as well as its callers and contract. Keep the original move
and identity intact; record the intentional new definition and source commit in
the existing follow-up ledger, retain earlier reviews, and regenerate its committed
review-object pack when present. Then run the standardized unit-index guard,
including the recorded service-move case for workflow changes.

## Native Unload Verification

Whenever a change adds, removes or alters unload prevention (`beforeNavigate` cancel, `beforeunload`), verify it in the native host: close, reload and quit each offer Stay or Discard; Stay keeps the document and a working backend; shutdown starts only after every window accepted closing. Browser-only or automation-intercepted dialogs do not prove this.

## Authoring Failure Coverage

When a form protects unsaved work, type in each affected control without blurring it, including partial numbers and comma-separated lists. Verify dirty state immediately, cancel keyboard reload or native close, retain the focused draft, and save the exact parsed values. A blur-before-save case alone is insufficient.

When a project-creation flow owns a new directory, test failure after files were written or Git initialization began, then retry the same name. Remove only that attempt's partial target; preserve existing paths and a completed project if only opening it fails.

## Concurrent Main Integration

Pin head, main and their merge base before reviewing removals. A behind-main diff is not proof that the branch deleted a feature. When integrating new main work, preserve its source behavior and original assertions alongside branch changes. Review conflicted tests against the merged source; never select an older implementation together with weaker expectations to obtain green checks.

When reconciling changed assertions, map each expected state to its selected fixture revision and manifest status. Run every reconciled standardized test before broad verification; active, retired and never-present entities have different history behavior.

When catalog categories or controls change, include `test/console-host-routes.e2e.test.ts` and `packages/reports/tests/e2e/harness-explorer-catalog.spec.ts` in the affected browser checks. Preserve legacy routes while proving the current labels and canonical paths in a packaged consumer.

Before a broad run after importing main changes, run the existing standard tests owned by each imported source change, including unchanged test files. Check their expectations against the imported contract before retaining or revising them.

When integrating project-specific navigation into a changed shared header, exercise each project variant at the declared viewports. The standard acceptance test must assert separation from reserved search/settings controls and activate the added entry and a retained control; visibility alone does not prove usable navigation.

## CI Configuration Review

Before pushing a CI configuration change or starting broad verification, find and run
the existing workflow policy tests, including assertions on changed limits. Keep
execution commands, permissions and environment boundaries covered when revising
those expectations; formatting alone does not verify a workflow change.

## Acceptance Fixture Review

Temporary Git repositories initialize a generic repo-local author identity before any nested commit. Exercise the existing capture fixture with empty local author fields so personal or CI defaults cannot hide missing setup. A fixture-only repair uses diagnostic before/after captures; never change product code or relax the frozen-corpus guard merely to manufacture a product red-green pair.

After editing acceptance fixtures, run their owning workspace typecheck, formatting
and audit before a broad check, even when only imports or casts changed. Test files
share the workspace size limits; a passing runtime case does not prove that audit.

When changing collection table sizing, run both the standard word-geometry and typed Configs groups matrices. Preserve the original fitting-content boundary and a genuinely wider input: both must keep words inside their cells and the document inside the viewport; only content wider than its frame requires internal scrolling. Size-contained value wrappers must retain usable inline strings, ellipsis and keyboard inspection.

Review fixture actions as well as assertions: adding scroll, focus or navigation can
weaken the original acceptance state. A control required to fit at first paint must
still fit before scrolling. When catalog destinations grow, update the existing
navbar matrix and run its unchanged geometry and keyboard checks at every viewport;
do not treat a newly hidden destination as a stale fixture.

## Visual Evidence in This Project

- Classify what the module actually does. TypeScript support functions and lifecycle controllers are nonvisual even when they live beside UI; redirect-only routes have no settled screen of their own.
- A visual component or shell needs a representative fixture in the existing component preview catalog, its own required scenario state, and desktop, tablet and mobile captures. Keep `test/shared-workspace-registry.test.ts` and the catalog browser checks passing when adding a visual unit. New pages also need their own settled route coverage; a redirect destination is not a screenshot of a different page.
- Use the exact registered component ID suffix in `data-harness-component`. Attribute a route capture only to the UI it actually rendered. Imports and dependency ancestry cannot prove that a component was visible. Keep source-tag assertions tolerant of additional attributes while preserving their behavior and accessibility checks.
- Use `harness loop record --phase capture` for independent capture and historical backfill. Do not manufacture a failing test or a full verification verdict to retain evidence. An external historical fixture driver must be pinned and recorded; the product source and served revision must remain the selected historical revision.
- When measuring browser performance, keep native Performance APIs running. Freeze only calendar labels for deterministic screenshots; a full fake clock can erase navigation entries or replace the monotonic clock. Assert the measured document identity and positive real observations in the capture test.
- Retain original build, source, measurement method, workload, profile and outcome. Keep failures visible alongside valid partial captures. Measure size and complexity from tracked source, and runtime figures from actual executions; contextual route or fixture measurements must not claim isolated component cost or budget approval.
- Inspect decoded, hash-matching images from the retained record. Do not fill a missing device or revision with another image. State an unreproducible historical gap explicitly and keep required verification pending until it is resolved or reported as blocked.

## Cross-workspace visual integration checkpoint

When a fixture imports UI from another app, check that app with its own generated route types as well as the fixture host. A passing Reports typecheck cannot replace Hub's or Desktop's typecheck. If product source changes, run the owning workspace's normal check with `HARNESS_CLI_PATH` bound to this repository; a globally installed CLI is not proof of the current source. Preserve real app routing semantics rather than changing product calls solely for another app's generated types.

Attribution-only DOM containers require the full Reports component suite, alongside explicit negative normalization assertions for text, links, semantic attributes and ordinary containers. Normalize only the known metadata-only wrapper; preserve all behavioral and accessibility assertions.

A successful capture count does not prove catalog delivery. The standardized Pages screen test must project every registered visual unit's dedicated capture through its actual preview choice and require a displayed file. Keep unit preview metadata aligned with the captured catalog state, and verify the prepared main index's cards in the browser before landing/handoff. Preserve exact state selection and missing-state gaps for explicitly requested previews.

When adding or changing workspace build aliases, run the existing `test/shared-select-impact.test.ts` before broad verification. Keep all alias imports resolved, distinguish indexed test imports from runtime owner units using source classification, and prove test selection separately from production dependency reachability; never discard an unresolved runtime owner to satisfy the check.

## Type Files

Model contracts use the service method presentation for actual public methods, including static
persistence methods. Keep shared interface fields and callable members distinct from constants.
Do not synthesize initialization, CRUD or storage. The Table tab reads selected-revision schema
syntax only; unknown expressions stay unresolved and no live database rows are accessed.

Keep named interfaces and type aliases in a sibling `<module>.types.ts` file beside their implementation. Use `import type`; preserve public type imports through type-only re-exports. This applies to components, services, helpers, configs, tests and scripts. Keep runtime constants and classes separate from type declarations; shared type modules retain their established owner. Generators must emit the companion file, and `harness audit` rejects mixed declarations. New companions belong to their implementation unit; preserve already registered standalone type-module identities.
Component implementations belong directly in their responsibility category, with private code in an owner folder. Do not insert an application-name namespace beneath that category or retain a duplicate internal forwarding tree after relocation. Keep meaningful route prefixes, supported package exports, registered IDs and original migration records stable; record subsequent helper locations as reviewed follow-ups. Run the existing visual registry, import/alias impact, namespace-spy and ownership migration guards before broad verification.

For structural relocations, rewrite resolved import addresses without normalizing unrelated URL literals. Directory URLs retain their trailing slash. Review the complete URL diff and run the existing catalog-listing and preview-binding tests alongside the visual catalog before sealing final evidence.

When integrating main during a relocation, reconcile the latest landed definitions and adjust newly added imports and explicit reference origins for their new depth. Preserve every landed feature and assertion; verify the final source bodies against that main before freezing test inputs and final evidence.

Source tabs list implementation files, sibling type files and associated tests from the selected revision. Resolve tests from direct source imports or authored scenario coverage; retain their committed bytes and gaps, and reuse the shared file list and code viewer. Never substitute working-copy or newer test contents.

## Layout catalog review

Layouts are reusable visual frames with a real child-content slot, declared as kind `layout`.
Routing hosts, data loaders, and options-only route modules are not visual layouts. Review the
implementation rather than promoting everything previously called a shell. Keep stable unit IDs.
Layout cards reuse ExplorerModuleCard with title, screenshot and links to the pages that use them.
Capture the actual layout with a clearly labelled Child content placeholder passed through its
real children slot. Never substitute a full page screenshot for a layout preview.

Public category or route renames must inventory canonical and compatibility titles and links. Update exposed labels, preserve stable IDs and aliases, and extend the standard composition check across overview, details and history. Run affected downstream consumer tests alongside their typechecks. Run the affected package lint and audit as well. Include the affected public-entry navigation cases even when the full CLI suite is deferred. In this repository, select the affected cases in `test/console-host-routes.e2e.test.ts`; retain branch, commit, compatibility and access assertions.

Full-frame previews own their content boundaries. Apply content-container styling inside the
frame, never around its navigation. When changing fixture context, extend the existing standard
acceptance assertions for affected controls and inspect retained pixels before accepting the UI.

General string transformations belong in `src/helpers/strings/`, independent of their consumers. Keep domain-specific helpers such as device-key identity formatting in their domain. Derive each callable category from its own implementation source; use that category for catalog cards, filters and breadcrumbs. Preserve each revision's taxonomy and each helper's registered identity.

When changing a scaffold shape or name, update emitted source, generated tests and public export plans together. Run the standard all-scaffold export-coherence assertion and the existing focused CLI project-check scenario before accepting the generator change; source-only scaffold assertions are insufficient.

Pure helper SDK exports keep their callable names. When an existing SDK binding already uses that name, preserve it and qualify the helper export with a Helper suffix (then a numeric suffix if necessary); regenerating the helper must be idempotent. Keep the same-name util/helper CLI compilation scenario alongside export-to-emitted-file coherence coverage when changing helper scaffolds.

When changing a shared Game renderer, include the root `test/game-runtime.test.ts` consumer guard in owning qualification, even when full CLI/native suites are deferred. Verify semantic object visibility and retained references; inactive scene containers must not change what a visibility assertion means.
