# Harness API CLI verification

The feature branch supports local workspaces and hosted projects through `harness api`.
It discovers registered resources, reads revision-bound data and all declared contracts,
saves proposed contracts, downloads existing screenshot evidence, and controls agents
through each server's existing permission and executor boundaries. Generic HTTP requests
cover additional and future API endpoints.

## Scope and immutable regression proof

| Behavior                                              | Red source                                 | Green source                               |
| ----------------------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| Local/hosted CLI and recorded artifacts               | `1be8ee5e18848d2cfb64609f268af06a49b6ee6f` | `1c1dcda3a2eb571c83c291ce370c2b9cec4f2f64` |
| Historical write protection and request context       | `d15ebf3b2853190f405479d52b43cfef8be78de5` | `2be02581e8e9c3cbce6ce27bc888150679818947` |
| Concurrent local sessions and selected-run events     | `fba7cc1b4501b2f0b9fc4b453a040137e644d2a0` | `d66dc5616cea675e1d50283c2a43d0a66c7d7313` |
| Backend registry and contracts beyond visual entities | `fbf088c03ae40ca8a3104be2150eec659fed6f2c` | `599c4bf932455dc09e122d4942609bb5a160b78d` |

Each pair retains identical tests, fixtures, commands and environment identity in the
Harness loop records. Red assertions demonstrate missing behavior, rather than a timeout
or a broken fixture. These focused records do not grant a full verification verdict.

## Validation and measurement boundaries

Focused checkpoints passed 20 CLI/context/registry/session cases, six real local API cases,
eleven hosted API cases and 32 existing IPC/proposal/evidence cases. Ownership and
readable-contract guards pass after integrating main. The final E2E pass runs on
`harbor-mbp-2`, against disposable Git and HTTP fixtures; no provider is charged and no
hosted project is changed. The normal `test:e2e` script includes the three CLI suites.

Source measurements are computed from the exact committed tree through
`SourceImpactService.measurements`: source bytes, lines, complexity and dependency counts.
The real `build:cli` output supplies the emitted bundle size; it is shared output, without
isolated per-unit size attribution. The focused loop capture records cold CLI wall time
and whole-process maximum RSS using the normal CLI measurement helper. Server behavior
cases record wall time and whole-worker resident memory through `measureWorkload`.

The final capture explicitly uses the supported `HARNESS_RUNTIME_PROFILE_BOUNDARY=benchmark`
boundary. An earlier source-instrumentation attempt stalled CLI child processes and was
stopped with its capture marked failed. No timing from that failed attempt is treated as
proof. Whole-process and whole-worker observations include shared runtime/fixture costs;
they are not isolated function memory measurements. Artifacts retain the tested revision,
workload, samples, method and runtime profile in the loop evidence.

## Manual API exercise

The named feature worktree owns the shared preview at `http://127.0.0.1:5690`.
Live snapshot and provider discovery work through the linked CLI. Provider discovery is
metadata, not a paid/live agent execution test. The new hosted endpoints have been tested
through their authenticated controllers, without deployment.

A CLI download of retained screenshot evidence was inspected:
`reports.page.harness-branch-branch-at-components`, commit
`aa341495fdad60fb8540b6296ade5510fab3d0a3`, desktop, captured
`2026-10-23T15:40:37.518Z`, SHA-256
`3fd59bfe2f496a8ba3eaab45ca705c44bc537c4455240c5e6759fcac2f3c7a1d`.
Its pixels show the synthetic preview fixture. This proves exact artifact retrieval;
it is not a new screenshot, a current-main UI capture or a visual acceptance claim.
Missing screenshots produce an explicit error and require the normal capture scenario.
No frontend UI code was added, so visual UI regression capture is not applicable here.

## Pending full verification

`bun run check` is required and remains blocked by inherited main failures. The integrated
main tree contains formatting failures in generated atom declarations, report support
files and atomic-component metadata. Direct root lint also reports five unchanged
failures in `pieces.ts`, `atomicComposition.ts`, `deriveManifest.ts`, `atomLibrary.ts` and
`generateCode.ts`. The unchanged shared workspace registry test reports 63 missing atom
preview entries. These checks have not been relaxed. Detailed command logs are retained
outside Git and the feature report remains in progress.

