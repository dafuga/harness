# AGENTS.md

This is a Harness CLI project. Treat Harness as the operating contract for every code change in this repository.

## Required Harness Workflow

- Read this file and `.codex/skills/harness/SKILL.md` before changing code.
- Use `.codex/skills/harness-jev-clean-code/SKILL.md` for Jev findings and manual
  Clean Code reviews, and `.codex/skills/harness-jev-sessions/SKILL.md` for automatic
  session-check setup, trust and troubleshooting.
- Use Harness generators for supported code shapes instead of hand-rolling new structure.
- Ask `bun run dev -- info <topic>` before adding unfamiliar code or choosing a scaffold shape.
- For non-trivial work, ask what the loop should prove, search templates, then create or continue a `harness loop`.
- Add or update focused unit and E2E coverage for changes to audit rules, generators, or CLI behavior.
- Keep files small, focused, and aligned with `harness.audit.json` limits.
- Run `bun run check` before handing work back; it includes formatting, type checks, lint, tests, build, and `harness audit`.

## Bug and Regression Loops

- Use `harness loop create <name> --from bug-fix --goal <text>` for bug repairs: reproduce with a failing test before implementation, then repeat repair and the same unchanged test until it passes.
- Use `--from regression-prevention` for regressions requiring durable prevention: identify the root cause, propose the repair and guard, implement both, and include the guard in normal project verification.
- Prove the guard rejects reintroducing the original failure in an isolated fixture or temporary workspace; restore the repair and prove the guard passes.
- Record failing and passing commands, assertions, and results as step evidence. Keep green/guard/verification steps pending while proof fails; the agent retries repairs and checks. Harness does not launch an AI repair runner or automatically complete steps.
- For affected UI paths, exercise the browser flow and capture fresh screenshots, then inspect the images before recording proof. Report blockers without claiming completion.

## Code Rules

- Files should stay focused and under 220 lines unless a local audit baseline explicitly tracks existing debt.
- Functions should stay under 55 lines.
- Classes should stay under 120 lines.
- Methods should stay under 35 lines.
- Keep nesting at 4 levels or less.
- Prefer one class per file.
- Keep command modules thin; put orchestration in workflows and reusable logic in focused modules.
