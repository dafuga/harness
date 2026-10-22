# Feature: History Evidence Coverage

## Overview

Pages and visual components show their own retained screenshots in the catalog, detail,
relationships and history views. Repair the revisions already indexed by the local Harness
preview and require captures and applicable measurements for future revisions.

## Acceptance Criteria

- Inventory every indexed revision and active visual unit, reporting missing scenario states,
  image bytes, source observations and applicable runtime observations separately.
- Give each visible page and component required capture states at desktop, tablet and mobile
  sizes. Attribute a capture only to units actually rendered in that state.
- Keep nonvisual modules compact. Redirect-only or retired surfaces state their actual
  applicability; missing fixtures never count as an applicability exception.
- Capture from the exact committed build, wait for fonts and decoded images, retain original
  bytes and hashes in Git evidence, and show the capture's original source commit.
- Retain focused capture and measurement results independently of full verification. A partial
  evidence run must never establish a passing verification verdict or budget baseline.
- Reconstruct the ten revisions in the existing prepared index where their source and runtime
  can be reproduced. Preserve exact blockers for any remaining slot rather than borrowing an
  unrelated screen or fabricating a measurement.
- Show selected-revision source size and complexity. Record real representative latency and
  meaningful memory observations for executable behavior, accurately naming route/process scope.
- Reopen the delivered history, decode required images, exercise Pages, Components, Used In,
  detail and History views, and show fresh inspected desktop and mobile screenshots inline.
- Enforce the coverage rule in normal Harness verification so newly registered visual modules
  cannot silently reach the catalog without a capture path.

## Future Enhancements

- Reconstruct older Git revisions outside the currently indexed set only in a separately scoped run.
