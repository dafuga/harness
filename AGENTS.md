# AGENTS.md

This is a Harness Bun TypeScript library. Treat Harness as the operating contract for every code change in this project.

## Required Harness Workflow

- Read this file and the `.codex/skills/harness/SKILL.md` skill before changing code.
- Use Harness generators for supported code shapes instead of hand-rolling new structure.
- Ask `harness info <topic>` before adding unfamiliar code or choosing a scaffold shape.
- For non-trivial work, ask what the loop should prove, search templates, then create or continue a `harness loop`.
- Add or update a feature spec before implementation.
- Write tests only in the five standard forms, and fix reported bugs by strengthening existing cases; see Standard Test Forms and Stable-Case Bug Policy.
- Keep files small, focused, and aligned with `harness.audit.json` limits.
- Run `bun run check` before handing work back; it includes formatting, type checks, lint, tests, build, and `bun run audit`.

## Machine Resources

- Run coding tools through `harness resources run --priority coding --cpus auto --memory-mib auto -- <command>`.
- Queue agent-needed tests with `--priority agent-test`; use `--priority environment` for background checks.
- Use `harness resources status --json` before heavy work. Keep 10% CPU and max(10% RAM, 2 GiB) free.
- Finish current tests under pressure and hold subsequent work; never suspend unrelated processes.

## Clean Code Review

- Use `harness info clean-code` for optional Jev reviews.
- Preview with `harness audit . --clean-code --dry-run`; reviews remain disabled until enabled.
- Configure a project-owned credential and assess advisory results before enabling the gate.
- Keep uncertain judgments visible and never call incomplete reviews clean.

## Module task handoff

- When a Codex session assigns module implementation, use `harness task feature <id> --goal <text> --tldr <text>` then `harness task add --input <file>`.
- Tasks require a registered module and a wantedContract with responsibility, inputs, outputs and errors. Harness commits the contract to refs/harness/tasks before pickup, preserving source HEAD and unrelated edits.
- Task prompts start with the shared feature goal and TLDR, followed by the module's overall goal and pinned wanted contract. Keep shared context stable across related tasks.
- Omitted models use auto: claude-haiku-5-5/medium, then gpt-6-luna/max only after confirmed Claude quota rejection. Explicit --model and --intelligence settings never silently fall back.
- Run `harness task worker --worker <id> --watch` for assignment pickup. Workers preserve isolated worktrees for review; normal verification is still required. Use one repository as the active queue owner and `harness task sync <remote>` for explicit handoff; divergence is never overwritten.

## Scaffold export coherence

- Change generated source, tests and public export plans together. Verify every generated export targets an emitted scaffold and run the standard focused CLI project-check scenario after a scaffold shape change.

## Helper implementation ownership

- Public shared helper implementations belong under src/helpers/<responsibility>/<camelName>.ts, with pure functions separated from component/service orchestration. Keep single-consumer helpers with their owner. Point helper source contracts and Source tabs only at the selected callable implementation, never all files of its owning module. Preserve supported import addresses with forwarding exports when needed; update active callers to the canonical helper source. Run the registry helper-source guard and the standard selected-helper Source browser test.

## Callable usage examples

- Every public helper needs committed usage examples in its callable contract: a real call, argument values, and expected output or error. Verify examples against the implementation; never invent outcomes.
- Use descriptive behavior titles, never numbered placeholders. Choose one representative example per distinct behavior; combine redundant inputs. Review the implementation to identify features, including meaningful error or empty states. Equal outputs alone do not establish duplication. A helper's unit cases are exactly its authored examples; add a boundary input as an example only when it documents a distinct behavior.
- Run `harness units check`: missing helper examples, placeholder titles and repeated titles or calls must fail. Re-indexing must preserve authored examples. Each helper detail page shows only its own examples at the viewed commit.

## Standard Test Forms

Use exactly these five forms. Each draws its cases from the entity's declared contract as a finite, documented matrix.

1. Pages: Playwright screenshot matches of each declared page state at every required viewport (desktop, tablet and mobile). Layouts use the page form, with a labelled Child content placeholder in the real child slot.
2. Components: Playwright screenshot matches of the component at rest, plus each declared interaction, prop and error state.
3. Helpers: one unit case per authored example, asserting its documented output or error.
4. Classes: one case per method and declared initialization or lifecycle state, including each declared error.
5. APIs: structural complete JSON response matches for each supported prop and error matrix row.

