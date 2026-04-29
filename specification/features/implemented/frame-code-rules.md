# Feature: Frame Code Rules

## Overview

Frame enforces strict code rules through ESLint, `frame audit`, generated project scaffolds, and static guidance for agents.

## Acceptance Criteria

- Lint fails for oversized files, functions, classes, methods, too many parameters, excessive nesting, excessive complexity, multiple classes per file, nested ternaries, and Manager class names.
- `frame audit` reports rule IDs for file, function, class, method, complexity, nesting, parameter, naming, and architecture violations.
- Command modules stay thin and architecture imports flow in one direction.
- Generated app and lib projects include ESLint config, local Frame rules, `lint`, `verify`, and AGENTS.md threshold guidance.
- `frame info code-rules` exposes the rule catalog.

## Future Enhancements

- Replace line-based audit heuristics with AST parsing if Frame later adds a runtime parser dependency.
- Add Svelte component-specific visual and accessibility rules once component scaffolds become richer.
