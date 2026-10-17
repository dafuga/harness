# Feature: Regression Loops

## Overview

Provide agent-guided bug repair and regression prevention templates with ordered,
recorded proof. Harness supplies guidance and evaluators; the agent performs repairs
and retries, leaving verification pending while proof fails.

## Acceptance Criteria

- `bug-fix` and its `fix` alias order expected behavior, coverage-gap diagnosis, strengthened failing existing standardized test, repair, unchanged passing test, and project verification.
- Diagnose why existing tests missed the reported bug before changing product code. Name the responsible scenario, fixture, lifecycle, input or assertion gap.
- Strengthen existing shared tests, fixtures and scenario coverage in Harness's normal format; do not add a one-off bug-specific test. If no standard covers the behavior, explain the missing coverage category and extend reusable coverage.
- New repair loops refuse completing a step before its predecessors. Previously recorded loops retain their recorded steps.
- The app's Plan and Change agents receive the same coverage-first policy as generated framework guidance; Plan remains read-only and Change still requires approval.
- `regression-prevention` additionally requires root cause, a proposed repair and guard, and proof that reintroducing the failure makes the guard fail.
- The prevention guard is included in the project's normal verification command.
- Both templates expose `bun run check` at verification and support project extensions.
- Existing loop instances remain unchanged; newly resolved repair templates use coverage-first ordering.
- Local/generated guidance and `info loop` specify selection, retries, evidence, and UI verification.
- Unit and temporary-workspace CLI tests cover discovery, ordering, evidence, and failed-to-passing evaluation with pending verification.

## Boundaries

No automatic AI runner, retry engine, publication, or deployment. Guards prevent the
identified failure within their tested scope, not every possible future regression.