- Interaction, accessibility and console assertions stay inside the case that exercises them; they are never separate tests.
- Other functions and classes map each distinct behavior onto the matching form. Do not add a sixth shape.
- Projects without UI have no page or component cases; their modules use the helper, class and API forms.
- Do not auto-accept screenshot baselines. Review each changed image before its baseline is updated.
- Retain reviewed baselines through Harness evidence with source revision, media hash and review provenance. Never automatically accept a missing or changed image.
- Keep compiler, lint and audit checks before browser screenshot gates in generated apps. Verify this order in the owning generator cases and real CLI static-violation matrix.
- When generating or changing a test runner, verify its reporter records declared files, titles and revisions for passed, failed, skipped and retried cases in the existing generator cases. Also exercise the real runner on the designated test host.
- Keep one Playwright reporter declaration with both Harness and JSON reporters when a fixture needs both. Check the existing generator case and the actual JSON output on the designated test host.
- When generating visual scenarios, verify in the existing generator case that the declared build is stamped and the test owns its preview server. Check the generated build identity before browser capture.
- Matrices include boundaries, invalid inputs and prop combinations that change behavior. Static types and configuration use compiler, lint, build and audit checks.
- Unsupported or missing coverage fails explicitly: a unit without its declared states, examples, methods or matrix rows is a reported gap. Never skip the case or cover it with another form.

## Stable-Case Bug Policy

- Do not write standalone bug regression tests. A reported bug strengthens the existing case of its form (its input, fixture, state or assertion) under the same registered title.
- Keep each form's case count fixed. Add or remove a case only when the contract explicitly changes a capability: a declared state, prop, example, method, lifecycle state, error or matrix row.
- A behavior with no existing case is a missing coverage category. Declare its capability in the contract first, then add one case of its form before the product repair.
- Keep registered case titles and identities stable; verification records bind to them.

## Bug and Regression Loops

