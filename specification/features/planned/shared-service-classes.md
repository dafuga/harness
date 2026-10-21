# Feature: Shared Service Classes

## Outcome

The Services list shows actual shared instantiated classes with multiple public instance methods. Cards retain the simple code name and Used In links. Class identifiers keep PascalCase; functions retain their own camelCase identities outside this list.

## Acceptance

- Prove the concrete class declaration from source at the selected revision. A folder, registered kind, name, function, object, abstract class or static namespace is insufficient.
- Require an actual runtime constructor reference in active owned source. Factories and default/named/forwarded imports count; types, unused imports and shadowed names do not.
- Require at least two distinct public instance callable methods, including inherited methods. Constructors, private/protected/static methods and getters do not count.
- Require two distinct active runtime owner units for that same class. Derive Used In links from the same resolved set, excluding self, duplicates, retired, removed and missing units.
- Preserve canonical declaration names across cards, links and headings, stable registered IDs, current/historical navigation, and owner-local private implementations.
- Keep source-unproven historical entries absent rather than infer class identity from a title.
- Review remaining class responsibilities and actual usage for overlap. Record concrete findings; a name or passing structural test does not prove absence of semantic redundancy.
- Run unchanged red/green standardized metadata, catalog and three-viewport browser scenarios, relevant integration, and the normal repository check. Capture and inspect fresh before/after screenshots without unexpected browser errors.

## Scope and ownership

Direct edits: function.unit-metadata, function.helper-references, function.helper-consumers, reports.function.entity-catalog and the existing service/naming guidance. These internal effectful functions are not shared pure helpers and have no standalone helper catalog pages. Their source links are used instead.

The existing ExplorerFunctionCard remains the presentation component; no card redesign is needed. Class APIs and supported public entries do not change merely to satisfy a catalog shape.

## Coverage gap and prevention

Earlier shared-service classification admitted class, function, constant and default runtime exports together. The existing metadata owner matrix and responsive catalog fixture explicitly accepted a workflow function as a service. That proved reuse but did not establish class identity, instance methods or construction.

Strengthen those normal source and UI scenarios with a reusable declaration/reference matrix. The catalog requires recorded class proof and uses per-class consumers. Add the same eligibility contract to existing agent/generator guidance so future catalog changes cannot infer architecture from casing or a directory.

## Verification

The implementation and local browser are verified at cb5675504d9c08c3b0d20f2810a4389c6b9e456f. Full verification remains open because the required root check stops at existing entityMeasure/entityShown ownership fingerprint drift. The feature report remains active, blocked and unpublished.

## Current implementation and review

The source-derived list contains 52 qualifying class cards. All names match their PascalCase declarations. Thirteen former entries were functions or value modules; twelve class APIs have only one instance operation. Four additional rows lack two resolved owners for the same class. Do not move DI implementations based only on a single constructor site; dynamic/injected sharing can require additional evidence.

Construction proof is a source reference to a new expression, not a claim that verification executed every external service. Multiple methods means the public instance API, including inherited methods; it does not mean every consumer calls every method. The bounded responsibility review found no duplicate service responsibility among the listed classes. Provider and runtime adapters implement different protocols; repositories own storage formats; services coordinate distinct operations.

The source review and complete class/method/owner inventory are retained in [the local review](/Users/danielfugere/.codex/visualizations/2026/10/20/01a159e9-1136-7bf0-b6ef-272c2bfe481d/service-classes/service-review.md).

## Changed registered units and history availability

These internal functions have no standalone shared-helper catalog/History pages. Their registered IDs and Git history are preserved; source links identify the exact edited units rather than inventing explorer links.

| Registered unit                 | Source and change                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| function.unit-metadata          | [unitMetadata.ts](/Users/danielfugere/.codex/worktrees/service-cards/harness/src/services/revision-detail-service/unitMetadata.ts): reset exact-revision class proof and expose its DTO.                                                                                                                                                                          |
| function.helper-references      | [helperReferences.ts](/Users/danielfugere/.codex/worktrees/service-cards/harness/src/services/revision-detail-service/helperReferences.ts): read class declarations, instance methods, base bindings and constructor references.                                                                                                                                  |
| function.helper-consumers       | [helperConsumers.ts](/Users/danielfugere/.codex/worktrees/service-cards/harness/src/services/revision-detail-service/helperConsumers.ts) and owner-local [serviceClasses.ts](/Users/danielfugere/.codex/worktrees/service-cards/harness/src/services/revision-detail-service/serviceClasses.ts): resolve per-class consumers, construction and inherited methods. |
| reports.function.entity-catalog | [entityCatalog.ts](/Users/danielfugere/.codex/worktrees/service-cards/harness/packages/reports/src/utils/entityCatalog.ts): require class proof and use the same owner set for inclusion and links.                                                                                                                                                               |
| function.revision-registry      | [revisionRegistry.ts](/Users/danielfugere/.codex/worktrees/service-cards/harness/src/utils/revision-registry/revisionRegistry.ts): carry class facts in portable history.                                                                                                                                                                                         |
| function.catalog                | [catalog.ts](/Users/danielfugere/.codex/worktrees/service-cards/harness/src/rules/catalog.ts): emit the service class rule through existing naming guides and project guidance.                                                                                                                                                                                   |

