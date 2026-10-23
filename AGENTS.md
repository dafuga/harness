# AGENTS.md

This is a Harness CLI project. Treat Harness as the operating contract for every code change in this repository.

## Required Harness Workflow

- Read this file and `.codex/skills/harness/SKILL.md` before changing code.
- Use Harness generators for supported code shapes instead of hand-rolling new structure.
- Ask `bun run dev -- info <topic>` before adding unfamiliar code or choosing a scaffold shape.
- For non-trivial work, ask what the loop should prove, search templates, then create or continue a `harness loop`.
- Add or update focused unit and E2E coverage for changes to audit rules, generators, or CLI behavior. When changing URL structure, tab aliases, defaults or canonicalization, run `test/utils/explorer-route.test.ts`, `test/utils/console-canonical.test.ts` and `test/utils/explorer-legacy.test.ts` together alongside the affected standard browser matrix, even when broad CLI/native suites are deferred.
- When relocating modules, run their existing namespace-spy tests against the declaration module imported by the subject; retain separate coverage of supported public forwarding entries.
- Before replacing iteration, collection construction or property access in code that takes in-memory JSON, characterize through its public entry what admission accepts before serialization: own iterators, species and getters included. A JSON round trip holds none of them, so its parity is not enough; keep those cases in the normal tests.
- When adding shared UI imports, declare their source reference bindings and run `test/shared-select-impact.test.ts`, `test/shared-search-impact.test.ts` and `test/shared-alias-index.test.ts` before handing off the component.
- When changing shared explorer frames or their imports, include `packages/reports/test/components/explorer-screens.test.ts` in the focused regression command. Keep data readers in data/store modules so frames do not import entity-specific panes.
- Keep files small, focused, and aligned with `harness.audit.json` limits.
- When changing a helper recorded by `local-helper-ownership`, keep its original migration definition and record the intentional update in `followUps` with the implementation commit and reason. Run `test/services/unit-index.test.ts` alongside the owning workspace's checks before landing.
- Ownership review follows ledger membership, including bridge factories and initializers in `shared-service-ownership`. When their behavior changes, preserve earlier reviews, record the new committed definition, regenerate the review object pack and run the same unit-index guard even when full CLI/native suites are deferred.
- When adding, editing or regenerating unit registry manifests or contracts, review the real responsibility and every field description against the implementation. Run `bun run dev -- units check` and the unchanged `bun x vitest run test/readable-unit-contracts.test.ts`, even when broad CLI/native suites are deferred. Keep the guard assertions intact.
- When widening shared catalog or search categories, run desktop typecheck and the existing workspace-search and workspace-route tests. Shared categories must not silently expand a consumer's supported routes.
- Run `bun run check` before handing work back; it includes formatting, type checks, lint, tests, build, and `harness audit`.
- An agent that works here says so: `bun run dev -- activity register --label <who> --task <what> --units <ids>`, then `activity heartbeat <id>` as it goes (or `HARNESS_AGENT_ID=<id>` on its Harness commands) and `activity finish <id>` at the end. `bun run dev -- info activity` has the rules.

## Harness Project Change Communication

These rules apply only to this Harness repository, including requests made in an external coding chat.

- Treat a request here as a Harness-managed change, using the same project and revision context, registered units, contracts, generators, regression flow, permissions, approval requirements and evidence standards as the app's chat. Existing explicit user authorization still applies.
- Before editing, link the affected registered entity pages or relevant sections and briefly explain the intended change and why each unit needs to be touched. Read its contract, Used In and Uses; distinguish direct edits from dependencies being checked.
- Keep those links in progress updates and questions. If another unit must change, explain that addition before editing it; a dependency graph alone does not authorize unrelated work.
- At handoff, link each changed unit and its History section, explain what changed and why, and identify its actual commits and verification results. Distinguish newly run proof, inherited evidence and unresolved checks.
- Resolve links from real registered ids at the selected branch or commit, preserving their registered kinds and the explorer's category mapping. For an artifact without an explorer page, explicitly identify that gap and link its source; never invent an entity link or call backend code a visual component.
- Keep execution attribution truthful: this chat does not automatically create an app conversation or run. Report an in-app thread, run or approval only when that record actually exists; continue registering external work through Harness activity.

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

