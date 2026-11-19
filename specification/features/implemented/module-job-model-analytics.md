---
status: implemented
---

# Module-job model analytics

Harness records each module worker execution and its review outcome in the existing
local analytics store. The [version 1 run record](../../loops/module-job-model-analytics/run-record-v1.schema.json) is shared with Tracker item 6qrmt6.
The record includes a stable task and attempt identity, model, effort, tokens,
wall time, estimated and measured difficulty, review or failure cause, and
API-equivalent cost with the price card version. Billing and credit fields remain
unknown unless the producer has measured them.

## Acceptance criteria

- A committed module task may specify a `taskType` and `estimatedDifficulty`.
  New tasks estimate difficulty from the assigned file count when the caller
  omits it. Historical values that were never captured remain unknown.
- Retried and escalated executions retain their own identity, usage, cost, and
  outcome. A review is joined to the execution's attempt, including when a
  date filter excludes the review's timestamp. Confirmed abandoned claims
  have a record with unknown provider usage and elapsed time.
- Reviewers may classify an incomplete submission with `--cause`. The exported
  records contain only enumerated causes, with no review feedback, prompts,
  source contents, or provider error strings.
- `harness analytics tasks --project PATH --json` retains the previous
  summary and exposes `runRecords`, `byModelTaskDifficulty` and
  `recommendations`. Recommendations use comparable first attempts and
  can be passed to `harness task add` as explicit model and effort choices.
- A disposable CLI fixture covers a review bounce, a repair, acceptance,
  filtering, and repeated reconciliation. The project verification runs
  without invoking paid providers.

## Data and pricing

Harness builds run records from its existing queue and analytics event store. A
recovered claim ends at the recovery observation and has unknown provider
duration. Historical records without enough facts retain nulls. Upgrade older
workers before adding fields to a queue they also read because their strict
validators predate the additions.

The standard-global price card is shared with Tracker revision `35dc469`.
Known rates follow the [OpenAI pricing documentation](https://developers.openai.com/api/docs/pricing)
and [Claude pricing documentation](https://platform.claude.com/docs/en/about-claude/pricing).
Historical quotes retain their original rate card. Price ranges account for
unknown cache writes and differences in request length. The estimate covers
standard token rates. CLI-reported costs carry their own provenance.
