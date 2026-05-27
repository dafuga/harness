# Feature: Harness Loop

## Overview

Harness provides a loop protocol that LLM agents can use to define, follow, and evidence
verifiable work. Harness itself does not call an LLM, prompt interactively, or enforce
human consultation. It gives agents static guidance to ask the human what the loop
should prove, then records loop state and an append-only trace as the agent works.

## Acceptance Criteria

- `harness loop create <name> --goal <text>` creates loop state and trace files under `specification/loops/<name>/`.
- `harness loop add <loop> <step> --title <text>` adds ordered verifiable steps.
- `harness loop complete <loop> <step> --evidence <text>` marks a step complete with evidence.
- `harness loop status <loop> [--json]` reports current state and trace location.
- `harness info loop` tells agents to ask the human for goals, success criteria, constraints, proof, and stopping conditions.
- Root and generated project agent instructions tell agents to use `harness loop` for non-trivial work.
- Loop files are audit-safe in generated Harness projects.

## Future Enhancements

- Add update/reopen commands if real usage shows agents need to revise loops after creation.
