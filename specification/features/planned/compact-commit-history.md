# Compact commit history

History lists Date, Commit, Behavior change, Size, Complexity and Latency. Commit hashes open the entity at that revision, retaining helper identity. Dates use relative words and expose the exact date on hover. Remove the selected-change panel, attempts column, evidence column and redundant revision links. Full long reasons remain available inline in their row.

Source measurements from the exact revision fill missing size and complexity without requiring a verification record. Recorded latency stays tied to its revision, workload and machine profile; unavailable latency stays explicit and never borrows a later result. Rebuild the shown historical source measurements without rewriting commits.

Existing standard history tests required the older panel and duplicate controls. Extend these cases for the compact schema, navigation, date titles and source-only measurements. Keep long-note disclosures and historical scoping covered.

## Changed units

All explorer links use the main project context shown in the request. The implementation is committed separately on `dafuga/github-source-links`.

- [History](http://127.0.0.1:5688/harness/branch/main/components/reports.component.harness-entity-history) ([unit history](http://127.0.0.1:5688/harness/branch/main/components/reports.component.harness-entity-history/history)): removed selected-change state and rendering, attempt/evidence/action columns.
- [Commit row](http://127.0.0.1:5688/harness/branch/main/components/reports.component.harness-entity-history-row) ([unit history](http://127.0.0.1:5688/harness/branch/main/components/reports.component.harness-entity-history-row/history)): the hash navigates directly, dates expose exact timestamps, source measures fill missing figures, and long reasons stay in an inline disclosure.
- [History data](http://127.0.0.1:5688/harness/branch/main/functions/reports.function.explorer-history) ([unit history](http://127.0.0.1:5688/harness/branch/main/functions/reports.function.explorer-history/history)): reads static observations belonging to the exact revision.
- [Latency series](http://127.0.0.1:5688/harness/branch/main/functions/reports.function.entity-history) ([unit history](http://127.0.0.1:5688/harness/branch/main/functions/reports.function.entity-history/history)): admits time-valued series to the latency column, preserving profiles.
- [Date formatter](http://127.0.0.1:5688/harness/branch/main/functions/reports.function.report-display) ([unit history](http://127.0.0.1:5688/harness/branch/main/functions/reports.function.report-display/history)): adds numeric relative wording while preserving existing callers' default wording.
- [Explorer model](http://127.0.0.1:5688/harness/branch/main/models/reports.model.explorer-types) ([unit history](http://127.0.0.1:5688/harness/branch/main/models/reports.model.explorer-types/history)): carries optional historical source size and complexity.
- `reports.style.entity-history` has no explorer page. Its source is `packages/reports/src/lib/styles/entity-history.css`; comments now describe the six-column table.

## Historical recovery

The cached revision details were rebuilt from their actual Git source using SourceImpactService. At `4af079742786007d5c544507a3d9476427062dcb` the owning module has 1,186 source bytes and complexity 11; at `dea2a61576e8be4fb70a4126b942d0c0fd165683` it has 1,164 bytes and complexity 11. These are module observations, as the helper detail page explains. No source commit or verification outcome was rewritten.

Neither revision contains a recorded latency benchmark for this module. The UI reports Not measured. Source analysis cannot reconstruct runtime latency; a future retrospective benchmark would be a new observation, not an original historical result.

## Regression proof

The strengthened standardized tests fail at `70868838` and pass unchanged at `4cf3c2c6`, using the same command, fixtures and runtime environment. Harness stores both checkpoints in its existing append-only evidence history. A later shared-screen structure assertion was aligned with the intentional removal of EntityChange; it now explicitly checks that the removed panel is absent.

## Verification outcome

The full reports check passes: formatting, Svelte types, lint, 609 unit tests, production bundles and app audit. Four standard browser cases pass: profile-scoped latency and direct commit navigation, plus long-note disclosures at desktop, tablet and mobile sizes. Root types, lint, audit, registry validation and all 13 shared-component impact cases pass.

The same standard browser checkpoint was captured against the committed pre-repair snapshot and the repaired implementation. Both screenshots were inspected: the original has duplicate actions and a selected-change panel; the repair has the six-column table and direct commit links. The live formatDuration History page was also inspected after recovering both historical static observations; commit navigation preserves the helper, dates expose full timestamps, and the browser has no new errors. Screenshot files remain outside Git.

The root `bun run check` is not claimed as passing: its Electron checks remain excluded by Daniel's instruction. Full repository verification and main integration remain pending. The UI repair itself is committed at `4cf3c2c6`.

## Lifecycle label correction

Commit rows omit Added and Removed badges. These markers describe the owning unit registry lifecycle and can misrepresent when an individual helper was introduced. Preserve the underlying history classification and navigation; omit only the presentation badge. Existing row and browser history cases now cover this absence, including classification read from revision detail.

The lifecycle-label follow-up fails at `776a5645` and passes unchanged at `ebdd8f5a`, with inspected test-owned before/after screenshots. Focused history tests and navigation pass; reports types, formatting and lint, root audit and registry validation pass. The live helper History page was inspected without the Added badge or browser errors. The earlier full web suite is inherited evidence, not rerun for this label-only change. Full root verification and main integration remain pending.
