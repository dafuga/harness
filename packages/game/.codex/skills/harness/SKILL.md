# Harness Project Discipline

Use this skill whenever you are planning, implementing, reviewing, or verifying code in this Harness Bun TypeScript library.

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
- Browser normal flows, including screenshot/video runs, must have no unexpected console.error or pageerror events. Use the shared browserTest fixture; watch extra contexts before navigation. Keep logs for expected errors and declare their exact messages and reasons in that test. For unexpected errors, prove a failing log assertion before repair, then rerun the same unchanged regression until the error disappears; preserve diagnostics and keep verification pending while errors remain.
- Shared browser fixtures must preserve lazy setup. When their dependencies change, prove API-only tests run with an unavailable browser executable alongside actual browser cases.

## UI Design Patterns

Read `harness info ui-design` before designing or changing a screen.

- One main piece per screen. A screen has one main UI piece (a list, a board, a form or a canvas). Everything else is a primary action above it or quiet status below it. Two main pieces need two screens, tabs or a dialog.
- Forms never sit inline on an overview. Create, edit, connect and settings forms open from a button in a dialog (the shared Modal) or on their own page. Mark overview screens with <!-- @harness-view overview -->; harness audit reports overview-inline-form for a form control or form component outside a dialog there. A search field inside a role="search" landmark only narrows the main piece and is allowed.
- Primary actions are buttons in one short row above the main piece. A screen has at most one filled primary button (harness audit reports overview-single-primary); the rest are secondary buttons. Labels are short verbs in sentence case, such as New project.
- Status is quiet. Connection, sync and account state is one short muted line or a small chip beside or below the main piece. Its details and settings open in a dialog; never stack full status panels on a landing screen.
- Group by job, in this order: primary actions, the main piece, quiet status. Keep to about three groups and let spacing, not borders or headings, separate them.
- Lists follow the approved project overview cards (n79x63): one card with a title and at most one quiet link in its header, rows with the name on the left and muted metadata on the right, hairline separators, and an empty-state line instead of a hidden card.
- A gate screen, such as Sign in with Google, has only its one primary action and one muted line. Nothing else is usable until it is passed.
- Use the shared design tokens and components: --hx-\* tokens, Modal, Select and BrandMark. No literal colours, touch targets of at least 44px, and no horizontal overflow at 390px wide.
- Prove it in a browser: capture every changed screen and every dialog open at desktop, tablet and phone widths, and look at the images before handing work back.

## Hard Limits

- Files: 220 lines.
- Functions: 55 lines.
- Classes: 120 lines.
- Methods: 35 lines.
- Nesting: 4 levels.
- Parameters: 4.
- Classes per file: 1.
