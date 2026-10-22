# Feature: Consistent Module Names

## Overview

Show the recorded code identity consistently across catalogs, usage links, detail headings and history. Make naming rules for every module type explicit in Harness guidance, generated projects and audit.

## Acceptance Criteria

- Service and class names use PascalCase with their existing role suffix, such as AgentActivityService, AgentHttpAdapter or AnalyticsRepository.
- Components and models retain PascalCase. Functions, helper callables, workflows and value modules retain their actual camelCase identity. Type collections retain the owned PascalName.types module name when no primary type matches.
- A code unit uses its recorded primary symbol or owned module filename, never a fabricated identifier made by recasing a descriptive title. Unknown legacy names and route screens retain explicit readable fallback labels.
- Cards, direct usage links, breadcrumbs and detail headings agree in current and selected historical revisions. Routes, unit IDs and history remain stable.
- Service eligibility still requires two distinct resolved runtime owners. No source implementation moves are needed for this naming correction.
- `harness info naming`, every scaffold guide and generated agent instructions state the naming convention for their type, including framework filename exceptions and helper semantic review.
- Existing naming audit verifies owner-local class filenames as well as shared top-level class folders. Existing Svelte component and function naming rules remain enforced.

## Coverage diagnosis and prevention

The preceding service-card change added a card-only symbol override to a resolver that otherwise humanized code identifiers. It exposed a pre-existing naming difference and left card titles, consumer links and headings inconsistent. The standard card fixture contained one class service; its expected usage links explicitly used prose. No assertion compared code identity across these surfaces or exercised an effectful function service.

Strengthen the existing explorer-name, entity-catalog and responsive entity-preview scenarios, their shared fixtures, and existing guide/project-template/audit/CLI suites before repair. Keep their inputs and assertions unchanged for paired red/green proof. Use one resolver for both primary and related unit labels and remove the card-only override. Extend the existing generator guidance checkpoint, with emitted-instruction assertions, rather than adding a new review workflow.

## Changed units