## Concise Writing

- A reason says what changed in this unit in at most 30 words and 200 characters. Each simplification or performance attempt has at most 15 words and 140 characters. `harness explain add` refuses more.
- These are the limits of `"writing": 2` in `harness.verify.json`. A revision that declares `"writing": 1` keeps 20 words an attempt. A reason is held to the version of the revision it explains, never to one read from its date.
- A commit subject has at most 72 characters and starts with `feat:`, `fix:`, `chore:` or `cleanup:`. An optional body, trailers included, has at most 60 words and 400 characters.
- `harness hooks install` adds a commit-msg hook that refuses a longer message. Verification measures the stored messages again, so `--no-verify` does not pass.
- Git hooks are shared by every worktree of a repository. A stage acts only in a worktree that opted into that stage: `harness-hooks` means pre-push and nothing else, and a later stage has an opt-in file of its own.
- A change to the hook wrappers, or a stage added to them, passes `test/hooks-shared-stages.e2e.test.ts` first: an earlier opt-in, a new one and none, and no Harness started for a stage that was not asked for.
- Explain the specific change, the actual attempt and its result. Do not repeat an inventory of the repository.
- The limits bound notes and commit messages only. They never shorten tests, contracts, assertions, traces, transcripts or evidence.
- `bun run dev -- info hooks` and `bun run dev -- info explain` have the rules.

- Browser normal flows, including screenshot/video runs, must have no unexpected console.error or pageerror events. Use the shared browserTest fixture and watch extra contexts before navigation. Preserve logs for expected errors and declare their exact messages and reasons in that test. For unexpected errors, prove a failing log assertion before repair, then rerun the same unchanged regression until the error disappears.

## Screenshot Evidence

- A changed UI is not ready to hand off or merge while any required screenshot is missing. Capture each applicable page, tab/state and desktop, tablet and mobile viewport through its standard test, from the exact committed build. Fix capture failures and rerun; a green assertion alone is insufficient.
- Register and retain the original image bytes, hashes, unit, state, viewport, served build and revision in Harness evidence before temporary workspace cleanup. A scratch path, broken image URL or image in chat is not durable screenshot delivery.
- Resolve a scenario screenshot slot to its declared units. A slot name is not a page identity; never fill a missing preview with another page's image.
- Rebuild or reopen the delivered history from its Git evidence, decode every required image, and inspect fresh screenshots before reporting completion. Both comparison sides need their own images; never substitute another unit, state or revision.
- After squash landing, check the actual remote base commit's prepared history and decode its visible previews. Identical complete Git trees may retain focused captures with their original revision and status; a different tree requires new captures. A feature-branch screenshot alone is not merged delivery.
- When screenshot metadata crosses a projection or transport, run its existing isolation and re-derivation tests alongside browser captures, even when full verification is deferred. Carry opaque source-tree identity and original provenance, without prepared-history cache filenames.
- When changing the screenshot viewer, capture the entity being reviewed as well as the viewer. Reopen that entity at the delivered revision with every device image and page workload figure present; an older selected commit does not prove current delivery.
- Preserve focused runtime measurements across identical complete source trees, using the same identity rule as screenshots. Keep their original tested revision and focused status; source reuse does not grant a full verification verdict.
- Keep focused screenshots available even when full verification fails, with their focused run and outcome clearly labelled. They grant no full verification verdict. Missing or corrupt bytes keep the visual check open; report the exact blocker and continue the repair.

## Code Rules

- Scheduler changes must prove progress across mixed nesting depths, occupied ancestor budgets and pending siblings while preserving priority and headroom.
- Process-runner observer changes must prove fast exit, retained output and delayed synchronous observers in both Bun and Node before broad verification.
- Workspace verification and build entrypoints must join admission and preserve caller arguments; keep the existing workspace entrypoint inventory current. Standalone commands default to one CPU and 2 GiB; inherit supplied reservation limits.
- Application UI design values belong in the shared app token source documented by Styles. Reports, Desktop/iOS and Hub use one palette. New colors, typography, spacing, borders, shadows, opacity, motion and layering values require named tokens and catalog coverage; do not hide them in component CSS, inline styles or literal fallbacks. Keep the standardized app-style-tokens admission checks in normal Reports verification. Data-derived image/chart geometry and structural CSS keywords remain data/layout, and third-party asset colors retain their provenance.

