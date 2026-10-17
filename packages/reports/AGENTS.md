# AGENTS.md

This is a Harness SvelteKit app. Treat Harness as the operating contract for every code change in this project.

## Required Harness Workflow

- Read this file and the `.codex/skills/harness/SKILL.md` skill before changing code.
- Use Harness generators for supported code shapes instead of hand-rolling new structure.
- Ask `harness info <topic>` before adding unfamiliar code or choosing a scaffold shape.
- For non-trivial work, ask what the loop should prove, search templates, then create or continue a `harness loop`.
- Add or update a feature spec before implementation.
- Keep files small, focused, and aligned with `harness.audit.json` limits.
- Run `bun run check` before handing work back; it includes formatting, type checks, lint, tests, build, and `bun run audit`.
- Real report commands use the configured private R2 storage. Never pass `PROJECT_REPORTS_ASSET_STORAGE=local` for user reports; that opt-out is restricted to isolated temporary test stores. Backfill existing local media with `report sync-storage`, and verify cloud bytes before claiming uploads.
- Report storage expires after 30 days from report creation. Use `report cleanup --dry-run` before changing retention scope, preserve failed-deletion metadata, and never clean application source files outside the report store.

## Concise Writing

- A reason says what changed in this unit in at most 30 words and 200 characters. Each simplification or performance attempt has at most 15 words and 140 characters. `harness explain add` refuses more.
- These are the limits of `"writing": 2` in `harness.verify.json`. A revision that declares `"writing": 1` keeps 20 words an attempt. A reason is held to the version of the revision it explains, never to one read from its date.
- A commit subject has at most 72 characters and starts with `feat:`, `fix:`, `chore:` or `cleanup:`. An optional body, trailers included, has at most 60 words and 400 characters.
- `harness hooks install` adds a commit-msg hook that refuses a longer message. Verification measures the stored messages again, so `--no-verify` does not pass.
- Explain the specific change, the actual attempt and its result. Do not repeat an inventory of the repository.
- The limits bound notes and commit messages only. They never shorten tests, contracts, assertions, traces, transcripts or evidence.
- `harness info hooks` and `harness info explain` have the rules.

- Browser normal flows, including screenshot/video runs, must have no unexpected console.error or pageerror events. Use the shared browserTest fixture and watch extra contexts before navigation. Preserve logs for expected errors and declare their exact messages and reasons in that test. For unexpected errors, prove a failing log assertion before repair, then rerun the same unchanged regression until the error disappears.

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
