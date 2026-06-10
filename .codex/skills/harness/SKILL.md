# Harness Project Discipline

Use this skill whenever you are planning, implementing, reviewing, or verifying code in this Harness CLI project.

## Operating Rules

1. Treat `harness info`, Harness generators, and `harness audit` as mandatory project controls.
2. Run `bun run dev -- info <topic>` or `bun run dev -- info scaffolds --json` before creating unfamiliar code shapes.
3. For non-trivial work, ask what the loop should prove, search templates, then create or continue a `harness loop`.
4. Prefer adding or updating generators over manually duplicating scaffold behavior.
5. Add or update unit and temp-workspace E2E tests for generator, audit, and CLI behavior changes.
6. Keep generated and hand-edited files inside the configured Harness rule limits.
7. Verify with `bun run check` before handing work back.

## Hard Limits

- Files: 220 lines.
- Functions: 55 lines.
- Classes: 120 lines.
- Methods: 35 lines.
- Nesting: 4 levels.
- Parameters: 4.
- Classes per file: 1.
