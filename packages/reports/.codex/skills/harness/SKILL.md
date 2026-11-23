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

## UI Design Patterns

Read `harness info ui-design` before designing or changing a screen.

- One main piece per screen. A screen has one main UI piece (a list, a board, a form or a canvas). Everything else is a primary action above it or quiet status below it. Two main pieces need two screens, tabs or a dialog.
- Forms never sit inline on an overview. Create, edit, connect and settings forms open from a button in a dialog (the shared Modal) or on their own page. Mark overview screens with <!-- @harness-view overview -->; harness audit reports overview-inline-form for a form control or form component outside a dialog there.
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
