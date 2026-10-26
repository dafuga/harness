# Harness Project Discipline

Use this skill whenever you are planning, implementing, reviewing, or verifying code in this Harness SvelteKit app.

## Operating Rules

1. Treat `harness info`, Harness generators, and `harness audit` as mandatory project controls.
2. Run `harness info <topic>` or `harness info scaffolds --json` before creating unfamiliar code shapes.
3. For non-trivial work, ask what the loop should prove, search templates, then create or continue a `harness loop`.
4. Prefer `harness generate <kind> <name>` for supported scaffolds, then adapt the generated file within Harness limits.
5. Add or update the feature spec first so the intended behavior is explicit before implementation.
6. Keep generated and hand-edited files inside the configured Harness rule limits.
7. Use `harness info clean-code` for optional Jev review; preview coverage before enabling it, use a project-owned credential, and assess advisory results before gating.
8. Verify with `bun run check` before handing work back.

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

- Browser normal flows, including screenshot/video runs, must have no unexpected console.error or pageerror events. Use the shared browserTest fixture and watch extra contexts before navigation. Preserve logs for expected errors and declare their exact messages and reasons in that test. For unexpected errors, prove a failing log assertion before repair, then rerun the same unchanged regression until the error disappears.

## Hard Limits

- Files: 220 lines.
- Functions: 55 lines.
- Classes: 120 lines.
- Methods: 35 lines.
- Nesting: 4 levels.
- Parameters: 4.
- Classes per file: 1.

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
