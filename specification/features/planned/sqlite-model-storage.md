# Feature: Sqlite Model Storage

## Overview

Harness exposes a driver-injected SQLite adapter for generated models and other projects.
Each local catalog table has a typed model. A rebuildable query index stores registered
entities, dependencies, revision membership, branches and verification summaries from Git.
The portable JSON history remains available to hosted consoles.

## Acceptance Criteria

- Generated consumer projects perform real CRUD, map camelCase fields, JSON and booleans,
  preserve timestamps, reject unknown identifiers and survive closing/reopening SQLite.
- The adapter works with Bun SQLite and Node SQLite through the same public package export.
- Every user table in the catalog has a declared model; tests compare SQLite's schema to them.
- Catalog queries select entities by commit/kind, find dependencies and consumers, and read
  unit history and verification summaries without scanning the source tree.
- Catalog replacement is atomic, deduplicates unchanged entity versions and removes stale rows.
- Existing analytics tables have explicit model definitions without rewriting stored user data.
- Focused tests demonstrate the missing behavior before implementation, then pass unchanged.
- The package consumer tests and normal Harness verification pass on the delivered revision.

## Future Enhancements

- Replacing hosted console JSON transport and adding a database browser are separate UI work.