- For a reported bug, first diagnose why existing tests missed it. Name the responsible standardized test or scenario and its missing inputs, lifecycle, fixture or assertion; record the coverage gap before product repair.
- Strengthen the existing standardized test and shared fixtures or assertions using the project's Harness scenario, state, viewport, registered-test and evidence format. Do not add a one-off bug-specific regression test.
- Use exactly these five contract-driven test forms. Each draws its cases from the entity's declared contract as a finite, documented matrix.
- Pages: Playwright screenshot matches of each declared page state at every required viewport (desktop, tablet and mobile). Layouts use the page form, with a labelled Child content placeholder in the real child slot.
- Components: Playwright screenshot matches of the component at rest, plus each declared interaction, prop and error state.
- Helpers: one unit case per authored example, asserting its documented output or error.
- Classes: one case per method and declared initialization or lifecycle state, including each declared error.
- APIs: structural complete JSON response matches for each supported prop and error matrix row.
- Interaction, accessibility and console assertions stay inside the case that exercises them; they are never separate tests.
- Other functions and classes map each distinct behavior onto the matching form. Do not add a sixth shape.
- Unsupported or missing test coverage is an explicit validation failure; report the missing coverage category and declare the capability in the contract before adding its matching case. Never skip it, invent a case, or use another form.
- Do not write standalone bug regression tests. A reported bug strengthens the existing case of its form under the same registered title.
- For bug repairs, do not increase case counts. Keep each form's case count fixed. Add or remove a case only when the contract explicitly changes a capability: a declared state, prop, example, method, lifecycle state, error or matrix row.
- Keep registered case titles and identities stable; verification records bind to them.
- Declare all states, props and errors; add a case only when a declared capability or matrix row changes.
- Artifact validation, hashing and storage must consume the same byte snapshot; strengthen the existing method case with accepted getter or aliased-buffer inputs before changing an artifact producer.
- API comparisons keep every response field, including reserved JSON keys. Before changing a comparison or authored-data parser, strengthen its existing method case to prove field retention and preserve admitted getters, arrays and invalid values.
- Freeze executable tests and authored Examples, states, methods and expected results together. Admit test-only edits to those contract fields, reject product metadata hidden among named tests, and keep original Git blob provenance separate from semantic expectation hashes.
- Do not auto-accept screenshot baselines. Review each changed image before its baseline is updated.
- Retain reviewed baselines through Harness evidence with source revision, media hash and review provenance. Never automatically accept a missing or changed image.
- Matrices include boundaries, invalid inputs and prop combinations that change behavior. Static types and configuration use compiler, lint, build and audit checks.
- Before accepting a test migration, run the compiler and structure audit for the root and every affected workspace. Check companion type files and Svelte source explicitly; an ignored-file lint warning is not Svelte verification.
- Run the strengthened test against the broken implementation and record the failing command, assertion and observed result before repair. A fixture or environment error is not defect proof; never manufacture a failure.
- Before changing product code, commit the failing test separately. Run harness loop record <loop> --phase red --test <path> --command <command> --assertion <actual failure> on that commit. Then make a separate fix commit and run loop record --phase green: the tests, fixtures, command and environment must be unchanged. Preserve both commits when landing; do not squash away the failing-test commit. Focused regression results do not replace full verification.
- Repair the product while keeping the strengthened test unchanged. Repeat repair and the same unchanged test until it passes; retain failing and passing evidence at their tested revisions, then run normal verification.
- When correcting function names or APIs, parameter names describe their domain role; rename source declarations and update callers and contracts, rather than inventing display labels. Diagnose why the original name or API was accepted, then repair the earliest responsible generator, skill or review checkpoint within the authorized project scope. Verify the revised guidance is emitted for generated projects.
- For helper catalogs, prove one selected callable per detail page: distinct links for functions sharing a source module, only that callable’s parameters, return and throws, and selection retained across tabs and revisions. Keep module ownership/history explicit; a missing callable must not silently show a sibling.
- During read-only planning, report the coverage diagnosis and propose the standardized test change; do not edit tests or product source. Write only within an approved implementation request.
- Use `harness loop create <name> --from bug-fix --goal <text>` for bug repairs: reproduce with its strengthened standardized case failing before implementation, then repeat repair and the same unchanged case until it passes.
- Use `--from regression-prevention` for regressions requiring durable prevention: identify the root cause, propose the repair and guard, implement both, and include the guard, a strengthened standardized case, in normal project verification.
- Prove the guard rejects reintroducing the original failure in an isolated fixture or temporary workspace; restore the repair and prove the guard passes.
- Record failing and passing commands, assertions, and results as step evidence. Keep green/guard/verification steps pending while proof fails; the agent retries repairs and checks. Harness does not launch an AI repair runner or automatically complete steps.
- For affected UI paths, exercise the browser flow and capture fresh screenshots, then inspect the images before recording proof. Report blockers without claiming completion.
- Browser normal flows, including screenshot/video runs, must have no unexpected console.error or pageerror events. Use the shared browserTest fixture; watch extra contexts before navigation. Keep logs for expected errors and declare their exact messages and reasons in that test. For unexpected errors, prove a failing log assertion before repair, then rerun the same unchanged regression until the error disappears; preserve diagnostics and keep verification pending while errors remain.
- Shared browser fixtures must preserve lazy setup. When their dependencies change, prove API-only tests run with an unavailable browser executable alongside actual browser cases.

## Atomic UI composition

- Build Svelte UI as atoms → molecules → organisms → layouts/templates → pages. Keep the responsibility category and stable unit identity independent of this level.
- Use the existing shared control first. Molecules compose atoms; organisms compose atoms, molecules and smaller organisms. Layouts frame these with a real child-content slot; pages supply route data. Never import a page/layout into a molecule or organism.
- Native elements belong in atoms. Harness provides a separate atom for every conforming HTML element, each input type, SVG elements and dynamic elements. Discover them with `harness info component`; install the library with `harness generate elements`.
- Declare `<!-- @harness-tier molecule -->` (or atom, organism, layout, page). Generated components default to molecule; use `--level organism` for a feature section. An atom owns native presentation, never feature data loading or composed components.
- Native atom calls such as `<hx-button type="button">Save</hx-button>` use the canonical HtmlButton component definition. Declare its relative library directory with `<!-- @harness-atoms ./atoms -->`. Native bindings, actions, events, semantics and scoped styles are preserved by `atomicComponents()` before Svelte compilation. Keep its generated native typings and Svelte integration installed; these tags are compiled atoms, not runtime custom elements.
- Basic static atoms also support direct Svelte imports. For native bindings/actions, use the native atom call. Keep native atom definitions generated and free of feature logic/styles; put themed controls and validation in reusable molecules using the project's own design tokens.
- Framework document entry files and Svelte framework directives retain their supported syntax. Third-party component internals and trusted rendered source/HTML content are not an instruction to duplicate those implementations.
- Run `harness audit`, `harness units check`, focused interaction tests and the standard visual catalog. Check value binding, form submission, disabled/required states, labels, focus, dialogs and each affected viewport. Do not accept imports or an unchanged-looking screenshot as interaction proof.

