# Feature: Concise page details

After squash landing, focused screenshots may be retained only when the complete
Git source tree is identical to the captured tree. Keep the capture's original
commit, build and focused status; it grants no new verification verdict. Different
trees, units, states and viewport identities cannot borrow those images. The
delivered main index must resolve and decode the affected previews after landing.

Pages open with their name, role and verification mark. The screenshot panel keeps a concise
heading, viewport buttons and the image. Overview begins with the page's short registered purpose;
route details remain in Contract. Scenario
and state selection belong in States; the overview has no commit-change action or repeated prose.

## Acceptance Criteria

- Page headers omit purpose prose and app-route metadata; other entity headers retain them.
- Page Overview shows its registered description before screenshot evidence, at current and selected commits.
- Screenshot overviews omit Scenario and State dropdowns, repeated explanatory text and View commit changes.
- Screenshot comparisons show Before/After with commit hashes and omit Parent commit and Selected commit badges.
- A declared page preview selects its own scenario and state; viewport buttons keep that identity.
- Validated unchanged captures remain visible with their original commit; rejected or missing media remains a gap.
- Pages expose Overview, Contract, Uses, States, History and Source. Other entity types retain Used In.
- Pages never render a Used In panel. Existing page Used In links open Overview with branch and commit preserved.
- Standardized entity-preview coverage proves desktop, tablet and mobile behavior before and after the repair.
- Size measurements share the Performance profile card in overviews and details; no standalone Size card remains.
- Source size, emitted targets, complexity, missing-measurement notes and workload profiles retain their values and semantics.
- The overview uses normal stack spacing above Performance profile; label/value measurement rows share equal heights at all three widths.
- A unit without a compiled output target omits the output-size placeholder. Real native/Wasm output sizes and unavailable-target reasons remain visible.

## Coverage gap

The existing visual-overview tests proved image placement but did not constrain overview copy or
controls. The inherited-capture test covered an invalid origin, but not validated unchanged proof.
Strengthen those same tests and capture every page tab; do not add a separate bug-specific suite.

Measurement summary coverage previously required separate Size and Performance profile cards.
The same overview, details and visual-overview checks now require one full-width profile containing
all size rows at current and selected commits across desktop, tablet and mobile widths.

The usage and tab tests previously required Used In for pages. The same standardized scenarios
now distinguish pages from reusable entities and exercise retired links in both revision modes.

Overview coverage now requires the page purpose above screenshots instead of omitting it entirely.
The same page scenarios retain a concise header and keep overview copy out of other tabs.

The same visual-overview checks now measure the gap above the profile and compare row heights.
Formatter and details coverage distinguish no declared output from a declared but unavailable build.

- All entity kinds show source measurements from the selected committed tree, even when an older prepared index or record lacks them. Missing placeholders cannot override current source observations.
- Changed executable units record representative timing and accurately scoped memory in normal evidence runs, with the tested revision, workload, target, profile and method. Missing applicable captures remain a verification gap.

### Durable capture delivery and concise metrics

Focused page checks retain decoded screenshot bytes in Harness's sealed Git evidence before cleanup. Rebuilt history resolves only images of the selected unit, state, viewport and exact served revision. Focused images stay labelled separately from full verification. Each required desktop, tablet and mobile capture must reopen successfully before handoff or merge, including both sides of a comparison. Standard loop CLI coverage removes a stored screenshot and proves validation rejects it; standard entity tests reject another unit's image.

Overview presents Source size, Complexity, Latency and Memory as equal-height rows with one value each. Its selected latency and memory share one workload, execution target and profile. Detailed measurement tables remain in Details. No averaging or relabelling whole-page heap as isolated memory is permitted.

The earlier regression escaped because loop tests covered retained logs and timings while browser tests required the verbose table. Those same standard cases now require retained pixels, rebuilds and scalar rows at three widths. The generated tenant instructions, repository instructions and reusable Harness skill all enforce this delivery gate.
