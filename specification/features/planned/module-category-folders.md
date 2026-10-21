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
