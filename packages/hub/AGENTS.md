# AGENTS.md

This is a Harness SvelteKit app. Treat Harness as the operating contract for every code change in this project.

## Required Harness Workflow

- Read this file and the `.codex/skills/harness/SKILL.md` skill before changing code.
- Use Harness generators for supported code shapes instead of hand-rolling new structure.
- Ask `harness info <topic>` before adding unfamiliar code or choosing a scaffold shape.
- For non-trivial work, ask what the loop should prove, search templates, then create or continue a `harness loop`.
- Add or update a feature spec before implementation.
- Keep files small, focused, and aligned with `harness.audit.json` limits.
- Run `bun run check` before handing work back; it includes formatting, type checks, lint, tests, build, and `harness audit .`.
- Follow the [post-release gate](README.md#post-release-gate) before recording release success.

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

- Browser normal flows, including screenshot/video runs, must have no unexpected console.error or pageerror events. Use the shared browserTest fixture and watch extra contexts before navigation. Preserve logs for expected errors and declare their exact messages and reasons in that test. For unexpected errors, prove a failing log assertion before repair, then rerun the same unchanged regression until the error disappears.

## UI Design Patterns

Read `harness info ui-design` before designing or changing a screen.

- One main piece per screen. A screen has one main UI piece (a list, a board, a form or a canvas). Everything else is a primary action above it or quiet status below it. Two main pieces need two screens, tabs or a dialog.
- Forms never sit inline on an overview. Create, edit, connect and settings forms open from a button in a dialog (the shared Modal) or on their own page. Mark overview screens with <!-- @harness-view overview -->; harness audit reports overview-inline-form for a form control or form component outside a dialog there. A search field inside a role="search" landmark only narrows the main piece and is allowed.
- List cards never contain forms. Show one-line option chips with a small Recommended badge, and put explanations, text fields, selectors and confirmation steps in the item’s detail panel, sheet or dialog.
- Agent cards show status and an Open chat button. Open the conversation in a bottom-right overlay on desktop and a full-screen sheet on phone.
- Render explicit HTTP and HTTPS URLs in item text, questions, choices and notes as links. Open them in a new tab with rel="noopener noreferrer", allow long URLs to wrap, and keep links separate from item and choice buttons.
- Primary actions are buttons in one short row above the main piece. A screen has at most one filled primary button (harness audit reports overview-single-primary); the rest are secondary buttons. Labels are short verbs in sentence case, such as New project.
- Status is quiet. Connection, sync and account state is one short muted line or a small chip beside or below the main piece. Its details and settings open in a dialog; never stack full status panels on a landing screen.
- Group by job, in this order: primary actions, the main piece, quiet status. Keep to about three groups and let spacing, not borders or headings, separate them.
- Lists follow the approved project overview cards (n79x63): one card with a title and at most one quiet link in its header, rows with the name on the left and muted metadata on the right, hairline separators, and an empty-state line instead of a hidden card.
- A gate screen, such as Sign in with Google, has only its one primary action and one muted line. Nothing else is usable until it is passed.
- Use the shared design tokens and components: --hx-\* tokens, Modal, Select and BrandMark. No literal colours, touch targets of at least 44px, and no horizontal overflow at 390px wide.
- A floating button never covers content or another control; hide it while a panel it opens, or any side panel, is open, and pad the content by its height.
- Absence is not failure: "not recorded" or "not measured" is muted text; red is for a failed check only.
- Pickers use the shared list rows, never a native list box (`select[size]`) or the system highlight.
- One composer: modes always read Comment · Ask · Plan · Change, whichever subset a screen offers.
- A gate page has one heading.
- Prove it in a browser: capture every changed screen and every dialog open at desktop, tablet and phone widths, and look at the images before handing work back.

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
