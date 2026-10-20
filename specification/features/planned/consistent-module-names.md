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
- [ExplorerFunctionCard](http://127.0.0.1:5732/harness/branch/dafuga%2Fservice-cards/components/reports.component.explorer-function-card): dependency verified; no markup or style edits.

## Future Enhancements

- Semantic naming still requires reviewing what an operation does; a casing regex cannot judge domain clarity.

## Verification

- Standard paired regression freezes the complete test corpus and configuration. Final red: a2f612c2, record 63f03bd7bb08a939c8b67f6baa7045a5302fb49d4f3a13d80244111151bb8b87. The actual failing assertion is `Console route` versus `consoleRoute`; the same run also rejects descriptive class names, missing naming guides and missing owner-local class audit.
- Reports: all 620 tests across 157 files pass, as do type checks, lint and the app plus embedded Reports/Console builds. The three viewport card-grid flow checks pass at desktop, tablet and phone widths, including current/history routes and class/function usage navigation. Shell naming checks: 4 pass.
- Root focused generator, guide, model/scaffold and audit suites pass. Both normal generated-project CLI integration files pass: 5 cases, including whole generated app/library checks and invalid owner-local class rejection. Registry remains valid: 1309 units and 63 explicitly uncertain references. Root, Reports and Desktop structure audits pass.
- Desktop broad unit run: 865 passed, 5 failed, 3 skipped. The final Desktop local-search compatibility adjustment follows that broad run; focused catalog/usage checks are included in the final paired proof. The four previously documented failures concern strict helper catalog eligibility and an obsolete Open function label; the fifth project-run-reference failure reproduces at the unchanged starting revision a50dd361 (1 failed, 2 passed in that file).
- Desktop type checking has three errors, all reproduced at unchanged a50dd361: NativeHostedCredential forwarded without export type; the pre-existing EntityExamples verification snippet mismatch; and Playwright addInitScript type instantiation in ui-evidence-fixture.ts. These files are unchanged by this naming task.
- The broader Reports entity-preview run passed 63 cases. Its three stale shell-label failures pass after the naming expectations were updated. Its two remaining older cases (a removed service-table selector and an obsolete helper navigation object) reproduce unchanged at a50dd361. No browser error exceptions were added.
- Required root verification is retained separately. The known helper migration guard still rejects entityMeasure and entityShown definition drift; those definitions are unchanged by this task. No baseline or guard was relaxed. The catalogFilter follow-up records only this authorized search-compatibility behavior change.
- Desktop/mobile application deployment and native-device visual proof are not applicable to this local preview handoff; native package verification remains blocked by the existing type errors. No application push, merge or deployment is authorized or performed. The feature report remains in progress while required verification is blocked.

## Source and history

The added downstream UI unit is desktop.component.catalog-view: [source](/Users/danielfugere/.codex/worktrees/service-cards/harness/packages/desktop/src/components/CatalogView.svelte). Its code and spaced-word search share the same identifier. No shared UI component, control, styling or source implementation was replaced.

All changed registered IDs remain unchanged. Their committed history is retained on dafuga/service-cards; backend guide/rule/template modules have no collection category and are linked by source above. Final commit, green record, immutable preview and inspected screenshots are recorded below once produced.
