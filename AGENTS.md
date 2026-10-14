# AGENTS.md

This is a Harness CLI project. Treat Harness as the operating contract for every code change in this repository.

## Required Harness Workflow

- Read this file and `.codex/skills/harness/SKILL.md` before changing code.
- Use Harness generators for supported code shapes instead of hand-rolling new structure.
- Ask `bun run dev -- info <topic>` before adding unfamiliar code or choosing a scaffold shape.
- For non-trivial work, ask what the loop should prove, search templates, then create or continue a `harness loop`.
- Add or update focused unit and E2E coverage for changes to audit rules, generators, or CLI behavior.
- When adding shared UI imports, declare their source reference bindings and run `test/shared-select-impact.test.ts`, `test/shared-search-impact.test.ts` and `test/shared-alias-index.test.ts` before handing off the component.
- Keep files small, focused, and aligned with `harness.audit.json` limits.
- Run `bun run check` before handing work back; it includes formatting, type checks, lint, tests, build, and `harness audit`.
- An agent that works here says so: `bun run dev -- activity register --label <who> --task <what> --units <ids>`, then `activity heartbeat <id>` as it goes (or `HARNESS_AGENT_ID=<id>` on its Harness commands) and `activity finish <id>` at the end. `bun run dev -- info activity` has the rules.

## Bug and Regression Loops

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

## Code Rules

- Files should stay focused and under 220 lines unless a local audit baseline explicitly tracks existing debt.
- Functions should stay under 55 lines.
- Classes should stay under 120 lines.
- Methods should stay under 35 lines.
- Keep nesting at 4 levels or less.
- Prefer one class per file.
- Keep command modules thin; put orchestration in workflows and reusable logic in focused modules.
