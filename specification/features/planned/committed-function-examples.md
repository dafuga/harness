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
