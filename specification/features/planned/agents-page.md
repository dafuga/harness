# Feature: Agents Page

## Overview

Open Agents from the Harness navigation to see how many registered agents are working and
their stated tasks, models, branches and worktrees. Use the existing activity roster and
heartbeat rules. Live observations describe the running repository, regardless of the
historical source revision selected in the explorer.

## Acceptance Criteria

- Agents is reachable from the shared navigation at branch and commit addresses.
- Fresh registered agents count as working; stale, ended and finished agents remain distinct.
- Each working agent shows its stated task, model and checkout. Unregistered agents are not inferred.
- Refresh reads the existing project activity API; visible pages refresh every fifteen seconds.
- Failed reads preserve the last reading and age it; unavailable or never-used tracking is unknown.
- The page and navigation work at desktop, tablet and mobile widths, with retained captures.

## Future Enhancements

- Agent creation and control remain outside this read-only roster.
