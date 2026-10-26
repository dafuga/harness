# AGENTS.md

This is a Harness Bun TypeScript library. Treat Harness as the operating contract for every code change in this project.

## Required Harness Workflow

- Read this file and the `.codex/skills/harness/SKILL.md` skill before changing code.
- Use Harness generators for supported code shapes instead of hand-rolling new structure.
- Ask `harness info <topic>` before adding unfamiliar code or choosing a scaffold shape.
- For non-trivial work, ask what the loop should prove, search templates, then create or continue a `harness loop`.
- Add or update a feature spec before implementation.
- Keep files small, focused, and aligned with `harness.audit.json` limits.
- Run `bun run check` before handing work back; it includes formatting, type checks, lint, tests, build, and `bun run audit`.

## Clean Code Review

- Use `harness info clean-code` for optional Jev reviews.
- Preview with `harness audit . --clean-code --dry-run`; reviews remain disabled until enabled.
- Configure a project-owned credential and assess advisory results before enabling the gate.
- Keep uncertain judgments visible and never call incomplete reviews clean.

## Bug and Regression Loops

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

## Code Rules

- Files stay at or below 220 lines.
- Functions stay at or below 55 lines.
- Classes stay at or below 120 lines.
- Methods stay at or below 35 lines.
- Nesting stays at or below 4 levels.
- Functions and methods take at most 4 parameters.
- Cyclomatic complexity stays at or below 10.
- Each file defines at most 1 class.
- Generated scaffold file names should keep the casing and suffixes prescribed by Harness.
- Function exports should use camelCase and generated function files should export the expected name.
- Classes should not use catch-all Manager names.
- Command modules delegate to workflows instead of importing templates or file-generation helpers.
- Core, template, workflow, and command imports move in one direction.
- Harness audit applies ecosystem adapters for app and library code surfaces.
- Unsupported file types must appear in audit coverage instead of being skipped silently.

Hard limits: files 220, functions 55, classes 120, methods 35, nesting 4.

## Standard Test Forms

Use exactly these five forms. Each draws its cases from the entity's declared contract as a finite, documented matrix.

1. Pages: Playwright screenshot matches of each declared page state at every required viewport (desktop, tablet and mobile).
2. Components: Playwright screenshot matches of the component at rest, plus each declared interaction, prop and error state.
3. Helpers: one unit case per authored example, asserting its documented output or error.
4. Classes: one case per method and declared initialization or lifecycle state, including each declared error.
5. APIs: structural complete JSON response matches for each supported prop and error matrix row.

- Interaction, accessibility and console assertions stay inside the case that exercises them; they are never separate tests.
- Other functions and classes map each distinct behavior onto the matching form. Do not add a sixth shape.
- Projects without UI have no page or component cases; their modules use the helper, class and API forms.
- Do not auto-accept screenshot baselines. Review each changed image before its baseline is updated.
- Retain reviewed baselines through Harness evidence with source revision, media hash and review provenance. Never automatically accept a missing or changed image.
- Matrices include boundaries, invalid inputs and prop combinations that change behavior. Static types and configuration use compiler, lint, build and audit checks.
- Unsupported or missing coverage fails explicitly: a unit without its declared states, examples, methods or matrix rows is a reported gap. Never skip the case or cover it with another form.

## Stable-Case Bug Policy

- Do not write standalone bug regression tests. A reported bug strengthens the existing case of its form (its input, fixture, state or assertion) under the same registered title.
- Keep each form's case count fixed. Add or remove a case only when the contract explicitly changes a capability: a declared state, prop, example, method, lifecycle state, error or matrix row.
- A behavior with no existing case is a missing coverage category. Declare its capability in the contract first, then add one case of its form before the product repair.
- Keep registered case titles and identities stable; verification records bind to them.