## Naming

Read `harness info naming` and the scaffold guide before naming code. Keep code names consistent across cards, usage links and detail headings.

- Naming: Helpers are pure camelCase functions; colliding SDK exports use <camelName>Helper while retaining the existing binding. Implementations belong in src/helpers/<responsibility>/<camelName>.ts; keep single-consumer functions in their owner folder.
- Naming: Controller classes use <PascalName>Controller.ts and export the matching class, including inside an owner's folder.
- Naming: Service classes use <PascalName>Service.ts and export the matching class, including inside an owner folder. Shared service catalogs require instantiated classes with multiple public instance methods and two distinct active runtime owners; functions, objects and static namespaces are not service classes.
- Naming: Decorator classes use <PascalName>Decorator.ts and export the matching class, including inside an owner's folder.
- Naming: Adapter classes use <PascalName>Adapter.ts and export the matching class, including inside an owner's folder.
- Naming: Repository classes use <PascalName>Repository.ts and export the matching class, including inside an owner's folder.
- Naming: Validator classes use <PascalName>Validator.ts and export the matching class, including inside an owner's folder.
- Naming: Serializer classes use <PascalName>Serializer.ts and export the matching class, including inside an owner's folder.
- Naming: Policy classes use <PascalName>Policy.ts and export the matching class, including inside an owner's folder.
- Naming: Job classes use <PascalName>Job.ts and export the matching class, including inside an owner's folder.
- Naming: Notification classes use <PascalName>Notification.ts and export the matching class, including inside an owner's folder.
- Naming: Command classes use <PascalName>Command.ts and export the matching class, including inside an owner's folder.
- Naming: Mailer classes use <PascalName>Mailer.ts and export the matching class, including inside an owner's folder.
- Naming: Channel classes use <PascalName>Channel.ts and export the matching class, including inside an owner's folder.
- Naming: Form classes use <PascalName>Form.ts and export the matching class, including inside an owner's folder.
- Naming: Middleware classes use <PascalName>Middleware.ts and export the matching class, including inside an owner's folder.
- Naming: Game views use <camelName>ViewConfig.ts with a matching camelCase config export.
- Naming: Mechanic functions use <camelName>.ts and export the matching descriptive camelCase function.
- Naming: Checkpoints use <camelName>CheckpointConfig.ts with a matching camelCase config export.
- Naming: Models use <PascalName>.ts with a matching persistence class; type collections use <PascalName>.types.ts. Persisted data wrappers belong under Models; existing shared type modules belong under Types. Omit .types from displayed names and preserve registered IDs and source paths.
- Naming: Components use <PascalName>.svelte and the same PascalCase import name.
- Naming: Partials use <PascalName>Partial.svelte and the same PascalCase import name.
- Naming: Shell components use <PascalName>.svelte and the same PascalCase import name.
- Naming: Functions and pure helper callables use descriptive camelCase names; utility modules use <camelName>.ts. Review the actual input-to-output operation, not only casing.
- Naming: Utilities use <camelName>.ts with a matching camelCase export that describes its actual operation.
- Naming: Value modules use <camelName>.ts; class and type modules follow their own type rules. Keep framework .client, .server, .svelte and .d suffixes where required.
- Naming: Workflow modules use <camelName>.ts; exported operations use descriptive camelCase names.
- Naming: Config objects use <camelName>Config.ts with a matching camelCase export.
- Naming: Stores use <camelName>.svelte.ts and export create<PascalName>Store.
- Naming: Hooks use <camelName>Hook.server.ts and export <camelName>Hook; preserve the framework hooks.server.ts entry.
- Naming: Concerns use with<PascalName>.ts and export with<PascalName>.
- Naming: Initializers use initialize<PascalName>.ts and export initialize<PascalName>.
- Naming: Seeders use <kebab-name>.ts and export seed<PascalName>.
- Naming: Pages preserve src/routes/<kebab-name>/+page.svelte; their screen labels may be human readable.
- Naming: Pages preserve framework +page.svelte and +page.server.ts filenames and their exported handlers.
- Naming: Layouts preserve src/routes/<kebab-name>/+layout.svelte and framework handler names.
- Naming: API routes preserve src/routes/api/<kebab-name>/+server.ts and HTTP method exports such as GET and POST.
- Naming: Entrypoints keep framework-required filenames and exports; other operation modules use <camelName>.ts.
- Naming: Unit tests use <kebab-name>.test.ts.
- Naming: Browser tests use <kebab-name>.spec.ts.
- Naming: Feature specifications use <kebab-name>.md.
- Naming: Migrations use lowercase kebab-case or snake_case .sql filenames.
- Naming: Each generated resource piece follows its own model, controller, policy, serializer, route or test naming rule.
- Group related list, detail and history pages by feature, using meaningful domain folders instead of broad technical catch-alls. Reuse that feature category with --group; use route groups when public URLs must stay unchanged.
- Config modules live in src/configs/<category>/, with one focused file per config. Update generator output and public SDK export plans together; prove every planned export targets an emitted file. Keep source-based config documentation static; do not execute configuration to discover values.
- Expose only important controls a user, operator or app developer needs to change. Declare each public configControl with its exact source, name, audience and purpose. Prefer a sensible fixed default when no real tuning need exists. Keep schemas, protocol invariants, lookup tables, fixture machinery and documentation internal; design tokens belong in Styles. New config scaffolds start internal and do not invent name or enabled settings.
- General text helpers belong in Strings: casing, pluralization, identifier shortening and duration display formatting are reusable operations, not the domains of their callers. Keep domain-specific helpers in their domain and derive each helper category from its own implementation folder.
- Organize every module kind by responsibility: src/<kind>/<category>/<module>. Keep owner-private code inside its owner category and keep stable unit IDs.
- Use harness generate <kind> <name> --group <category> when adding code. Reuse a project category; an explicit new category extends harness.groups.json. Categories are not a fixed list.
- Categorized projects infer only an unambiguous whole-word match from the name or responsibility. Missing or ambiguous matches require --group; do not invent a misleading category.
- Share one project taxonomy across components, helpers, configs, models, services and all other module kinds. Folders drive revision-bound explorer headings and filters.
- Keep framework entry filenames and public routes stable; generated route groups organize files without changing URLs. Keep single-owner implementations with that owner.