- reports.function.explorer-name: [source](/Users/danielfugere/.codex/worktrees/service-cards/harness/packages/reports/src/utils/explorerName.ts); this backend naming module has no public collection card.
- reports.function.entity-catalog: [source](/Users/danielfugere/.codex/worktrees/service-cards/harness/packages/reports/src/utils/entityCatalog.ts), including owned filter module; no public collection card.
- guide.scaffolds and guide.guide: existing static guidance, no explorer category.
- function.catalog and template.project-guidance: naming policy and emitted agent instructions, no explorer category.
- audit.scaffold-naming-rules and audit.adapters-svelte: existing audit rules, no explorer category.
- desktop.function.catalog-unit and desktop.component.relationships-panel: Desktop shares the resolver; its catalog and relationships keep the same names as Reports. Backend source: /Users/danielfugere/.codex/worktrees/service-cards/harness/packages/desktop/src/utils/catalogUnit.ts.
- [ExplorerFunctionCard](http://127.0.0.1:5733/harness/branch/dafuga%2Fservice-cards/components/reports.component.explorer-function-card): dependency verified; no markup or style edits.

## Future Enhancements

- Semantic naming still requires reviewing what an operation does; a casing regex cannot judge domain clarity.

## Verification

- Standard paired regression freezes the complete test corpus and configuration. Final red: b7145c1185aa867064261b13cf83efabfc936632, record 7ea7cf43202684a770b144d801a905311e14a729a9cef18e9e664ac1fc81981d. The actual failing assertion is `Console route` versus `consoleRoute`; the same run also rejects descriptive class names, missing naming guides and missing owner-local class audit.
- Reports: all 620 tests across 157 files pass, as do type checks, lint and the app plus embedded Reports/Console builds. The three viewport card-grid flow checks pass at desktop, tablet and phone widths, including current/history routes and class/function usage navigation. Shell naming checks: 4 pass.
- Root focused generator, guide, model/scaffold and audit suites pass. Both normal generated-project CLI integration files pass: 5 cases, including whole generated app/library checks and invalid owner-local class rejection. Registry remains valid: 1309 units and 63 explicitly uncertain references. Root, Reports and Desktop structure audits pass.
- Desktop broad unit run: 865 passed, 5 failed, 3 skipped. The final Desktop local-search compatibility adjustment follows that broad run; focused catalog/usage checks are included in the final paired proof. The four previously documented failures concern strict helper catalog eligibility and an obsolete Open function label; the fifth project-run-reference failure reproduces at the unchanged starting revision a50dd361 (1 failed, 2 passed in that file).
- Desktop type checking has three errors, all reproduced at unchanged a50dd361: NativeHostedCredential forwarded without export type; the pre-existing EntityExamples verification snippet mismatch; and Playwright addInitScript type instantiation in ui-evidence-fixture.ts. These files are unchanged by this naming task.
- The broader Reports entity-preview run passed 63 cases. Its three stale shell-label failures pass after the naming expectations were updated. Its two remaining older cases (a removed service-table selector and an obsolete helper navigation object) reproduce unchanged at a50dd361. No browser error exceptions were added.
- Required root verification is retained separately. The known helper migration guard still rejects entityMeasure and entityShown definition drift; those definitions are unchanged by this task. No baseline or guard was relaxed. The catalogFilter follow-up records only this authorized search-compatibility behavior change.
- Desktop/native/mobile deployment and physical-device visual proof were not performed because native package verification remains blocked by the existing type errors. No application push, merge or deployment is authorized or performed. The feature report remains in progress while required verification is blocked.

## Source and history

The added downstream UI unit is desktop.component.catalog-view: [source](/Users/danielfugere/.codex/worktrees/service-cards/harness/packages/desktop/src/components/CatalogView.svelte). Its code and spaced-word search share the same identifier. No shared UI component, control, styling or source implementation was replaced.

All changed registered IDs remain unchanged. Their committed history is retained on dafuga/service-cards; backend guide/rule/template modules have no collection category and are linked by source above. Final code commit: 57c677244000ec8f9db9c296b79a28dda5b9c397. Green record: 2775269924df5854b1c4fb3514fdab7022784a829ca9c0669f2be58e2e6e6177. The unchanged paired command passes 103 unit cases and three responsive browser cases.

## Final local result

[Services](http://127.0.0.1:5733/harness/branch/dafuga%2Fservice-cards/services) serves immutable build bf8b62aead2a540ea79c3481d8bce78b1fe441aff783201e7f66e3be4b0e4214 from code commit 57c67724. The portable history retains 48 commits. The existing preview on 5732 is also left running.

The final in-app browser capture is 775 by 988. It shows 81 cards, every card has at least two usage links, analyticsRecord navigation retains its exact heading, and no browser errors were recorded. Models, components and the five existing helper cards were also visually checked. Per-unit component screenshot gaps remain explicit and are not claimed as behavior evidence.

The full root check recorded 896 passes, three failures and 25 skips. One bundled-tool timeout and one registered-test-title mismatch passed a fresh five-case rerun after the test identity was restored. The existing entityMeasure/entityShown ownership drift remains unresolved; later full-check stages were not reached. No broad pass is claimed. The final report remains active, blocked and unpublished.

Naming rules are available through `bun run dev -- info naming --json`, each scaffold guide, generated AGENTS.md and the generated Harness skill. The standard generator/audit tests enforce the emitted rules. A private local-search helper now states its returned value as searchText, and both identifier and spaced searches stay usable.

| Changed UI unit                       | Unit and history                                                                                                                                                                                                                                       | Source                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| desktop.component.catalog-view        | [Unit](http://127.0.0.1:5733/harness/branch/dafuga%2Fservice-cards/components/desktop.component.catalog-view) · [History](http://127.0.0.1:5733/harness/branch/dafuga%2Fservice-cards/components/desktop.component.catalog-view/history)               | [CatalogView.svelte](/Users/danielfugere/.codex/worktrees/service-cards/harness/packages/desktop/src/components/CatalogView.svelte)               |
| desktop.component.relationships-panel | [Unit](http://127.0.0.1:5733/harness/branch/dafuga%2Fservice-cards/components/desktop.component.relationships-panel) · [History](http://127.0.0.1:5733/harness/branch/dafuga%2Fservice-cards/components/desktop.component.relationships-panel/history) | [RelationshipsPanel.svelte](/Users/danielfugere/.codex/worktrees/service-cards/harness/packages/desktop/src/components/RelationshipsPanel.svelte) |

Backend unit history remains under the same registered IDs; guide, rule and template units have no public collection category. Their exact changed sources are linked above and their code history is the 57c67724 change. No history identity was replaced.

[Services screenshot](/Users/danielfugere/.codex/visualizations/2026/10/20/01a159e9-1136-7bf0-b6ef-272c2bfe481d/module-names/services-final.jpg) · [Helpers screenshot](/Users/danielfugere/.codex/visualizations/2026/10/20/01a159e9-1136-7bf0-b6ef-272c2bfe481d/module-names/helpers-final.jpg) · [Models screenshot](/Users/danielfugere/.codex/visualizations/2026/10/20/01a159e9-1136-7bf0-b6ef-272c2bfe481d/module-names/models-final.jpg) · [Components screenshot](/Users/danielfugere/.codex/visualizations/2026/10/20/01a159e9-1136-7bf0-b6ef-272c2bfe481d/module-names/components-final.jpg)
