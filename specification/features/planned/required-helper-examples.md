# Required callable usage examples

Every public helper callable has committed usage examples, including an invocation, concrete argument values and expected return or error. Examples belong to one callable, remain available without verification results, and come from the viewed commit. Missing examples fail normal registry validation; indexing preserves authored values without inventing outcomes. Old commits remain readable and explicit about missing documentation.

Fill all ten currently published helper contracts and execute their examples against real code in normal tests. The helper Examples tab uses the selected callable examples, never siblings from the same module. Generated tenant guidance requires examples and registry checks.

Existing docs tests only cover optional authored documents; helper contracts and index tests accept missing documentation. Strengthen these existing cases and the callable-detail viewport matrix to prove enforcement, preservation, execution, helper isolation and historical scoping.

## Repair and prevention

The registry previously accepted helper contracts without examples, and the detail view read module documents rather than callable contracts. The standardized index, documentation, tenant-generation and callable-detail tests now cover the missing requirement. Test commit `be5e282f` fails with “Callable examples are required”; fix `132d82b5` passes the unchanged command and corpus. Git evidence preserves both checkpoints and their logs. The inspected browser captures show the missing state before repair and the selected callable's invocation and expected result afterward.

The initial delivery gave all ten public Helpers 32 authored examples. Normal tests import each helper's implementation and execute its argument arrays against the expected output. Indexing preserves examples keyed by source and callable name. Current registry validation rejects missing examples; older commits remain readable without borrowing documentation from newer revisions. Generated tenant instructions and this repository's Harness skill require authored examples and registry checks.

## Changed units and why

Each link opens the unit's History section on main. Documentation-only contract edits do not change helper behavior.

