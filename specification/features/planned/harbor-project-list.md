---
status: planned
shippedIn: null
unitIds:
  - command.projects-sessions-project-list
  - module.projects
  - reports.module.projects-sessions-project-overview-read-project-overview
owner: null
reviewedAt: null
---

# Harbor project list

`harness projects list --json` returns schema 1 with status `ready`, `empty` or `unavailable`.
Every ready row has a stable project ID and display title, the canonical card state, and counts for
open, in-progress, blocked and completed tracker items. The SDK's local reader returns the same
data. It uses the fixed read-only local tracker operations and filtering in Project Overview.

The project label is the existing tracker agent name. Labels must be plain names and pass the
canonical reader's privacy filter. Per-item content, machine names, account data, provider data
and session credentials do not appear in the result. Hosted consumers still need the Hub's
owner-authorized endpoint and session.
