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
eleven hosted API cases and 36 existing IPC/proposal/evidence cases. Ownership and
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

`bun run check` was started on `harbor-mbp-2` at
`2688f658b99f1ca52ca2b3e9b4a71249c77e8fe4`. After integrating main `bb0d5b323`,
formatting, TypeScript, lint, Rust checks/build and the shared workspace registry
check pass. The earlier formatting, five lint and 63 atom-preview failures were
observed before that main integration and are resolved in this tree.

The full run finished with 1,199 passing tests, two failures and 25 skips:

- `test/late-cleanup.test.ts`: "a look that is late is ended itself" expected
  one tool-start record and received none. The unchanged focused rerun also fails.
- `test/verification-observations.test.ts`: the `design-option-storage` rules
  observation exceeded its unchanged 60-second timeout.

**Both failures reproduce in a clean snapshot of unchanged main
`bb0d5b323e7e93886c3e19f1e88b46af582bed8b` on the same other laptop.** The baseline
command selected those two original cases; it exited 1 with both failures and no
surviving processes. Source, assertions and timeouts were unchanged. This confirms
an existing main/environment blocker rather than an API CLI regression. The full
pipeline stops at unit tests, so later aggregate E2E, package and workspace gates
remain unproven. Focused API E2Es ran separately and pass. No safeguards are relaxed.

The loop's `verify` step stays pending. No full-suite, Jev-clean, merged-main, package
publication, live paid-provider or production claim is made. Existing service migration
proofs and prior reviews are preserved in their committed-source pack. No screenshots
are committed. The PR is a draft until the required checks pass. The feature report
remains in progress.

## Focused observations

The clean-snapshot capture at `2688f658b99f1ca52ca2b3e9b4a71249c77e8fe4` passed
all **73 tests** (20 CLI/context/registry/session, six local API, eleven hosted API,
36 IPC/proposal/evidence). Capture
`38289a78de48e82a9ace123280ea323cee5737185385c9fee2ee34efd2f18231` retains
578 runtime observations; every directly changed executable unit has timing and
memory evidence. No isolated function-memory attribution is claimed. The linked
CLI read 1,776 manifests of every registered kind from the live feature server.

The following 80 source observations were read from that exact committed tree;
all applicable source metrics are measured. These module units emit no separate
artifact. The shared built CLI is **14,847,290 bytes**. Later metadata-only
commits receive their own focused capture; original source checkpoints remain
labelled with the revision at which they ran.

| Unit                                                                     | Source bytes | Lines | Complexity points | Dependencies |
| ------------------------------------------------------------------------ | -----------: | ----: | ----------------: | -----------: |
| `adapter.networking-security-harness-http`                               |         4331 |   113 |                46 |            1 |
| `command.networking-security-api`                                        |         3902 |   110 |                 5 |            2 |
| `desktop.function.development-tooling-ipc-payload-plan-payload`          |         1040 |    33 |                 2 |            4 |
| `desktop.function.ipc-payload`                                           |         7870 |   211 |                58 |            5 |
| `entry.index`                                                            |        12098 |   189 |                 6 |          116 |
| `entry.program`                                                          |         2717 |    62 |                 1 |           26 |
| `hub.controller.hub-agent`                                               |         5343 |   137 |                33 |            6 |
| `hub.controller.hub-api`                                                 |         7800 |   200 |                59 |            9 |
| `hub.service.hub-projection`                                             |         5884 |   161 |                20 |           16 |
| `reports.controller.console-agent`                                       |         2577 |    54 |                19 |            1 |
| `reports.service.console-agent`                                          |         7243 |   177 |                41 |           13 |
| `service.networking-security-harness-api`                                |         5358 |   134 |                45 |            3 |
| `service.networking-security-harness-api-service-api-session-repository` |         3177 |    90 |                25 |            6 |
| `workflow.networking-security-run-api`                                   |         2290 |    57 |                10 |            7 |
| `workflow.networking-security-run-api-api-agent`                         |         2044 |    52 |                16 |            4 |
| `workflow.networking-security-run-api-api-input`                         |         1147 |    31 |                12 |            2 |
| `workflow.networking-security-run-api-api-output`                        |         1670 |    39 |                17 |            4 |
| `workflow.networking-security-run-api-api-registry`                      |         1785 |    45 |                13 |            3 |
| `workflow.networking-security-run-api-api-resources`                     |         3564 |   114 |                22 |            4 |
| `workflow.networking-security-run-api-api-screenshot`                    |         3815 |    98 |                26 |            7 |

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