| Unit                                                                                                                                    | Change and reason                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [Unit and scenario schemas](http://127.0.0.1:5688/harness/branch/main/functions/function.unit-types/history)                            | Define validated callable usage examples while accepting historical manifests. |
| [Committed documentation](http://127.0.0.1:5688/harness/branch/main/functions/function.unit-documentation/history)                      | Share one example schema and its TypeScript type.                              |
| [Revision metadata](http://127.0.0.1:5688/harness/branch/main/functions/function.unit-metadata/history)                                 | Preserve authored examples when source signatures and consumers are rebuilt.   |
| [Stored revision registry](http://127.0.0.1:5688/harness/branch/main/functions/function.revision-registry/history)                      | Carry committed helper declarations into revision metadata.                    |
| [Entity overview data](http://127.0.0.1:5688/harness/branch/main/functions/reports.function.entity-shown/history)                       | Select only the requested helper's examples.                                   |
| [Duration formatter](http://127.0.0.1:5688/harness/branch/main/functions/reports.function.evidence-media/history?helper=formatDuration) | Document minutes, hours, zero, missing and negative inputs.                    |
| [Remote labels](http://127.0.0.1:5688/harness/branch/main/functions/desktop.function.remote-labels/history)                             | Document plural counts and grouped device identifiers.                         |
| [Activity labels](http://127.0.0.1:5688/harness/branch/main/functions/reports.function.activity-display/history?helper=plural)          | Document singular, plural and zero counts.                                     |
| [Readable names](http://127.0.0.1:5688/harness/branch/main/functions/reports.function.entity-contract/history?helper=humanize)          | Document word boundaries and empty names.                                      |
| [Commit labels](http://127.0.0.1:5688/harness/branch/main/functions/reports.function.entity-lens/history?helper=shortCommit)            | Document full, short and empty commit identifiers.                             |
| [Name casing](http://127.0.0.1:5688/harness/branch/main/functions/function.case/history)                                                | Document each of four casing transformations independently.                    |

These registered backend units have no explorer category: [workflow.load-units](../../../src/workflows/loadUnits.ts) preserves examples during indexing; [validator.unit-registry](../../../src/validators/UnitRegistryValidator.ts) rejects missing examples; [template.project-guidance](../../../src/templates/projectGuidance.ts) emits the tenant rule. Their source links identify that presentation gap rather than inventing explorer routes.

This branch also contains the previously requested GitHub-only Source tab and compact History presentation. Their independent regression commits remain preserved for landing.

## Verification boundary

Focused red/green proof passes at the exact test and fix commits. Broader verification of the integrated branch is running. Full repository verification, including native desktop and iOS layers, is not established by those focused results. No production application deployment is part of this change.

## Process prevention retro: runtime dependency resolution

Live verification exposed a separate regression introduced by main's environment-controls PR #15 (`c6d8a870`): `deploymentConfig` imported JSONC's private ESM entry, whose extensionless imports fail under Node. The preview returned 500 before rendering the helper page. The existing Node boundary test bundled dependencies, so it bypassed the failing external package resolution.

The primary prevention is to extend that existing boundary matrix to bundled and external dependency execution. The desktop runtime-dependency checkpoint must require both modes whenever the same server code runs in the web preview. The test runs in normal desktop verification and rejects the original private import in an isolated committed snapshot; this is a resolution check and does not launch Electron or deploy anything. The repair uses the package's supported public entry. This is a small extension of the existing runtime boundary rule, not a separate workflow.

## Final focused verification

The current-main helper checkpoint `b38e6354` fails and `f0505d40` passes the identical frozen test corpus and command. The full Reports check at `f0505d40` passes all 609 tests, types, lint, three builds and its app audit. All six shared browser cases pass, including callable examples at desktop, tablet and mobile widths. Root formatting, types and lint pass; 22 focused CLI, registry, documentation and generator tests pass. The initial root unit run had 890 passing tests and one outdated relocation-review failure; the unchanged eleven-case ownership test passes after recording the three legitimate definition changes in `10583d36`.

The root audit remains blocked by `test/shared-select-impact.test.ts` exceeding its 220-line limit; the file is unchanged from current main `c6d8a870`. The full root check, native UI and iOS verification are not established. Hosted exact-commit verification at `f0505d40` failed its `bun run build` setup and then reported absent captures and outstanding reason/budget findings. This is an actual verification failure, not a billing exception. Subsequent focused results do not turn that record green.

For runtime resolution, `acd89b73` fails and `82a8e5d9` passes the unchanged bundled/external Node boundary matrix. A clean isolated snapshot also fails when the original private ESM import is restored and passes all four cases when repaired again. Desktop types, focused lint and main/preload compilation pass without launching Electron. The public JSONC entry works externally; the actual desktop build redirects only that package to its ESM module while bundling. The live Contract-to-Examples flow displays five correct `formatDuration` calls without new browser errors.

## Behavior-focused example review

The initial guard checked presence and executable results but accepted numbered titles and repeated features. The documentation, registry CLI and generated-project tests now cover descriptive titles and duplicate titles/calls. An independent agent reviewed every public helper against its implementation; the primary selected one representative call per distinct behavior. This is editorial documentation, not an exhaustive test listing.

All ten Helpers now have 27 examples. Duration formatting combines flooring with minute formatting, retains hours, and shows one invalid-input example instead of repeating blank results. Both plural helpers retain singular and plural behavior without repeating zero. Identity grouping combines full groups and a partial final group; commit shortening omits the redundant empty slice. Humanizing now includes the distinct acronym boundary. Case conversion demonstrates separated words, case transitions and no-word input.

The six helper-unit links above identify all contract edits. Their implementations and consumers are unchanged. The registry validator rejects placeholder titles, normalized duplicate titles and identical calls within one helper. Different calls with equivalent behavior still require semantic review; equal outputs alone are not rejected. Generated tenant guidance and the project skill require descriptive behavior titles and one representative example per distinct behavior, with boundary permutations kept in tests.

Framework source without explorer pages: [validator.unit-registry](../../../src/validators/UnitRegistryValidator.ts) adds the guard; [template.project-guidance](../../../src/templates/projectGuidance.ts) emits the review rule. The existing documentation execution, units CLI and template tests provide normal verification coverage. No schema change is needed, so historical examples remain readable at their original revisions.

Behavior review proof: `4d66bfe3` fails and `5832974a` passes the identical frozen eleven-test command in committed snapshots. Reintroducing the previous validator in isolation fails the CLI guard; restoring the repair passes. Subsequent fixture-only extraction keeps test functions and files within Harness limits, with all eleven tests passing again. Registry validation, TypeScript and focused lint pass. Root audit still reports the inherited 224-line `test/shared-select-impact.test.ts`; the changed test file now meets the limit. Full repository verification remains incomplete, and the loop verification step remains pending. Screenshots are local evidence and are not committed.