The loop's `verify` step stays pending. No full-suite, Jev-clean, merged-main, package
publication, live paid-provider or production claim is made. Existing service migration
proofs and prior reviews are preserved in their committed-source pack. No screenshots
are committed. The PR is a draft until the required checks pass.

## Changed registered units

These source links refer to the current feature worktree. CLI/controller/workflow units
have no visual Explorer page; use their source contracts and Harness loop evidence.
Existing service/function IDs retain their normal Explorer identity and history.

| Unit                                                                     | Owned source                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `adapter.networking-security-harness-http`                               | [HarnessHttpAdapter.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/adapters/networking-security/HarnessHttpAdapter.ts), [HarnessHttpAdapter.types.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/adapters/networking-security/HarnessHttpAdapter.types.ts)                                                 |
| `command.networking-security-api`                                        | [ApiCommand.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/commands/networking-security/ApiCommand.ts)                                                                                                                                                                                                                           |
| `desktop.function.development-tooling-ipc-payload-plan-payload`          | [planPayload.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/packages/desktop/src/utils/development-tooling/ipc-payload/planPayload.ts)                                                                                                                                                                                               |
| `desktop.function.ipc-payload`                                           | [ipcPayload.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/packages/desktop/src/utils/development-tooling/ipc-payload/ipcPayload.ts)                                                                                                                                                                                                 |
| `entry.index`                                                            | [index.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/index.ts)                                                                                                                                                                                                                                                                  |
| `entry.program`                                                          | [program.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/cli/program.ts)                                                                                                                                                                                                                                                          |
| `hub.controller.hub-agent`                                               | [HubAgentController.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/packages/hub/src/routes/api/[...path]/hub-api-controller/HubAgentController.ts)                                                                                                                                                                                   |
| `hub.controller.hub-api`                                                 | [HubApiController.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/packages/hub/src/routes/api/[...path]/hub-api-controller/HubApiController.ts)                                                                                                                                                                                       |
| `hub.service.hub-projection`                                             | [HubProjectionService.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/packages/hub/src/routes/api/[...path]/hub-projection-service/HubProjectionService.ts)                                                                                                                                                                           |
| `reports.controller.console-agent`                                       | [ConsoleAgentController.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/packages/reports/src/lib/development-tooling/server-hooks/ConsoleAgentController.ts)                                                                                                                                                                          |
| `reports.service.console-agent`                                          | [ConsoleAgentService.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/packages/reports/src/lib/development-tooling/server-hooks/ConsoleAgentService.ts)                                                                                                                                                                                |
| `service.networking-security-harness-api-service-api-session-repository` | [ApiSessionRepository.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/services/networking-security/harness-api-service/ApiSessionRepository.ts), [ApiSessionRepository.types.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/services/networking-security/harness-api-service/ApiSessionRepository.types.ts) |
| `service.networking-security-harness-api`                                | [HarnessApiService.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/services/networking-security/HarnessApiService.ts), [HarnessApiService.types.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/services/networking-security/HarnessApiService.types.ts)                                                     |
| `workflow.networking-security-run-api-api-agent`                         | [apiAgent.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/workflows/networking-security/run-api/apiAgent.ts)                                                                                                                                                                                                                      |
| `workflow.networking-security-run-api-api-input`                         | [apiInput.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/workflows/networking-security/run-api/apiInput.ts)                                                                                                                                                                                                                      |
| `workflow.networking-security-run-api-api-output`                        | [apiOutput.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/workflows/networking-security/run-api/apiOutput.ts)                                                                                                                                                                                                                    |
| `workflow.networking-security-run-api-api-registry`                      | [apiRegistry.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/workflows/networking-security/run-api/apiRegistry.ts)                                                                                                                                                                                                                |
| `workflow.networking-security-run-api-api-resources`                     | [apiResources.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/workflows/networking-security/run-api/apiResources.ts)                                                                                                                                                                                                              |
| `workflow.networking-security-run-api-api-screenshot`                    | [apiScreenshot.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/workflows/networking-security/run-api/apiScreenshot.ts)                                                                                                                                                                                                            |
| `workflow.networking-security-run-api`                                   | [runApi.ts](/Users/danielfugere/.codex/worktrees/harness-api-cli/harness/src/workflows/networking-security/runApi.ts)                                                                                                                                                                                                                                  |
