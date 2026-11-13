---
status: implemented
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Feature: Harness Loop Driven Development

## Overview

Harness provides a loop driven development protocol that agents can use to define,
inherit, follow, evaluate, and evidence verifiable work. Harness itself does not call
an LLM, but it ships loop templates and evaluator commands so agents can turn human
intent into traceable work with repeatable proof.

## Acceptance Criteria

- `harness loop create <name> --goal <text>` creates loop state and trace files under `specification/loops/<name>/`.
- `harness loop create <name> --from <template> --goal <text>` instantiates inherited loop steps and evaluators.
- `harness loop add <loop> <step> --title <text>` adds ordered verifiable steps.
- `harness loop complete <loop> <step> --evidence <text>` marks a step complete with evidence.
- `harness loop status <loop> [--json]` reports current state and trace location.
- `harness loop search [query] [--json]` finds built-in templates, project templates, and loop instances.
- `harness loop next <loop> [--json]` reports the next pending step and related evaluator.
- `harness loop evaluate <loop> [--json]` runs evaluator commands and returns a failing exit code when proof fails.
- Project templates in `specification/loop-templates/*.json` can extend one parent loop template.
- Built-in templates include `feature`, `fix`, `bug-fix`, `regression-prevention`, `refactor`, and `visual-change`.
- `harness info loop` tells agents to use loop driven development.
- Root and generated project agent instructions tell agents to use `harness loop` for non-trivial work.
- Loop files are audit-safe in generated Harness projects.

## Future Enhancements

- Add update/reopen commands if real usage shows agents need to revise loops after creation.
- Add richer evaluator types if command-based proof is not enough.

### Loop age and abandoned work

`harness loop list --stale 30` lists open loops at least 30 days old. Unknown ages and unreadable loop files are reported separately. `harness loop status <name>` includes age and pending-step count.

Close work that was deliberately abandoned with `harness loop close <name> --abandoned --reason "<reason>"`. Closure records the reason and time; it preserves pending steps and existing trace evidence. It does not claim the work passed verification. Closed-loop archival remains separate from this command so references and history remain readable.
