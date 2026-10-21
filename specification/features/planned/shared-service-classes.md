# Feature: Shared Service Classes

## Outcome

The Services list shows actual shared instantiated classes with multiple public instance methods. Cards retain the simple code name and Used In links. Class identifiers keep PascalCase; functions retain their own camelCase identities outside this list.

## Acceptance

- Prove the concrete class declaration from source at the selected revision. A folder, registered kind, name, function, object, abstract class or static namespace is insufficient.
- Require an actual runtime constructor reference in active owned source. Factories and default/named/forwarded imports count; types, unused imports and shadowed names do not.
- Require at least two distinct public instance callable methods, including inherited methods. Constructors, private/protected/static methods and getters do not count.
- Require two distinct active runtime owner units for that same class. Derive Used In links from the same resolved set, excluding self, duplicates, retired, removed and missing units.
- Preserve canonical declaration names across cards, links and headings, stable registered IDs, current/historical navigation, and owner-local private implementations.
- Keep source-unproven historical entries absent rather than infer class identity from a title.
- Review remaining class responsibilities and actual usage for overlap. Record concrete findings; a name or passing structural test does not prove absence of semantic redundancy.
- Run unchanged red/green standardized metadata, catalog and three-viewport browser scenarios, relevant integration, and the normal repository check. Capture and inspect fresh before/after screenshots without unexpected browser errors.

## Scope and ownership

Direct edits: function.unit-metadata, function.helper-references, function.helper-consumers, reports.function.entity-catalog and the existing service/naming guidance. These internal effectful functions are not shared pure helpers and have no standalone helper catalog pages. Their source links are used instead.

The existing ExplorerFunctionCard remains the presentation component; no card redesign is needed. Class APIs and supported public entries do not change merely to satisfy a catalog shape.

## Coverage gap and prevention

Earlier shared-service classification admitted class, function, constant and default runtime exports together. The existing metadata owner matrix and responsive catalog fixture explicitly accepted a workflow function as a service. That proved reuse but did not establish class identity, instance methods or construction.

Strengthen those normal source and UI scenarios with a reusable declaration/reference matrix. The catalog requires recorded class proof and uses per-class consumers. Add the same eligibility contract to existing agent/generator guidance so future catalog changes cannot infer architecture from casing or a directory.

## Verification

Pending fresh regression, browser, source responsibility review and broad checks. Prior 57c67724 has 81 entries: 68 class declarations and 13 non-class entries. Prior broad verification failures remain historical evidence, not current proof.
