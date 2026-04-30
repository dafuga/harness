# Feature: Harness Code Rules

## Overview

Harness enforces strict code rules through ESLint, `harness audit`, generated project scaffolds, and static guidance for agents.

## Acceptance Criteria

- Lint fails for oversized files, functions, classes, methods, too many parameters, excessive nesting, excessive complexity, multiple classes per file, nested ternaries, and Manager class names.
- `harness audit` reports rule IDs for file, function, class, method, complexity, nesting, parameter, naming, and architecture violations.
- `harness audit` reports class-count violations with the same one-class-per-file threshold enforced by lint.
- Command modules stay thin and architecture imports flow in one direction.
- Generated app and lib projects include a `check` script that runs format checks, type checks, lint, tests, build, and Harness audit.
- Generated app and lib projects include ESLint config, local Harness rules, `lint`, `check`, and AGENTS.md threshold guidance.
- CLI E2E coverage includes bad-code fixtures that prove generated-project lint, generated-project check, and `harness audit .` fail on rule violations.
- `harness info code-rules` exposes the rule catalog.
- `harness audit` uses ecosystem adapters for app profiles (`typescript`, `svelte`, `sql`) and lib profiles (`typescript`, `cpp`, `python`, `shell`, `wasm`).
- `harness audit --coverage` reports covered adapters, ignored paths, and known file types that are outside the selected profile.

## Future Enhancements

- Replace line-based audit heuristics with AST parsing if Harness later adds a runtime parser dependency.
- Add Svelte component-specific visual and accessibility rules once component scaffolds become richer.
