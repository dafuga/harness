# Feature: Relation Catalog Cards

Uses and Used In share the item renderer used by the collection pages. Component and page relationships use their existing screenshot cards; helpers use their existing example-call cards. Models, services, shells and configs retain their collection tables. Relationship items omit verification marks and preserve the current branch and commit. Private callables in Other and unknown support dependencies remain accessible.

The earlier relationship component owned a second set of row markup. Existing tests accepted names, grouping and links without requiring the collection components. The standardized composition, relationship and responsive browser tests now require shared rendering. A generated component provides the common renderer; no second set of card markup or styling was added.

Direct changes, with each link opening the registered unit's History:

- [EntityRelations](http://127.0.0.1:5688/harness/branch/dafuga%2Fgithub-source-links/components/reports.component.harness-entity-relations/history) delegates each relationship category to the common renderer.
- [ExplorerCatalogItems](http://127.0.0.1:5688/harness/branch/dafuga%2Fgithub-source-links/components/reports.component.explorer-catalog-items/history) selects the existing page/component card, helper card or table and holds the existing grid styles.
- [ExplorerCatalogScreen](http://127.0.0.1:5688/harness/branch/dafuga%2Fgithub-source-links/components/reports.component.harness-explorer-catalog-screen/history) and [ExplorerPagesScreen](http://127.0.0.1:5688/harness/branch/dafuga%2Fgithub-source-links/components/reports.component.harness-explorer-pages-screen/history) delegate list rendering to that same component.
- [ExplorerPageCard](http://127.0.0.1:5688/harness/branch/dafuga%2Fgithub-source-links/components/reports.component.harness-explorer-page-card/history) and [ExplorerTable](http://127.0.0.1:5688/harness/branch/dafuga%2Fgithub-source-links/components/reports.component.harness-explorer-table/history) accept an optional verification flag; collection defaults are preserved.
- [EntitySections](http://127.0.0.1:5688/harness/branch/dafuga%2Fgithub-source-links/components/reports.component.harness-entity-sections/history) passes the selected revision lens and media base to the relationship component.
- [entityCatalog](http://127.0.0.1:5688/harness/branch/dafuga%2Fgithub-source-links/functions/reports.function.entity-catalog/history) builds relationship rows without applying the public Helpers collection threshold. The ordinary collection still requires two eligible visible consumers. Helper consumer links resolve against the complete selected revision.

The existing helper card is reused without edits. Relations, screenshots, contract examples, navigation and the public catalog threshold are dependencies checked by the relevant tests.

## Verification

The final lint-clean failing-test checkpoint is `59dbe9dc`. The product fix is `4248db07`; the loop records the identical focused unit command and frozen test corpus against these two separate commits. The responsive browser regression also failed on the original row implementation and passed unchanged across desktop, tablet and mobile. Final committed-build captures and broad verification are recorded below.

Broader coverage was aligned with the requested behavior: related components now have screenshot cards, so the visual-screen test expects their images; names can follow screenshot provenance, so the overview test checks the same group and name without requiring adjacent text. Route and selected-revision checks are preserved.

Focused relationship/composition/catalog checks pass 32 tests. Shared Select, Search and alias impact checks pass 13 tests. Registry validation passes with 1337 units and 65 explicitly uncertain references. Full repository verification remains pending because the inherited `test/shared-select-impact.test.ts` has 224 counted lines against its 220-line limit. Focused proof grants no full verification verdict or baseline approval.

The complete Reports check passes at `4248db07`: formatting, types, lint, 610 tests, all three builds and app audit. Twelve additional browser cases pass on the same source: Uses/Used In, component/helper grids, revision-specific component screenshots and minimal page cards at desktop, tablet and mobile widths. They exercise private functions, helper consumer links and current/historical navigation with no unexpected browser errors. Fresh original images were inspected; the final served fixture build and capture hashes are retained under `.cache/harness/relation-catalog-cards/`, outside source control. Older before captures retain their original implementation-checkpoint attribution.

The emitted console bundle is 351.00 kB (119.92 kB gzip); this is the whole console, not an individual card. The change delegates rendering to existing items and does not claim a latency or memory improvement. No production deployment or native-device verification was performed. Repository-wide verification and merging remain pending on the separate root audit finding.

## Quiet history navigation and current-main integration

Current main `1374b7a9` is integrated, including the other agents' header changes.
The older-commit notice was rendered twice: by [Explorer console](http://127.0.0.1:5688/harness/branch/main/shells/reports.component.harness-harness-console/history) and [Branch and revision selectors](http://127.0.0.1:5688/harness/branch/main/components/reports.component.harness-harness-selectors/history). Both render blocks are removed. Truncation metadata, retained revisions, navigation and missing-data diagnostics stay intact. Their contracts now describe this behavior.

[ExplorerCatalogItems](http://127.0.0.1:5688/harness/branch/main/components/reports.component.explorer-catalog-items/history) also receives the six missing input descriptions reported by the full-check contract guard. The shared Select impact test's long header comment is condensed; its assertions are unchanged and the former file-length audit blocker is cleared.

The existing navbar test now expects quiet navigation with a truncated index. The existing real-console responsive matrix serves that same condition, captures the screen, then checks the whole rendered body. An initial ambiguous nested-shell locator was rejected; that attempt is archived locally and excluded from accepted proof. Accepted red checkpoint `9b793db8` fails because both notices are present; `beaf7d32` passes the identical frozen test, fixtures, command and environment. Original images, fixture assets and hashes remain outside source control under `.cache/harness/quiet-history-navigation/`.

All three responsive console cases pass, including tab continuity, category navigation, helper filtering and unexpected-browser-error guards. Navbar tests pass, the readable-contract guard passes, and the registry validates 1337 units with 65 explicit uncertain references. The full repository check remains in progress; the loop's verification step remains pending until it passes. No production or native-device deployment is part of this change.

The final integration includes main `503f75a9` (mobile navigation). Two existing budget/range integration tests retained the source sizes from before the fixture's 13-byte purity annotation. Their strict expectations and ledger-tampering setup now use 100/161 bytes; all eight cases pass without removing the growth, approval or append-only guards.

Hosted clean-snapshot verification exposed a missing desktop SvelteKit config during the Reports build. Root tests had generated that file first, masking the cold-build dependency. The root build now synchronizes Reports, desktop and hub configs before building. A separate Git archive of `4cb7ca86` with newly installed locked dependencies completes the whole root build successfully; no warm generated config is shared. The existing clean-snapshot CI setup continues to exercise this boundary.

The completed Reports run passed 610 tests, all builds and audit. The original broad root run passed 891 unit tests before its integration phase; its terminal and temporary logs were lost during a session reset. A fresh complete `bun run check` is running with a workspace-local log. Full verification remains incomplete, and the loop verification step stays pending. Hosted exact-commit records also have outstanding historical reason/budget findings; no baseline approval is fabricated. Jev's startup review has unresolved `needs-review` configuration entries and is not a clean verdict for this final source.

## Consumer links and screenshot previews

PR16 reused the item renderer, but kept pages' minimal variant and component
usage as flattened names. Its shared-card acceptance checked classes and names,
so it missed interaction parity. The revised local Harness skill now requires
rendered variant, consumer footer, hover/focus preview and revision navigation
coverage whenever catalog items are reused. The existing responsive matrix covers
this rule; it is not a new workflow.

The committed red checkpoint is 201046d7. Initial cold-snapshot attempts lacked
dependencies and generated SvelteKit configs and are excluded as defect proof.
After the normal install/sync preparation, all six responsive usage/card cases
fail on the actual missing footer or preview, with inspected before captures.

Catalog rows now retain consumer entities instead of only names. A generated
ExplorerUsage footer and ExplorerUsageLink preview serve visual cards, helper
cards and table consumer cells in both list and relationship views. The existing
EntityLink preserves real link behavior and revision scope. Screenshot evidence
comes from the referenced entity at the selected revision; missing captures and
image errors stay explicit. New shared UI source and manifests are tracked;
original screenshots remain outside source control. Verification is pending.

The accepted immutable checkpoints are red `b092f49f` and fix `55c9fe81`, with
the same frozen test corpus and pinned runtime/environment. Six responsive
usage/card cases pass. A separate isolated fix snapshot with the old page card
reintroduced fails all three usage cases; restoring the fixed file passes all
three. Original build assets, captures, hashes, navigation timing and Chromium
whole-renderer JavaScript heap estimates remain in the local evidence cache.
The synthetic Orders fixture proves shared UI behavior; its captures are not
screenshots of real Harness project entities.

A broader usage assertion formerly forbade consumer links anywhere in Uses. It
now forbids consumers as top-level dependency cards while requiring their nested
links, matching the requested reusable footer. The six unchanged focused cases
and their regression checkpoint remain intact. Reports and root verification
are still being completed; no full-verification verdict is asserted.

Changed executable units, with why they changed and links to their History:

- [Shared consumer footer](http://127.0.0.1:5688/harness/branch/dafuga%2Fusage-card-previews/components/reports.component.explorer-usage/history): One usage footer shared across cards and tables.
- [Consumer screenshot preview](http://127.0.0.1:5688/harness/branch/dafuga%2Fusage-card-previews/components/reports.component.explorer-usage-link/history): One accessible hover/focus preview and entity link.
- [Visual catalog card](http://127.0.0.1:5688/harness/branch/dafuga%2Fusage-card-previews/components/reports.component.harness-explorer-page-card/history): Pages and components expose the same linked usage footer.
- [Helper card](http://127.0.0.1:5688/harness/branch/dafuga%2Fusage-card-previews/components/reports.component.explorer-function-card/history): Replace its separate footer with the shared component.
- [Catalog table](http://127.0.0.1:5688/harness/branch/dafuga%2Fusage-card-previews/components/reports.component.harness-explorer-table/history): Replace flattened consumer names with shared usage links.
- [Catalog item renderer](http://127.0.0.1:5688/harness/branch/dafuga%2Fusage-card-previews/components/reports.component.explorer-catalog-items/history): Pass the selected evidence lens and media prefix to all items.
- [Entity navigation link](http://127.0.0.1:5688/harness/branch/dafuga%2Fusage-card-previews/components/reports.component.harness-entity-link/history): Forward preview events and accessibility attributes while preserving native link behavior.
- [Catalog row data](http://127.0.0.1:5688/harness/branch/dafuga%2Fusage-card-previews/functions/reports.function.entity-catalog/history): Retain distinct revision-scoped consumer entities for links and previews.

The EntityLens manifest also records the new preview consumer of shortCommit; its implementation is unchanged. The local Harness skill has no explorer entity; its source is `.codex/skills/harness/SKILL.md`.

Exact product commit `55c9fe81` source observations (bytes and decision points):

| Unit                        | Source bytes | Complexity |
| --------------------------- | -----------: | ---------: |
| Shared consumer footer      |         1011 |          1 |
| Consumer screenshot preview |         5693 |         27 |
| Visual catalog card         |         4303 |         13 |
| Helper card                 |         2718 |         11 |
| Catalog table               |         3701 |         13 |
| Catalog item renderer       |         2144 |          3 |
| Entity navigation link      |         1015 |          2 |
| Catalog row data            |         7043 |         43 |

Source observations are independent of full verification. Runtime capture measurements describe the synthetic route and whole renderer; they do not attribute allocations or latency to one component. No production or native-device deployment is claimed.