## Screenshot Evidence

- A changed UI is not ready to hand off or merge while any required screenshot is missing. Capture each applicable page, tab/state and desktop, tablet and mobile viewport through its standard test, from the exact committed build. Fix capture failures and rerun; a green assertion alone is insufficient.
- Register and retain the original image bytes, hashes, unit, state, viewport, served build and revision in Harness evidence before temporary workspace cleanup. A scratch path, broken image URL or image in chat is not durable screenshot delivery.
- Layouts are reusable visual frames with a child-content slot; routing hosts, data loaders and options-only modules are not layouts. Reuse component cards with title, image and page-usage links. Capture the actual layout with a labelled Child content placeholder in its real child slot.
- Public category or route renames must inventory canonical and compatibility titles and links. Update exposed labels, preserve stable IDs and aliases, and extend the standard composition check across overview, details and history. Run affected downstream consumer tests alongside their typechecks. Run the affected package lint and audit as well. Include affected public-entry navigation checks even when broader suites are deferred. Preserve route, revision and access assertions while updating expected names.
- Full-frame previews own their content boundaries. Apply content-container styling inside the frame, never around its navigation. When changing fixture context, extend the existing standard acceptance assertions for affected controls and inspect retained pixels before accepting the UI.
- Resolve a scenario screenshot slot to its declared units. A slot name is not a page identity; never fill a missing preview with another page's image.
- When capturing, projecting or retrieving screenshot evidence, exercise distinct declared case bindings sharing a state, viewport and evidence slot, retries with differing outcomes, plus wrong and duplicate bindings, in the existing standard cases. Preserve the unit, case, tested revision, attempt, original hash and outcome.
- Scope screenshots to each scenario check when cases share a test file; exercise both checks in the existing validation case.
- Rebuild or reopen the delivered history from its Git evidence, decode every required image, and inspect fresh screenshots before reporting completion. Both comparison sides need their own images; never substitute another unit, state or revision.
- After squash landing, check the actual remote base commit's prepared history and decode its visible previews. Identical complete Git trees may retain focused captures with their original revision and status; a different tree requires new captures. Feature-branch screenshots alone do not prove merged delivery.
- Complete and format tracked loop metadata before the final capture run. Keep that captured tree unchanged through landing; further tracked changes require fresh captures.
- Keep focused screenshots available even when full verification fails, with their focused run and outcome clearly labelled. They grant no full verification verdict. Missing or corrupt bytes keep the visual check open; report the exact blocker and continue the repair.