- Before choosing component colors, consult Styles → Color roles and its definitions in `appStyleTokensConfig`. Use the documented role and shared control variant; a decorative accent does not establish an action style. Update role guidance and standardized Styles coverage when introducing a new semantic use.

- Helpers are pure, synchronous value transformations: the same input gives the same result, without I/O, time/randomness, hidden state, or mutation. Declare reviewed helper contracts with `@pure`; the catalog requires this declaration, its conservative source guard and two distinct consumers. Service classes own operations and effects; models wrap persisted data; shared interfaces and aliases belong under Types. Unknown or effectful functions are not helpers.
- Reserve shared helper folders for pure callable helpers used by at least two distinct components, services or named functions, in any combination. Count actual runtime references; repeated calls by one consumer, type-only references, unused imports and forwarding exports do not establish sharing.
- A helper with one consumer belongs in that consumer's folder, beside the component, service or function that owns it. Keep private helpers out of codebase-wide utility folders. Promote them into shared folders only when a second distinct consumer needs them; move them back when only one remains.
- Preserve registered identities, contracts and history when relocating helpers. Update imports, tests and owned source together. Mixed shared/private modules must be split by responsibility rather than moving a shared helper into one consumer's folder. An unused export has no proven owner; check public API contracts and dynamic/runtime use before removing or relocating it.

- Shared service catalogs require two distinct active runtime owner units. A single-consumer service implementation belongs inside its owning component or code area, with its private helpers. Types, unused imports, repeated references, forwarding exports and indirect page reachability do not establish sharing. Preserve registered identities, contracts and supported public entries when relocating; inspect dynamic/runtime contracts before assigning an unused export to an owner.

- Keep Harness, its coding agents and active checks below the combined 10 GB RAM target. Measure attributed process memory; report shared or unmeasurable usage separately.
- Run one broad check, build or history prebuild at a time. Use focused standardized tests while editing and reuse running servers.
- Vitest defaults to one worker across workspaces. Increasing concurrency requires measuring the combined peak first. Stop only verified task-owned leftover processes; preserve other sessions and servers.

- Files should stay focused and under 220 lines unless a local audit baseline explicitly tracks existing debt.
- Functions should stay under 55 lines.
- Classes should stay under 120 lines.
- Methods should stay under 35 lines.
- Keep nesting at 4 levels or less.
- Prefer one class per file.
- Keep command modules thin; put orchestration in workflows and reusable logic in focused modules.
- A cache of Git answers keys only names proven immutable: establish the repository's object format first, since hexadecimal shape alone is not immutability. Its tests move refs named like ids of each other supported width and give a Git whose format is unknown.
- A test or build config names each helper it owns from its own file: a workspace without a config inherits it and resolves relative paths from itself. Before a full check, run the root and each inheriting workspace's normal test entrypoint.
- When shared browser fixture dependencies change, prove API-only tests still run with an unavailable browser executable, alongside the actual browser cases. Characterize diagnostics before page announcement and overlapping context/page delivery without duplicates. Monitoring must preserve lazy browser setup.

## Module Naming

Models are persisted data wrappers with source-declared storage schemas. Existing shared type modules belong under Types. Preserve their registered IDs and source paths; omit the .types suffix on cards, links and headings.

Before extending an alias resolver, strengthen its standard lookup matrix with
canonical-name collisions, plural forms and normalization. Canonical names keep
precedence over new aliases.

Read `harness info naming` and the scaffold guide before naming a module. Classes keep PascalCase and their role suffix; models and components keep PascalCase; functions, pure helpers and value modules keep their actual camelCase name. Match source filenames and primary declarations, preserve framework entries and stable registered IDs, and keep descriptive responsibilities separate from code names. Use the same canonical code identity on cards, usage links and detail headings. Standard catalog coverage compares those surfaces for class, callable, component and model consumers at current and historical revisions; card-only naming overrides are not allowed.

