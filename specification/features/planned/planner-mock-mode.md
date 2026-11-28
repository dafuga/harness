---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Feature: Mock mode for costly app tests

## Overview

Harness planning prompts ask for the expected time and money for one real end-to-end app test. Teams can use that estimate to choose how to run their routine development tests.

## Acceptance Criteria

- A real test that costs money or takes more than about a minute calls for a **Mock mode first** task before feature work. Extend an existing mock mode when the app has one.
- The task covers one local or test switch, a tested production guard, mock adapters behind existing interfaces, deterministic success and failure fixtures, `MOCK` in logs and as a visible badge in apps with a UI, and an automated test proving zero paid calls in mock mode.
- The plan identifies routine tests and evidence runs that will use mock mode, a single real-path release check behind an explicit flag and spend cap, and fixture maintenance.
- Module-task and native Tracker launch briefs name the `mock-mode` skill. Long Docker briefs retain the rule and the completion instructions.
- A planner test exercises a costly app request through the planning entry point and checks that the step is saved in the plan. Fixture responses keep the test free of provider calls.

## Future Enhancements

None planned.
