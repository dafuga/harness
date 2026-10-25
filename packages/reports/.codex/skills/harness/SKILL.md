# Harness Project Discipline

Use this skill whenever you are planning, implementing, reviewing, or verifying code in this Harness SvelteKit app.

## Operating Rules

1. Treat `harness info`, Harness generators, and `harness audit` as mandatory project controls.
2. Run `harness info <topic>` or `harness info scaffolds --json` before creating unfamiliar code shapes.
3. For non-trivial work, ask what the loop should prove, search templates, then create or continue a `harness loop`.
4. Prefer `harness generate <kind> <name>` for supported scaffolds, then adapt the generated file within Harness limits.
5. Add or update the feature spec first so the intended behavior is explicit before implementation.
6. Keep generated and hand-edited files inside the configured Harness rule limits.
7. Verify with `bun run check` before handing work back.

- Browser normal flows, including screenshot/video runs, must have no unexpected console.error or pageerror events. Use the shared browserTest fixture and watch extra contexts before navigation. Preserve logs for expected errors and declare their exact messages and reasons in that test. For unexpected errors, prove a failing log assertion before repair, then rerun the same unchanged regression until the error disappears.

## Helper Review

Apply the [project helper naming review](../../../../../.codex/skills/harness/SKILL.md#helper-naming-review)
separately from the purity and reuse checks.

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
2. Components: Playwright screenshot matches of the component at rest, plus each declared interaction and error-prop state.
3. Helpers: one unit case per authored example, asserting its documented output or error.
4. Classes: one case per method and declared initialization or lifecycle state, including each declared error.
5. APIs: structural complete JSON response matches for each supported prop and error matrix row.

- Interaction, accessibility and console assertions stay inside the case that exercises them; they are never separate tests.
- Other functions and classes map each distinct behavior onto the matching form. Do not add a sixth shape.
- Projects without UI have no page or component cases; their modules use the helper, class and API forms.
- Do not auto-accept screenshot baselines. Review each changed image before its baseline is updated.
- Unsupported or missing coverage fails explicitly: a unit without its declared states, examples, methods or matrix rows is a reported gap. Never skip the case or cover it with another form.

## Stable-Case Bug Policy

- Do not write standalone bug regression tests. A reported bug strengthens the existing case of its form (its input, fixture, state or assertion) under the same registered title.
- Keep each form's case count fixed. Add or remove a case only when the contract explicitly changes a capability: a declared state, prop, example, method, lifecycle state, error or matrix row.
- A behavior with no existing case is a missing coverage category. Declare its capability in the contract first, then add one case of its form before the product repair.
- Keep registered case titles and identities stable; verification records bind to them.
