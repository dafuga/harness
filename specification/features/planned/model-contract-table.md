# Feature: Model Contract Table

## Overview

Model details distinguish persisted classes from shared data declarations. Their Contract tab
shows source-declared public methods using the same parameter/return tables as Services.
A separate Table tab documents the database structure owned by a persisted model.

## Acceptance Criteria

- Show each declared public model method separately, including initialization when it exists,
  and find/create/update/delete methods. Do not synthesize missing methods or effects.
- Reuse the service method contract presentation, with parameter and named return tables;
  show declared errors only when present. Exported constants are not model outputs.
- Keep existing shared model identities and classification while scope clarification is pending.
  Shared interfaces expose their declared fields/method signatures, without invented CRUD or tables.
- Read table metadata from the selected committed model definition, never from the host database.
  Show the table name, columns, application properties, storage types, nullability, primary key
  and declared defaults. Unknown/dynamic definitions remain explicitly unresolved.
- Preserve branch and selected revision across Contract/Table navigation, refresh and history.
  Earlier and missing source must not inherit newer schema metadata.
- Extend standard metadata, contract and browser coverage. Demonstrate the unchanged regression
  failing before product changes, then passing after them, with inspected desktop/tablet/mobile
  captures retained through Harness. Record source and runtime measurements with honest scope.
- Update Harness generation/guidance so future model contracts follow this distinction.
  Keep Styles PR #84 separate and ahead of this follow-up; coordinate the serial validation slot.

## Future Enhancements

- Live database row browsing and database mutation are outside this documentation feature.
