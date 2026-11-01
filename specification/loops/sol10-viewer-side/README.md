# Viewer comparison coverage

The existing `shared-primitives/compare-panes.test.ts` verifies side-bound labels with synthetic content. It did not mount EvidenceViewer with a parent-only pair. The viewer's `after || selected` fallback therefore substituted the Before capture into the default After view, including its build details.

Strengthen that existing case with complete, missing-selected and unusual in-memory arrays through the actual viewer. A missing After capture must show its gap, without the parent's image or build metadata. The standard catalog adds a missing-after state at desktop, tablet and mobile. Existing controls continue to cover Before, After, Compare, navigation and viewport changes.

The red assertion requires `No after screenshot is recorded for this state.` and rejects the parent's image and provenance in that view. Product repair must retain the unchanged test, fixture, assertion and command.
