# Feature: Meaningful Config Controls

## Overview

Configs lists important controls people running or developing Harness need to change. Exported implementation data is not automatically configuration. Preserve the two-column Variable / Value presentation.

## Acceptance Criteria

- Review the existing 11 config units. Keep eight relay capacity and request-limit controls public; keep style documentation, schemas, patch fingerprints and build/test machinery internal without deleting their source or history.
- Each public control declares its exact source and value name, audience and purpose. Registry checks reject missing, duplicate, unowned or unresolved controls. Re-indexing preserves authored declarations.
- Read selected values from committed syntax without executing code. Omit sibling implementation values. Historical revisions without declarations retain their original metadata rather than borrowing current settings.
- New config scaffolds start internal with an empty object, without invented name or enabled fields. Existing import and SDK export addresses remain stable.
- Generated tenant AGENTS and Harness skills, repository guidance and the installed Harness skill teach the same concrete tuning-need review.
- Run basic focused checks and manually inspect the delivered Configs page on the shared preview. Broad CLI/native suites remain deferred as Daniel requested; resource-admission blockers stay explicit.

## Future Enhancements

- Additional public controls require the same audience, purpose and source review when a real need arises.
