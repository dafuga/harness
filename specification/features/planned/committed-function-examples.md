# Feature: Committed function examples

A function's Examples tab explains uses with named input → expected output cases. The content is documentation committed to the same Git tree as the function; it does not depend on a verification run.

## Acceptance criteria

- Functions expose Examples; existing Tests URLs keep their revision and open Examples. Visual entities keep States, and service verification remains available.
- Each documented use has a short name, optional explanation, input and expected output or expected error. False, zero, null and empty values are retained; content is escaped.
- A unit may point to a repository-relative Markdown document. Its fenced `harness-examples` JSON block names that exact unit. Missing, malformed or foreign documents show a gap, never cases from another revision.
- The prebuilt history reads the document from the selected commit. Changes to documentation change the unit version; old commits never borrow current examples. The shared workspace uses the same reader and display.
- The complete committed Markdown remains readable behind a disclosure. Contract fields, descriptions and examples remain in committed unit manifests. Measurements and observed test results remain immutable evidence, distinct from authored documentation.
- Examples lead the tab. Recorded test results and verification diagnostics remain available in a clearly named disclosure and never grant a passing verdict to authored examples.
- Activity freshness documents fresh, individually expired and old roster uses. Normal tests execute those documented inputs and compare their expected projections.
- Desktop, tablet and phone layouts fit without page overflow. No native Electron or iOS testing is needed for this shared browser change.

## Coverage diagnosis

The standardized `entity-preview-test-cases.spec.ts` checks recorded service inputs and outputs, but no committed usage documentation or function Examples tab. Extend its synthetic-history fixture and viewport matrix to cover current and historical examples, missing documentation, safe values and separate verification. The manifest validator must also admit safe document paths and reject traversal. Preserve failing-test and fix commits separately.

## Verification

- Failing checkpoint: `756510da`. Fix: `a776a015`. The unchanged command and frozen inputs failed before the repair and passed after it; both observations are retained in Harness evidence.
- Reports: 577 unit checks and 65 responsive browser checks passed. Formatting, Svelte types, lint, builds and audit passed; the audit was rerun after removing an extra blank line at its file limit.
- Hosted web: full `bun run check` passed, including 461 unit checks, build and audit.
- Shared browser renderer: 22 cases passed across local and hosted modes. Local Git-reader checks prove historical docs ignore uncommitted edits; hosted checks exercise the source cache.
- Root types, lint, audit, manifest validation, route checks and shared-import impact checks passed.
- Native app testing and the aggregate check that includes native work remain paused at the user's request. No native app was launched or rebuilt.

The live integration check also found that registry re-indexing dropped the documentation pointer. The standardized metadata-preservation test now covers that path: failing commit `f5ae4225`, passing repair `b9365207`. Both records retain the same tests and command. Re-indexing now preserves the pointer and remains idempotent.
