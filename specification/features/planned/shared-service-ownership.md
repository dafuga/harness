# Shared service ownership

Services uses the existing name and Used In cards. Only services with two distinct active runtime owners enter the collection; the same resolved owner set supplies the links. Indirect pages, types, unused imports and forwarding exports do not establish sharing.

Single-consumer service implementations move into their owning code area. Preserve unit identities, contracts, public entry filenames, historical reachability and definition tokens. A recorded relocation ledger proves ownership and implementation preservation. Unused exports stay outside the list; public routes and dynamic entries are retained until their runtime contracts identify an owner.

Acceptance:

- Standard metadata cases cover zero, one and multiple owners, aliases, types, repeated references, two functions in one owner, components and forwarding exports.
- Catalog and browser scenarios reject private, missing, duplicate and unrecorded service consumers at branch tip and historical commits.
- Every recorded single-consumer implementation lives under its owner's folder with the same registered identity and implementation.
- Card names, source ownership and revision-bound usage links stay correct at desktop, tablet and mobile widths.
- Relevant unit/integration checks and browser proof pass; report broader baseline blockers explicitly.

Coverage gap: the service catalog tests required a one-consumer card and accepted transitive page fallback. The ownership suite guarded helper relocation only. Both standardized suites now cover service reuse and placement.

The catalog selector has no standalone entity page: [source](/Users/danielfugere/.codex/worktrees/service-cards/harness/packages/reports/src/utils/entityCatalog.ts). [Cards](http://127.0.0.1:5731/harness/branch/dafuga%2Fservice-cards/components/reports.component.explorer-function-card) retain the established rendering. Registered service identities and their source/history remain available at the selected branch.