Shared Services lists require source-proven concrete instantiated classes with multiple public instance methods (including inherited methods) and two distinct active runtime owner units for that class. Exclude functions, objects, static namespaces and source-unproven historical entries. Preserve actual PascalCase class identifiers; never capitalize a function label to imply a class. Review responsibilities and real method usage separately: structural eligibility cannot prove absence of semantic redundancy.

## Responsibility Categories

Group related list, detail and history pages by feature in meaningful domain
folders. Reuse that feature category with `--group`; use route groups when public
URLs must stay unchanged. Avoid broad technical catch-alls when a feature is known.

Application config modules belong in `src/configs/<category>/`, with one focused file per config. Update generator output and public SDK export plans together; run the standard every-scaffold export-to-emission guard for config relocations. The Configs catalog renders one table per source file, with typed literal values and source-preserving inspection of computed expressions. Do not execute configuration to populate it. Keep framework-required entry files at their supported addresses.

Place every module type in `src/<kind>/<category>/` using the project taxonomy in
`harness.groups.json`. Use `harness generate <kind> <name> --group <category>` for
new code; a new explicit group extends the taxonomy. Reuse an existing category
when its responsibility fits. Unambiguous names or declared responsibilities can
select it automatically; ambiguity requires a deliberate category choice. Keep
private helpers and single-owner services inside their owner category. Preserve
registered IDs, framework entries and public URLs. The explorer reads category
folders and titles from the selected source revision for every collection.

## Measurement Evidence

- Every code change must collect source bytes, source lines, complexity and dependency counts for each added or directly changed unit from the exact committed tree. Measure each applicable emitted target from that snapshot's real build output. A failed or missing full verification record must not hide readable source measurements.
- Every changed executable unit must also have a representative measured workload in its normal behavior tests, even without a performance budget. Record fresh timing and a meaningful memory observation with the unit or callable, workload, method, samples, target, runtime profile and tested revision. Focused regression evidence and full verification both retain these observations.
- For pages, collect real route navigation timing and page JavaScript heap after fonts and images settle. Bind the capture to the server's verified build and revision. A client-side route change must not borrow the previous document's navigation timing. Name whole-page heap or whole-process RSS accurately, including shared code or runner overhead; never describe it as isolated unit memory.
- Page screenshot scenarios require navigation timing and scoped renderer memory at every required viewport. Collect both through the shared capture helper and retain them with the images.
- Do not complete a changed executable unit with applicable metrics left unmeasured. Extend its standard workload coverage and rerun it. If source, runtime, toolchain or safe memory attribution is unavailable, record the exact reason, keep that check open, and report the blocker; absence is never zero or a passing measurement.
- Refresh prepared history when measurement support changes and verify the delivered data as well as the renderer. Every entity kind must show figures from its selected commit; old missing placeholders must not override current source observations. A portable index without its Git source must be rebuilt from that source rather than borrowing the working tree.
- Show actual performance observations independently of budget declarations. Preserve workload, target and profile boundaries. A changed unit requires a fresh run; inherited observations of an unchanged unit keep their original revision and label. A focused benchmark does not grant full verification or approve a budget baseline.

## Type Files

Keep named interfaces and type aliases in a sibling `<module>.types.ts` file beside their implementation. Use `import type`; preserve public type imports through type-only re-exports. This applies to components, services, helpers, configs, tests and scripts. Keep runtime constants and classes separate from type declarations; shared type-only models retain their established owner. Generators must emit the companion file, and `harness audit` rejects mixed declarations. New companions belong to their implementation unit; preserve already registered standalone type-module identities.

Source tabs list implementation files, sibling type files and associated tests from the selected revision. Resolve tests from direct source imports or authored scenario coverage; retain their committed bytes and gaps, and reuse the shared file list and code viewer. Never substitute working-copy or newer test contents.

When changing a shared Game renderer, include the root `test/game-runtime.test.ts` consumer guard in owning qualification, even when full CLI/native suites are deferred. Verify semantic object visibility and retained references; inactive scene containers must not change what a visibility assertion means.
