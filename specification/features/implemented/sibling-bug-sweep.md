---
status: implemented
shippedIn: null
unitIds:
  [
    command.loop,
    function.development-tooling-sibling-bug-sweep,
    function.agents-providers-evaluate-agent
  ]
owner: dafuga
reviewedAt: 2026-11-20
---

# Feature: Sibling Bug Sweep

A bug report starts a search for the same root cause at a committed revision. An evaluator describes the reusable bug class and supplies literal and syntax search patterns. Harness scans tracked source, sends bounded source context for semantic review, and ranks sites with evidence and a review status. Search and review scope are recorded in the report.

## Acceptance criteria

- A report can run at discovery with `harness loop siblings --report <text> --report-only` against a pinned revision.
- A bug-fix loop records its class and report. Confirmed candidates can be dispatched for isolated repair when the caller enables repairs and provides the test command.
- Each repair starts at the reported revision. Harness records a committed failing assertion before product changes, runs the same tests and command on the repair commit, and obtains an independent evaluator verdict before retaining the result as accepted.
- Review of a later change uses classes committed on its base and reports matches on changed code. Class files and reports identify their source revision.
- The BuildFlexity pilot is read-only and reports overlap with the separately produced manual audit at a shared baseline.
