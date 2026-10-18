# Feature: Minimal Page Cards

## Outcome

Page catalogs show each page title and its screenshot, without descriptions, dependency counts,
verification marks or a separate open button. The title and screenshot form one keyboard-accessible
link to the page at the selected branch and commit. Component cards keep their existing content.

## Screenshot identity

A recorded screenshot must belong to the named page and selected revision. Retain capture origin
in hover/accessibility information. Missing, corrupt, foreign or rejected evidence stays an explicit
gap. Planned designs remain labeled as designs and do not stand in for runtime screenshots.

## Coverage gap and proof

The existing Reports entity-preview-actions and shared-renderer catalog-previews cases asserted a
small open icon, but never asserted the complete visible card contents. Extend those cases across
desktop, tablet and mobile, including hosted/local and historical/missing evidence. Commit the
strengthened failing tests before the repair, then rerun unchanged at the fix commit.

At the reported branch tip 269b85ca, the history cache contains no attached verification record.
Agent settings declares a capture hook, but no run is attached for the catalog to read. Run the
existing browser scenarios against the final committed source and attach their sealed captures.
Keep broader unrun verification failures explicit; do not claim native acceptance or full proof.

## Page-state binding

A page preview must be named by its scenario state. The shared workspace reads the explicit preview
binding, while the Reports catalog derives the state from the committed scenario's unit membership.
The committed preview guard must exercise real page declarations, not only ideal synthetic inputs.
Agent settings must select its Settings screenshot, rather than its scenario's compact agent panel.
