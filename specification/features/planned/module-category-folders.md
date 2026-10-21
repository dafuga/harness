# Feature: Module Category Folders

## Overview

Harness places new modules in responsibility category folders across scaffold kinds.
The explorer shows the same revision-bound categories as headings and multi-select
filters. Categories are project data, not a fixed UI enum. Existing identities,
framework entrypoints and private ownership survive category moves.

## Acceptance Criteria

- Generators support a category for components, helpers, configs, models, services
  and every supported source scaffold; generated imports, exports and tests work.
- Clear name/responsibility matches reuse a category automatically. Ambiguity in a
  categorized project requires an explicit group instead of inventing one.
- Explicit new groups extend the project taxonomy without changing frontend code.
- Audit rejects ungrouped implementations in categorized projects; framework
  entrypoints and explicitly recorded legacy entries remain supported.
- All seven explorer collections show category headings and counts, allow multiple
  category selections combined with existing filters, and reset all selections.
- Category metadata belongs to the selected revision, never the current checkout.
- Shared/private eligibility, canonical code names, IDs and historical links remain.
- Standard generator, audit, metadata, catalog and responsive browser coverage
  supplies unchanged red/green proof. Existing full-check blockers remain explicit.

## Future Enhancements

- Semantic category suggestions can become richer without silently moving code.

## Coverage gap

Existing generator checks expect type folders but do not assert category placement
or rewritten generated imports. Catalog checks cover search and eligibility but
not category grouping, combinations, custom categories or revision changes.
Extend these standard checks rather than introduce a separate testing path.

## Implementation

`harness.groups.json` defines twelve current responsibility categories. Names, titles
and matching terms are project data; adding an explicit `--group` extends that data.
A clear whole-word match can select an existing category. A tie requires `--group`;
Harness does not silently guess from ambiguous names. Projects without a taxonomy
retain their entry layout until the first explicit category adoption.

Implementations now live in category folders for all supported module kinds, with
private code beside its owner. The migration ledger records 1231 moves, including
four documentation moves. Token comparison at the relocation checkpoint confirms
1227 code bodies were retained; subsequent feature edits are reviewed separately.
Thin forwarding entries preserve existing imports, published SDK paths and stable
unit identity. Framework routes and planning artifact filenames remain canonical.
Routes inherit categories from explicit route-folder bindings in the taxonomy.

Every explorer collection shows responsibility headings and counts. The existing
filter dialog supports multiple categories, search and its other filters together.
Historical collections use their selected revision's folders and taxonomy; old
revisions without category data show an explicit Uncategorized section.

## Verification notes

Standard source-architecture checks resolve registered implementation entries while
retaining their dependency, branding, single shared Select and screen assertions.
Existing public entry boundaries remain injectable for storage and process tests.
The frozen input checkpoint includes runner mapping and category configuration
manifest addresses before the separate product repair commit.

The full required check remains pending. Inherited ownership definition drift in
entityMeasure and entityShown is not approved by this migration. Baseline comparison
also reproduces Desktop's snippet/type-depth errors and Remote's validator lint
complexity failure. These checks remain visible rather than being waived.
