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
