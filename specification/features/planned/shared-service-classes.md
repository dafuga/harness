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

Pending fresh regression, browser, source responsibility review and broad checks. Prior 57c67724 has 81 entries: 68 class declarations and 13 non-class entries. Prior broad verification failures remain historical evidence, not current proof.

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

## Proof checkpoints

- Initial test-only checkpoint 9d64d930 and red e1e62a2606afed01c2c12d93e19339d01b9e23d95919c8fc55fb6ebc4812002e remain preserved.
- Final test-only checkpoint 7810abb052ac197d9d5a6c3c1527ce6da3382750 includes normal array admission with own iterators, species and getters. Red 08ce4eba3eeee7e191747585bcc3fbc7dffb7ba274e0bbcd85d7e6faeb32c2f2 has 15 root assertion failures, one catalog failure and three responsive browser failures, with all ten Desktop cases passing.
- Reports normal unit suite: 620 passed. Root/Reports type checks and lint pass. The final catalog suite passes all nine cases, including collection admission.
- Required root check initially had 908 passed, four failed, 25 skipped. Registry metadata caused three failures and has been repaired: all 13 normal shared-reference checks and units check now pass (1309 units, 63 explicit uncertain references). Existing ownership fingerprint drift remains; final broad rerun is pending.
- Fresh Jev advisory review is incomplete because the manual command has no project-dedicated HARNESS_JEV_API_KEY. No clean verdict is claimed; startup advisory uncertainty is not cleared by deterministic tests.
- Final immutable green, isolated reintroduction guard and rebuilt browser screenshots are pending at this checkpoint. Keep full verification and report publication open while required checks are blocked.
