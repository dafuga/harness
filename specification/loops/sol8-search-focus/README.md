# Entity search focus

Item 41's current-code API images at `af1e1c9478` show two offset yellow outlines
around the search input at desktop, tablet and mobile. The results scope also
paints the placeholder project name.

The standard catalog checks query text, result selection, loading feedback and
keyboard guidance. It does not check the field's computed focus treatment. Global
host focus rules override the input's weaker local outline reset while the field
wrapper already paints its own outline.

The existing catalog now checks the focused input has no outline, border or shadow,
and its containing field has the visible focus outline. The assertion runs after
the canonical capture. The project fixture says Orders before the product pair is
frozen, preserving the pinned commit state. No case or viewport is added.

The matched red/green command selects the existing open state at all three
viewports. Full qualification retains every existing state and viewport, and checks
the unchanged search behavior in the affected host flows.

## Validation

- Red `82036765637e` at `ccbc98db49`: all three viewport cases fail on a second computed input outline.
- Intermediate `9fa7adca36` and `0f2a362907` fail the unchanged computed-width guard; their failure logs are retained externally. No passing verdict was recorded for them.
- Final `0ec48f071f` resets outline width explicitly. Matched green `2ff7ff2e4c08` passes the same three cases.
- Full catalog `886efa9708d5`: seven states at three viewports, 21 fetched API originals, all inspected. They show one outer focus indicator and Orders or pinned scope.
- Normal `989a1a331545` is attached. Catalog checks and Desktop search fit, scope, UI and workspace-search tests pass. The enclosing record remains partial/failed.
- Reports search/pieces/verdict failures repeat before the repair at `af1e1c9478`, baseline record `8971eba5d224` (six failures, fifteen passes). They remain outside this scoped field repair.
- Search unit tests pass 10/10; Reports Svelte and Desktop TypeScript/Svelte checks pass. Full repository verification remains pending with the documented baseline findings.
- Source and fresh per-state workload measurements are retained at the final implementation commit. No screenshot artifacts are committed.
