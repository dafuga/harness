# Feature: JEV response checking

## Overview

Harness assesses whether supplied LLM answer text satisfies a user request using
JEV. A standalone command can be used as an existing loop command evaluator.
External actions and factual claims are not independently verified.

## Acceptance Criteria

- Required UTF-8 request and response files; optional context and JSON criteria.
- Standard task fulfillment, completeness, constraints, and relevance checks,
  plus individually evaluated caller-defined criteria with unique IDs.
- Typed verdicts, confidence, probabilities, fixed guidance, input hashes,
  rubric/model identity, and token usage; no raw input echoed in reports.
- Advisory completion exits 0; a gate requires every check to confidently meet
  its criterion and exits 1 for violations or uncertainty. Incomplete execution
  exits 2. Dry runs validate and preview offline with exit 0.
- Default pinned model jev-1.13.0, threshold 0.85, and project-owned
  HARNESS_JEV_API_KEY. No cache or implicit calls during normal audits.
- Reject oversized serialized inputs above 24000 UTF-8 bytes without truncation.
  Blank answers deterministically fail fulfillment without a provider call.
- Preserve existing Clean Code behavior and loop schema.
- Unit, CLI E2E, loop integration, and full bun run check pass. Live calibration
  remains opt-in and requires a dedicated Harness credential.

## Future Enhancements

- Independent artifact and tool-result verification is outside this feature.
