# Feature: Performance Metric Diff

## Overview

On a selected commit's Pages entity overview, make the Performance profile explain how the recorded
metrics changed from the commit's first parent. Keep the comparison beside the screenshots and
behavior change so a reader can see both the visual and measured effects of that commit.

## Acceptance Criteria

- A selected Pages entity overview shows Before, After, and signed Change values for its compact
  Performance profile metrics: Source size, Complexity, Latency, and Memory.
- Selected commit overviews for other entity types keep their existing single-revision profile.
- The comparison identifies the first-parent commit and the selected commit by short hash.
- Timing and memory deltas are shown only when workload, target, profile, and unit match. Otherwise
  both values remain visible and the row says why it cannot be compared.
- Missing measurements are shown as Not measured and never treated as zero.
- Branch-tip overviews keep their current single-value Performance profile.
- Browser coverage proves the selected-commit comparison at desktop, tablet, and phone widths and
  captures the same diff view before and after implementation.
