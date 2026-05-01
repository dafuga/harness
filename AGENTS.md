# AGENTS.md

This is a Harness CLI project. Treat Harness as the operating contract for every code change in this repository.

## Required Harness Workflow

- Read this file and `.codex/skills/harness/SKILL.md` before changing code.
- Use Harness generators for supported code shapes instead of hand-rolling new structure.
- Ask `bun run dev -- info <topic>` before adding unfamiliar code or choosing a scaffold shape.
- Add or update focused unit and E2E coverage for changes to audit rules, generators, or CLI behavior.
- Keep files small, focused, and aligned with the Harness rule catalog.
- Run `bun run check` before handing work back; it includes formatting, type checks, lint, tests, build, and `harness audit`.

## Code Rules

- Files should stay focused and under 220 lines unless a local audit baseline explicitly tracks existing debt.
- Functions should stay under 55 lines.
- Classes should stay under 120 lines.
- Methods should stay under 35 lines.
- Keep nesting at 4 levels or less.
- Prefer one class per file.
- Keep command modules thin; put orchestration in workflows and reusable logic in focused modules.