AGENTS.md and the project-local Harness skill are guidance artifacts with no explorer page. The existing card component is checked, not edited. The migration ledger records only the two legitimate metadata-definition changes; unrelated entityMeasure/entityShown drift remains unaccepted.

## Final proof and limitations

- Product fix: cb5675504d9c08c3b0d20f2810a4389c6b9e456f, `fix: catalog source-proven shared service classes`.
- Test-only checkpoint: 7810abb052ac197d9d5a6c3c1527ce6da3382750. Final paired red: ed07f16548821895054463f1512fe2910a1b3f6ed118698a012617322b5c2101. Green: 05c5793c0934ebd503787ae656a80f34fa6be9ec1da5d6430dbfc3beb0d334a1. Both run the same frozen tests, fixtures, command and environment. The persistent existing workflow API preserves the full environment gate. Earlier failing checkpoints remain in Git evidence.
- Paired verification: 52 root, 51 Reports and 10 Desktop unit cases pass, plus desktop/tablet/mobile current/history browser scenarios. Normal array admission covers own iterators, indexed getters and species without a JSON round trip.
- The isolated guard rejects the original class parser and catalog with actual assertion failures. Restoring exact product-fix source passes 52 root and nine catalog cases.
- Normal Reports suite: 620 passed across 157 files. CLI/history/generated-project integration: nine passed. Root and Reports type checks/lint, app/embedded builds, all three workspace structure audits and units check pass. Registry: 1309 units, 63 explicitly uncertain references.
- A comment-only follow-up removes a redundant test comment to meet the audit's newline-inclusive 220-line count. Assertions and fixtures are unchanged; its nine normal catalog cases and Reports audit pass. The immutable paired proof remains pinned to the product fix and its original unchanged tests.
- Final required `bun run check` at the product fix: 911 passed, one failed, 25 skipped across 219 files. The remaining failure is existing entityMeasure/entityShown ownership-definition drift. Later full-check stages were not reached. Independently run Reports builds, unit tests and relevant CLI/history integration are reported above; no full-green claim.
- The native app is not modified. Ten shared Desktop cases pass in the pair; native package broad checks and device deployment were not rerun. Earlier native verification gaps are not claimed resolved.
- Fresh Jev advisory review is incomplete: no project-dedicated HARNESS_JEV_API_KEY is available to the manual command. No Clean Code clearance or provider duplication judgment is claimed. The responsibility assessment above is a bounded manual source review.

## Browser and measurements

The inspected local preview is [Services at the verified fix](http://127.0.0.1:5734/harness/branch/dafuga%2Fservice-cards/services). Health identifies source cb567550 and immutable build 5f88751c3884fa046e8462d2a0763e022a23fe4a3b9287580d2bb43216f28b5a. The real page has 52 capitalized class cards, at least two usage links each and zero recorded browser errors. AnalyticsRepository opens its class contract and consumer links; analyticsRecord remains a workflow and returns no class-card search result.

[Final inspected screenshot](/Users/danielfugere/.codex/visualizations/2026/10/20/01a159e9-1136-7bf0-b6ef-272c2bfe481d/service-classes/services-final.jpg). Standard paired before/after screenshots are retained for desktop, tablet and mobile; the after images visibly omit the workflow card.

Exact-commit source size/complexity observations for all six changed units are retained in the portable history and [source measurements](/Users/danielfugere/.codex/visualizations/2026/10/20/01a159e9-1136-7bf0-b6ef-272c2bfe481d/service-classes/source-measurements.json). The embedded console emits 358.29 kB JavaScript and 88.75 kB CSS before gzip. Individual metadata modules emit no separate artifact.

[Manual API profiles](/Users/danielfugere/.codex/visualizations/2026/10/20/01a159e9-1136-7bf0-b6ef-272c2bfe481d/service-classes/runtime-profiles.json) use committed source, the real 1309-unit metadata workload and three sequential performance.now samples. Metadata enrichment: 944-2113 ms; consumer resolution: 350-408 ms; catalog construction: 175-261 ms. Whole-process RSS is 395-497 MB, including compiler/cache/runner overhead, not per-function memory. These profiles do not grant budget approval or full verification. Page runtime timing/heap are unavailable in the Codex read-only DOM evaluator; no page metric is invented. Shared Codex-process memory cannot be attributed to this task and the after-run RSS snapshot does not prove active-run peak memory.

Report e2f36e24-093f-4e05-846f-bb3a3b6aa244 remains in progress and unpublished while the required root check is blocked. No application deployment, push or merge was performed. Existing local preview servers remain running.
