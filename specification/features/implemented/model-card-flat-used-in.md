# Feature: Model Card Flat Used In

Model collection cards show the model name and its revision-scoped Used In links without
category headings. Other catalog cards keep their current grouped usage presentation.

## Acceptance Criteria

- Each model card shows its model name, the Used In label and all existing consumer links.
- Model consumer links have no Pages, Components, Services or other category headings.
- Helper cards retain their category headings and their existing consumers and navigation.
- The model card content and consumer links remain correct at desktop, tablet, mobile, tip and selected-commit scopes.
- Model search, shared filters, detail navigation and Source actions remain available.

## Verification

- The unchanged catalog browser scenario fails on test checkpoint `393cedd9` and passes on fix `aa60e746` at desktop, tablet and mobile. Red record `749883bd` and green record `fabddea7` preserve the same test, fixtures, command and environment.
- `bun run --cwd packages/reports test:unit -- test/components/explorer-usage.test.ts test/components/explorer-function-card.test.ts` passes 12 tests; Reports typecheck and lint pass; `bun run dev -- units check` validates 1,437 units.
- Fresh model-card screenshots were inspected at desktop, tablet and mobile. The browser scenario also confirms consumer links and helper-card groups remain available and records no browser errors.
- The full CLI suite was not run, as requested.

## Changed Units

- [ExplorerUsage contract](../../units/reports.component.explorer-usage.json) defaults to grouped consumers and supports a flat link list.
- [Function card contract](../../units/reports.component.explorer-function-card.json) selects flat usage for models while preserving grouping for helpers and services.
