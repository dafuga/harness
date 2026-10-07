# Feature: Regression Loops

## Overview

Provide agent-guided bug repair and regression prevention templates with ordered,
recorded proof. Harness supplies guidance and evaluators; the agent performs repairs
and retries, leaving verification pending while proof fails.

## Acceptance Criteria

- `bug-fix` orders expected behavior, failing regression, repair, unchanged passing regression, and project verification.
- `regression-prevention` additionally requires root cause, a proposed repair and guard, and proof that reintroducing the failure makes the guard fail.
- The prevention guard is included in the project's normal verification command.
- Both templates expose `bun run check` at verification and support project extensions.
- Existing templates and loop instances remain unchanged.
- Local/generated guidance and `info loop` specify selection, retries, evidence, and UI verification.
- Unit and temporary-workspace CLI tests cover discovery, ordering, evidence, and failed-to-passing evaluation with pending verification.

## Boundaries

No automatic AI runner, retry engine, publication, or deployment. Guards prevent the
identified failure within their tested scope, not every possible future regression.
