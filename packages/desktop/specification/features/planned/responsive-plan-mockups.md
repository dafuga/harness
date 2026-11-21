---
status: planned
shippedIn: null
unitIds:
  - desktop.service.plan-run
  - desktop.function.plan-design
  - desktop.component.design-panel
  - desktop.function.change-execute
owner: null
reviewedAt: null
---

# Feature: Responsive Plan Mockups

Sonnet prepares responsive HTML and CSS mockups for pages, layouts, and components using the selected revision's source and design system. Playwright renders phone (390px), tablet (834px), laptop (1440px), and wide (1920px) captures headlessly. Existing units show the current design beside the proposal. A new unit shows when it has no current implementation.

In the same Plan conversation, Haiku handles requested additional widths and states, and renders the saved design again on request. The existing widths and states remain available. An open proposal appears on the affected entity's Overview and is also available in Designs, with selectable widths, states, and options.

Approval binds the immutable source, selected option's screenshots, version, and contract. Change receives the approved HTML and CSS and the approved visual references. A later design requires approval of its own. Rendering errors and cancellations leave no partial design version. Headless behavior plans keep their existing notes workflow.

## Verification

- Exercise creation, revisions, cancellation, and provider or renderer failures through the Plan service.
- Verify snapshot dimensions, source provenance, and the exact approval-to-Change handoff with a deterministic project fixture.
- Exercise Overview and Designs in the desktop browser matrix, with inspected before and after captures.
