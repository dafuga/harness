# Canonical architecture boundaries

Valid at commit: `f199918f143b6d945966c952aa0c6697a3b8fa28`.

Registry IDs, public forwards and original ownership proofs remain authoritative.

| Registered owner                                                      | Canonical responsibility                                                                                                                                                                                              | Compatibility boundary                                                                                                         |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `service.source-index`                                                | Source facts and bounded revision reads in [SourceIndexService](src/services/development-tooling/source-index-service/SourceIndexService.ts)                                                                          | —                                                                                                                              |
| `function.scan-imports`                                               | Import scanning and script extraction beside the source indexer                                                                                                                                                       | `src/utils/scanImports.ts`, `src/utils/development-tooling/scanImports.ts`, `src/services/source-index-service/scanImports.ts` |
| `service.source-graph`                                                | [SourceGraphService](src/services/development-tooling/SourceGraphService.ts) builds conservative dependency graphs                                                                                                    | `src/services/SourceGraphService.ts`; retain its public class and node functions                                               |
| `service.unit-index`                                                  | Reconcile source ownership, contracts and lineage                                                                                                                                                                     | Both supported `UnitIndexService` forwards remain                                                                              |
| `workflow.inspect-units`                                              | CLI inspection separates import facts, impact paths and authored scenarios                                                                                                                                            | `tests` remains the conservative closure; additive facts are not execution proof                                               |
| `function.unit-metadata`                                              | Selected-source metadata and declaration-role projection                                                                                                                                                              | Shared type IDs stay stable; runtime errors remain runtime support                                                             |
| Ten persisted `model.*` owners                                        | Actual source-declared table wrappers with adapter-delegated methods                                                                                                                                                  | No invented initialization, CRUD or database tables                                                                            |
| `model.adapters-types`, `model.adapters-sqlite`                       | Generated-project type address and SQLite factory adapter                                                                                                                                                             | Preserve these supported addresses; neither is a persisted model                                                               |
| `service.agents-providers-module-task-analytics-service-task-metrics` | Owner-local event aggregation operation                                                                                                                                                                               | Legacy service ID does not make this a service class or public Helper                                                          |
| `function.validation`                                                 | Name admission in [validateName](src/core/development-tooling/fields/validateName.ts), with field/code/route aggregates above it                                                                                      | Core validation imports remain supported                                                                                       |
| `function.scenario-coverage`                                          | Scenario judging and capture validation beside the verification owner                                                                                                                                                 | Old utility and service entries remain supported; evidence bytes/records are untouched                                         |
| `function.files`                                                      | [Planned-file I/O](src/adapters/development-tooling/planned-files/writePlannedFiles.ts) behind a generation adapter; [status formatting](src/core/development-tooling/renderFileList.ts) stays a value transformation | `src/core/files.ts` and categorized aggregate retain public exports                                                            |
| `function.classify-path`, `function.unit-identity`                    | [Repository paths](src/utils/development-tooling/classify-path/classifyPath.ts) and [code identity](src/utils/development-tooling/classify-path/unitIdentity.ts), in Development tooling                              | Historical Accounts & access paths remain forwards, not authentication implementations                                         |

Core leaves describe values and source declarations. Adapters perform filesystem,
process or storage operations. Workflows sequence use cases. Owner-local operations
remain functions when a class would add no lifecycle responsibility. `resourceWork`
is an effectful resource-admission operation, with its scheduler policy unchanged.

Internal runtime consumers use canonical declarations; supported SDK/framework
addresses remain compatibility entries. Type-only dependencies remain conservative
impact edges. Neither direct imports nor authored scenarios establish assertion
coverage, a passing execution or a full verification verdict.

Private operations have no confirmed public Explorer card. Their links above point
to source instead of inventing pages.

Owner-private leaves extend existing units rather than introducing new scaffold IDs.
The first contract cohort covers 20 owners; remaining derived responsibilities retain
their debt markers. Raw compile-time function/type IDs are described by declaration
roles in inspection; a broader Types collection change still needs the unfrozen
website catalog and route qualification.
