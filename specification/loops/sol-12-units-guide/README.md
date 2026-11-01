# Unit state guidance and contract checks

Daniel approved two CLI capabilities: `harness units guide <id>` and
`harness units check-contract <id>|--all`. The existing units command matrix
checks indexing and contracts but has no state derivation, state-specific
committed-test attribution, or verified screenshot checklist. These new command
matrices cover that missing category without changing browser tests.

Guide states come from catalog/preview registries, scenario declarations, props
and contracts. Repo declarations are REQUIRED; inferred boundaries are GUESSES.
DONE requires a committed test and intact attached proof at every viewport.
The real proof reader must reject partial, stale and uncommitted coverage.

Run `harness units guide <id>`, write the test for NEXT, commit it, run
`harness verify run --priority agent-test --entity <id>`, and repeat the guide
until DONE. Run `harness units check-contract <id>` whenever writing or changing
a contract. Heuristics identify gaps for review, not exhaustive correctness.

Focused command: `bun x vitest run test/units-guide.test.ts test/units-check-contract.test.ts`.
The initial checkpoint fails because both CLI commands are absent. No Playwright,
remote laptop, shared preview, publication or push is part of this task.
