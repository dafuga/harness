# Feature: Model Contract Table

## Overview

The Models catalog contains only persisted database models. Their Contract tab
shows source-declared public methods using the same parameter/return tables as Services.
A separate Table tab documents the database structure owned by a persisted model.

## Acceptance Criteria

- Show each declared public model method separately, including initialization when it exists,
  and find/create/update/delete methods. Do not synthesize missing methods or effects.
- Reuse the service method contract presentation, with parameter and named return tables;
  show declared errors only when present. Exported constants are not model outputs.
- Exclude shared interfaces and type-only modules such as HubAuth from the Models catalog.
  Keep their underlying source and stable history; never invent storage or CRUD to qualify them.
  Prove catalog admission for real persisted models and rejection of shared type/constant modules.
- Read table metadata from the selected committed model definition, never from the host database.
  Show the table name, columns, application properties, storage types, nullability, primary key
  and declared defaults. Unknown/dynamic definitions remain explicitly unresolved.
- Preserve branch and selected revision across Contract/Table navigation, refresh and history.
  Earlier and missing source must not inherit newer schema metadata.
- Extend standard metadata, contract and browser coverage. Demonstrate the unchanged regression
  failing before product changes, then passing after them, with inspected desktop/tablet/mobile
  captures retained through Harness. Record source and runtime measurements with honest scope.
- At phone widths, preserve complete readable field names, types and schema identifiers.
  Any wide table scrolls inside its frame; short example labels and keyboard-operated full
  examples remain usable without document overflow.
- Update Harness generation/guidance so future model contracts follow this distinction.
  Keep Styles PR #84 separate and ahead of this follow-up; coordinate the serial validation slot.

## Future Enhancements

- Live database row browsing and database mutation are outside this documentation feature.

## Process prevention retro: phone table readability

- Evidence: original matched functional proof passes at f047964ac, but its retained 390px
  pixels split `TEXT`, `account_id`, `returnValue` and type identifiers, and clip short example labels.
- Attribution: the new model pane introduced `.schema { overflow-wrap: anywhere }` in f047964ac.
  Contract renders newly exposed methods through pre-existing fixed-layout shared ContractTable
  styling; this does not establish that this feature introduced that shared CSS.
- Missed checkpoint: the standard viewport matrix checked values and document fit, allowing
  compressed unreadable cells to satisfy both. Screenshot review caught the acceptance gap.
- Primary prevention: when a table is added or its layout changes, its existing viewport matrix
  checks one-line code identifiers/types, unclipped short labels, contained scrolling and keyboard
  access to full examples. This strengthens the existing test-review gate rather than adding a suite.
- Observable guard: the unchanged matrix must fail on the retained broken phone source, then pass
  after bounded actual Opus edits. Soft readability assertions retain both panes' evidence while
  still failing the test. Captures explicitly attribute visible header, sections and shared tables.
- Remaining gate: no repair before the new committed failing run; broader shared-consumer checks,
  source/runtime observations and fresh inspected phone pixels remain required before completion.