## Code Rules

- Files stay at or below 220 lines.
- Functions stay at or below 55 lines.
- Classes stay at or below 120 lines.
- Methods stay at or below 35 lines.
- Nesting stays at or below 4 levels.
- Functions and methods take at most 4 parameters.
- Cyclomatic complexity stays at or below 10.
- Each file defines at most 1 class.
- Use harness info naming and the scaffold guide before naming a module.
- Naming: Helpers are pure camelCase functions; colliding SDK exports use <camelName>Helper while retaining the existing binding. Implementations belong in src/helpers/<responsibility>/<camelName>.ts; keep single-consumer functions in their owner folder.
- Naming: Controller classes use <PascalName>Controller.ts and export the matching class, including inside an owner's folder.
- Naming: Service classes use <PascalName>Service.ts and export the matching class, including inside an owner folder. Shared service catalogs require instantiated classes with multiple public instance methods and two distinct active runtime owners; functions, objects and static namespaces are not service classes.
- Naming: Decorator classes use <PascalName>Decorator.ts and export the matching class, including inside an owner's folder.
- Naming: Adapter classes use <PascalName>Adapter.ts and export the matching class, including inside an owner's folder.
- Naming: Repository classes use <PascalName>Repository.ts and export the matching class, including inside an owner's folder.
- Naming: Validator classes use <PascalName>Validator.ts and export the matching class, including inside an owner's folder.
- Naming: Serializer classes use <PascalName>Serializer.ts and export the matching class, including inside an owner's folder.
- Naming: Policy classes use <PascalName>Policy.ts and export the matching class, including inside an owner's folder.
- Naming: Job classes use <PascalName>Job.ts and export the matching class, including inside an owner's folder.
- Naming: Notification classes use <PascalName>Notification.ts and export the matching class, including inside an owner's folder.
- Naming: Command classes use <PascalName>Command.ts and export the matching class, including inside an owner's folder.
- Naming: Mailer classes use <PascalName>Mailer.ts and export the matching class, including inside an owner's folder.
- Naming: Channel classes use <PascalName>Channel.ts and export the matching class, including inside an owner's folder.
- Naming: Form classes use <PascalName>Form.ts and export the matching class, including inside an owner's folder.
- Naming: Middleware classes use <PascalName>Middleware.ts and export the matching class, including inside an owner's folder.
- Naming: Game views use <camelName>ViewConfig.ts with a matching camelCase config export.
- Naming: Mechanic functions use <camelName>.ts and export the matching descriptive camelCase function.
- Naming: Checkpoints use <camelName>CheckpointConfig.ts with a matching camelCase config export.
- Naming: Models use <PascalName>.ts with a matching persistence class; type collections use <PascalName>.types.ts. Persisted data wrappers belong under Models; existing shared type modules belong under Types. Omit .types from displayed names and preserve registered IDs and source paths.
- Naming: Components use <PascalName>.svelte and the same PascalCase import name.
- Naming: Partials use <PascalName>Partial.svelte and the same PascalCase import name.
- Naming: Shell components use <PascalName>.svelte and the same PascalCase import name.
- Naming: Functions and pure helper callables use descriptive camelCase names; utility modules use <camelName>.ts. Review the actual input-to-output operation, not only casing.
- Naming: Utilities use <camelName>.ts with a matching camelCase export that describes its actual operation.
- Naming: Value modules use <camelName>.ts; class and type modules follow their own type rules. Keep framework .client, .server, .svelte and .d suffixes where required.
- Naming: Workflow modules use <camelName>.ts; exported operations use descriptive camelCase names.
- Naming: Config objects use <camelName>Config.ts with a matching camelCase export.
- Naming: Stores use <camelName>.svelte.ts and export create<PascalName>Store.
- Naming: Hooks use <camelName>Hook.server.ts and export <camelName>Hook; preserve the framework hooks.server.ts entry.
- Naming: Concerns use with<PascalName>.ts and export with<PascalName>.
- Naming: Initializers use initialize<PascalName>.ts and export initialize<PascalName>.
- Naming: Seeders use <kebab-name>.ts and export seed<PascalName>.
- Naming: Pages preserve src/routes/<kebab-name>/+page.svelte; their screen labels may be human readable.
- Naming: Pages preserve framework +page.svelte and +page.server.ts filenames and their exported handlers.
- Naming: Layouts preserve src/routes/<kebab-name>/+layout.svelte and framework handler names.
- Naming: API routes preserve src/routes/api/<kebab-name>/+server.ts and HTTP method exports such as GET and POST.
- Naming: Entrypoints keep framework-required filenames and exports; other operation modules use <camelName>.ts.
- Naming: Unit tests use <kebab-name>.test.ts.
- Naming: Browser tests use <kebab-name>.spec.ts.
- Naming: Feature specifications use <kebab-name>.md.
- Naming: Migrations use lowercase kebab-case or snake_case .sql filenames.
- Naming: Each generated resource piece follows its own model, controller, policy, serializer, route or test naming rule.
- Group related list, detail and history pages by feature, using meaningful domain folders instead of broad technical catch-alls. Reuse that feature category with --group; use route groups when public URLs must stay unchanged.
- Config modules live in src/configs/<category>/, with one focused file per config. Update generator output and public SDK export plans together; prove every planned export targets an emitted file. Keep source-based config documentation static; do not execute configuration to discover values.
- Expose only important controls a user, operator or app developer needs to change. Declare each public configControl with its exact source, name, audience and purpose. Prefer a sensible fixed default when no real tuning need exists. Keep schemas, protocol invariants, lookup tables, fixture machinery and documentation internal; design tokens belong in Styles. New config scaffolds start internal and do not invent name or enabled settings.
- General text helpers belong in Strings: casing, pluralization, identifier shortening and duration display formatting are reusable operations, not the domains of their callers. Keep domain-specific helpers in their domain and derive each helper category from its own implementation folder.
- Organize every module kind by responsibility: src/<kind>/<category>/<module>. Keep owner-private code inside its owner category and keep stable unit IDs.
- Use harness generate <kind> <name> --group <category> when adding code. Reuse a project category; an explicit new category extends harness.groups.json. Categories are not a fixed list.
- Categorized projects infer only an unambiguous whole-word match from the name or responsibility. Missing or ambiguous matches require --group; do not invent a misleading category.
- Share one project taxonomy across components, helpers, configs, models, services and all other module kinds. Folders drive revision-bound explorer headings and filters.
- Keep framework entry filenames and public routes stable; generated route groups organize files without changing URLs. Keep single-owner implementations with that owner.
- Code catalogs, usage links and detail headings retain the same recorded code name; stable dotted unit IDs and framework filenames do not change with a display title.
- Classes should not use catch-all Manager names.
- Keep named interfaces and type aliases in sibling .types.ts files; import them with import type and preserve public type paths with type-only re-exports. Index new companions under their implementation unit while retaining existing explicit type-module identities.
- Separate type declarations from runtime values in components, services, helpers, configs, tests and scripts. Keep existing shared type modules with their established owner.
- Command modules delegate to workflows instead of importing templates or file-generation helpers.
- Core, template, workflow, and command imports move in one direction.
- Harness audit applies ecosystem adapters for app and library code surfaces.
- Unsupported file types must appear in audit coverage instead of being skipped silently.

Hard limits: files 220, functions 55, classes 120, methods 35, nesting 4.
