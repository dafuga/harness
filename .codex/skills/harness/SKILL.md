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

## Visual Component Evidence

- Every active visual component requires a preview bound to its own required screenshot state and viewport. Capture the actual component with representative parameters; verify fresh or validated inherited screenshots at the selected revision. A missing image or failed verdict blocks handoff: inspect and repair its registry, scenario, reason, ledger and budget failures; never hide the failure, substitute another component, or relabel a capture. Component titles name the component, with state labels confined to scenario states.

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

## Measurement Evidence

- End coding and planning tasks through `harness task check`. Coding completion requires an intact record for the committed source and actual representative latency and memory profiles, independently of budget declarations. Run `harness verify run --require-performance`; use the Harness `PerformanceProfileService` or declared benchmark runner rather than ad hoc timing scripts.
- Planning audits inspect the proposal, acceptance criteria, dependencies, verification and performance-testing plan without implementing it. Structural heuristics cannot prove arbitrary semantic fulfillment: expose remaining uncertainty and required review. Missing, stale and failed evidence cannot be replaced with free-text claims.

- Source size and complexity are automatic observations of the selected committed tree; show them even when no full verification record exists.
- Standard behavior tests for executable helpers record representative benchmark captures when verification requests evidence. Name the callable, workload, timing method and runtime profile. Focused regression runs retain these observations as well as their test outcome.
- Display recorded performance independently of budget declarations. Budgets judge limits; they do not decide whether an observation is visible. A focused benchmark never grants full verification or approves a baseline.
- Label whole-process memory as process memory, including runner overhead; never attribute it to one function. Explain unavailable metrics and distinguish missing evidence from actual failed checks.

## Integration Checkpoints

- When a public SDK export reaches new runtime dependencies, rebuild and cold-import the affected packed entry in an empty consumer without workspace-only frameworks. Call the exported operation as well as type-checking it; run the standard packaged API acceptance before broad verification.
- When catalog eligibility, labels or card controls change, refresh the canonical registry fixtures and run the existing planning-reference and browser navigation suites. A catalog display filter must not remove valid registry identities from planning prompts or direct historical routes. Cover active private units, first-parent removals and unrelated parent units; keep private units out of collections.
- For image lifecycle changes, exercise replacement and unmount while reads are pending. Detach old image elements before releasing blob URLs, retain late-result cancellation coverage, and require the unchanged browser error collector to remain clean.

## Hard Limits

- Files: 220 lines.
- Functions: 55 lines.
- Classes: 120 lines.
- Methods: 35 lines.
- Nesting: 4 levels.
- Parameters: 4.
- Classes per file: 1.
