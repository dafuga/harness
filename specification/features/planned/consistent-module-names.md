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
- rule.catalog and template.project-guidance: naming policy and emitted agent instructions, no explorer category.
- audit.scaffold-naming-rules and audit.adapters-svelte: existing audit rules, no explorer category.
- [ExplorerFunctionCard](http://127.0.0.1:5732/harness/branch/dafuga%2Fservice-cards/components/reports.component.explorer-function-card): dependency verified; no markup or style edits.

## Future Enhancements

- Semantic naming still requires reviewing what an operation does; a casing regex cannot judge domain clarity.
