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

- PDF and ZIP export profiles execute the real Python scripts through the shared Harness child-process capture in the standard export test; keep registered-file and output assertions. Retention installation tests write only within a temporary directory, mock scheduler calls, and label that boundary as partial coverage. Never install a live LaunchAgent to obtain test evidence.
- The standard page-benchmark protocol matrix checks actual metric names against declared module targets, canonical helper route ownership, stale builds, soft navigation, unavailable values and inspector cleanup. Protocol doubles stay in a removed temporary sink; actual task profiles come from fresh browser runs of the committed build. Preserve original archived captures when repairing collector bindings.

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

Profile a route only under its explicitly exercised framework owner. Do not copy whole-page navigation or heap samples to a fixed list of shared modules. Each additional subject needs its own actual workload and declared boundary; source imports alone do not prove execution.
