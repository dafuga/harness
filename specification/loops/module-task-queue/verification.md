# Committed module tasks

The checkpoints below retain the original implementation evidence and failures. Their measurements and status statements apply to the named historical revisions. Consolidated delivery verification, current source identity and provider boundaries are recorded in [Module task completion analytics](../module-task-analytics/verification.md).

Codex sessions create module assignments through the Harness CLI. Both Claude Code and Codex CLI consume the same committed definitions. Concurrent workers coordinate through one repository's Git ref; another clone receives the task and source history with explicit `task sync` and queue-owner handoff.

```sh
harness task feature checkout --goal "Make checkout reliable" --tldr "Build validated orders and payment handling"
harness task schema
harness task add --input task.json
harness task add --input another-task.json --model gpt-6-luna --intelligence max --assignee implementation
harness task worker --worker implementation --watch
harness task show validate-orders --json
```

Example `task.json` for a project with a registered `service.orders` unit:

```json
{
	"id": "validate-orders",
	"title": "Validate orders before payment",
	"feature": "checkout",
	"module": "service.orders",
	"instructions": "Implement the wanted contract and its focused regression.",
	"verificationFiles": ["test/orders.test.ts"],
	"wantedContract": {
		"responsibility": "Reject empty orders before starting payment.",
		"inputs": [{ "name": "orders", "type": "Order[]" }],
		"outputs": [{ "name": "validatedOrders", "type": "Order[]" }],
		"errors": [{ "name": "EmptyOrder", "type": "Error" }]
	}
}
```

The module goal is snapshotted from the committed registry. Supply `moduleGoal` when a unit has only a generated placeholder. Explicit `verificationFiles` must name test files or fixtures and extend the module's source-file scope. Unknown modules, missing wanted contracts and duplicate task IDs are rejected.

Admission writes `queue.json` on `refs/harness/tasks` using Git objects and compare-and-swap ref updates. The source revision, wanted contract, contract SHA256, shared feature goal/TLDR and module goal are committed before pickup. The source HEAD, index and unrelated edits stay intact. Feature contexts and task definitions are immutable; a changed contract gets a new task ID. `task sync <remote>` exchanges the explicit ref without forcing or overwriting divergent queues.

Prompts begin with the identical overall feature goal and TLDR. Module details, instructions, source commit and wanted contract follow. This preserves a reusable prefix; actual cache hits still depend on the CLI envelope and provider cache rules.

Omitting `model` selects `auto`: `claude-haiku-5-5` at `medium`, with `gpt-6-luna` at `max` only after a structured Claude quota rejection. Authentication, permission, capacity and model-access errors do not trigger fallback. Explicit model/intelligence selections never silently substitute another model. Launch arguments follow [Claude Code model configuration](https://code.claude.com/docs/en/model-config) and [Codex non-interactive execution](https://developers.openai.com/codex/noninteractive), checked alongside the installed CLI help.

Workers claim matching assignees/modules atomically and serialize work on the same module. Work runs in an isolated checkout beneath the repository's `.cache/harness/task-worktrees`, pinned to the task's source commit. Changes remain available for review. Writes outside the declared scope or changes to the pinned commit fail the task. Claude receives file and command tools with edit acceptance; Codex uses workspace-write. Saved host login is reused without forwarding inherited provider API keys.

Successful CLI completion produces `review`, preserving requested and reported model information separately. Existing `task check` and project verification still decide completion. `task retry` preserves failed results and claim history; a running claim is recoverable only after confirming its local owner ended or its PID was reused. Unknown or other-clone owners are preserved.

## Verification

Focused unit, source/ownership and project-template checks pass. The initial eight end-to-end CLI cases pass on `harbor-mbp-2`, covering committed contracts, source isolation, fresh-clone retrieval, shared prompt prefixes, exact Claude/Codex model intelligence, quota-only fallback, competing claims and outside-scope writes. Provider protocol fixtures are synthetic; they do not prove live account/model access.

The unchanged pre-implementation CLI admission test fails on source `76064a9aebe4e1d55a62d84bc5afc74bc246568a`: the feature command exits 1 where committed context requires exit 0. Its ordinary remote run preserves that assertion. Running this CLI fixture through the existing instrumented snapshot recorder instead times out at 30 seconds; that timeout is not counted as red/green proof. A separate command-discovery regression and focused unit observation capture retain their own scopes.

The original executable checkpoint is `e4efd95a5c1c1bcb1886bc7c735ca63eb3ebed40`; sealed proof and corrected verification metadata are `f479aad816ff396078ec0ed9d1ddd3cf67ea6726`. Subsequent handoff changes only update this loop's documentation and trace. All automated CLI E2Es, native probes and the aggregate check run on `harbor-mbp-2`; none ran on the primary Mac.

- All 31 combined CLI E2Es pass at executable source `e4efd95a5c1c1bcb1886bc7c735ca63eb3ebed40`: eight module-task cases plus 23 existing API cases, one worker, 42.97 seconds. The provider executables are synthetic protocol fixtures. Remote log: `/tmp/harness-module-task-cli-final.log`.
- All 31 focused module-task, unit ownership and project-template cases pass. Root types and lint pass. Harness audit has no findings; registry integrity reports 1,777 units, 161 recorded uncertainties and no errors. Local logs: `/tmp/harness-module-tasks-focused-verified.log`, `/tmp/harness-module-tasks-types-verified.log`, `/tmp/harness-module-tasks-lint-verified.log`, `/tmp/harness-module-task-audit-final.json` and `/tmp/harness-module-task-unit-integrity-final.json`.
- The installed local Harness CLI was rebuilt from the executable source above. Manual `harness task --help` and `harness task schema` confirm the new commands and preserved `task check`.
- Required `bun run check` at sealed source `f479aad816ff396078ec0ed9d1ddd3cf67ea6726` passes formatting, root types, lint, Rust checks and the kernel build, then stops at the broad unit suite: **1,215 passed, 2 failed, 25 skipped** across 266 files, 568.73 seconds. The failures are `test/late-cleanup.test.ts:135` (tool start expected 1, observed 0) and `test/verification-observations.test.ts:168` (design-option-storage recording times out after 60 seconds). Both were independently reproduced on clean main `bb0d5b323e7e93886c3e19f1e88b46af582bed8b` during the preceding API work. Assertions remain unchanged. Aggregate E2E, full build/package and downstream workspace stages after this gate did not execute; focused CLI passes do not replace them. Log: `/tmp/harness-module-task-check-verified.log`.
- Ten exact-range change reasons are committed in Harness Git notes on the sealed source. `explain check` passes for `9f3d5bab2b053fbb0a6d04f0fc3f3c932d9cbdfe..f479aad816ff396078ec0ed9d1ddd3cf67ea6726`. Red, green and capture records were fetched back to the primary checkout and successfully re-read through `RegressionProofRepository`, checking record, manifest, log and source identities.

## Frozen regression and observations

The final red source, `2874fa2c5683e9a1638985db6f9303fef3a75cd2`, retains the earlier application without module-task commands and adds the complete final test corpus, scenario definitions and runner configuration. `package.json` is explicitly named as a test input because its change only registers the new E2E file. The green source descends from red and introduces the product implementation without changing any frozen tests or runner inputs. Earlier implementation history is retained as the other parent.

| Checkpoint               | Immutable record                                                   | Result                                                                                                 |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Command discovery red    | `d021e911faef9abaa3d05dbd1ab720e7730c9588e0f0601e58f6e6680302acc4` | Unchanged assertion `module task commands must be discoverable` fails, exit 1.                         |
| Same command green       | `8570b2ec0863a0cf5b24d91899c068cf350b17386989bf5bc07d6ff51f13acab` | Same assertion and complete test/configuration corpus pass, exit 0.                                    |
| Independent unit capture | `2fdd5349bcc4a056333dcba5e1c3b66eb1b8549f77279d5cadd5e24486871e57` | Six focused test files pass; 684 observations include 90 for the task-related units and program entry. |

The capture runs normal test behavior on Node 24.19.0, profile `fae395e860966b98`, at the sealed green revision. Examples below include setup, shared code, Git subprocesses and assertions. RSS is whole worker/process memory, not isolated module memory; these are single observed cases, not production latency budgets. Synthetic runner parsing does not measure a paid provider or its CLI process.

| Observed workload                        | Duration   | Process/worker RSS |
| ---------------------------------------- | ---------- | ------------------ |
| Task command discovery                   | 4.074 ms   | 265,142,272 bytes  |
| Six concurrent Git queue transactions    | 376.352 ms | 104,611,840 bytes  |
| Contract admission                       | 71.908 ms  | 101,122,048 bytes  |
| Exclusive dispatch with synthetic runner | 170.739 ms | 106,741,760 bytes  |
| Synthetic CLI completion parsing         | 0.153 ms   | 99,057,664 bytes   |

The source measurements below describe the original executable checkpoint and include every owned helper and type file at that revision. Module units emit no separate artifact. `entry.index` only adds exports; the combined CLI exercises that entry, without an independent per-barrel runtime measurement.

| Changed unit                                  | Source bytes | Source lines | Complexity points | Dependencies |
| --------------------------------------------- | ------------ | ------------ | ----------------- | ------------ |
| `adapter.agents-providers-module-task-runner` | 7,215        | 228          | 47                | 4            |
| `command.agents-providers-module-task`        | 4,184        | 122          | 17                | 5            |
| `repository.agents-providers-module-task`     | 8,570        | 206          | 28                | 8            |
| `service.agents-providers-module-task`        | 7,737        | 189          | 47                | 8            |
| `service.agents-providers-module-task-worker` | 5,770        | 167          | 32                | 6            |
| `command.task`                                | 2,954        | 94           | 15                | 4            |
| `template.project-guidance`                   | 14,501       | 109          | 8                 | 3            |
| `entry.index`                                 | 12,547       | 194          | 6                 | 121          |

The whole bundled CLI is 14,869,773 bytes, SHA256 `8300372659850e14ceb0cef4f8d236d7f794de558e2d43ad451d49473116914f`. This includes the existing CLI and dependencies; it is not attributed to the new modules. Physical artifact and source measurements are retained in `/tmp/harness-module-task-final-sizes.json` on the primary Mac.

## Native provider boundary

Official Codex CLI 0.154.0 and Claude Code 2.1.296 were installed in task-local caches on `harbor-mbp-2`, without changing global CLI configuration or copying credentials. Claude Code meets the documented Haiku 5.5 minimum version, but its auth status reports `loggedIn: false` on that host, so live Claude acceptance remains blocked.

The native Codex probe uses the real task admission and worker path, explicitly requesting `gpt-6-luna` with `max` intelligence. Although `codex login status` identifies a saved ChatGPT login, the actual protocol returns: “Your access token could not be refreshed because your refresh token was already used.” The task is correctly recorded as failed, its source remains unchanged, and `reportedModel` is null. This does not establish model availability or a live execution pass. The saved login session was preserved. Remote sanitized evidence: `/tmp/harness-module-native-errors.json` and `/tmp/harness-module-native-result.json`.

The original Project Reports run `0808761d-acee-44b6-b9e0-3c5d26cb7108` retains its incomplete historical outcome. Required checks kept the report active and PR #114 draft at that checkpoint; consolidated delivery verification supersedes that status. There is no frontend change requiring a new browser screenshot for this CLI feature. No package publication, application deployment, source merge or production promotion is part of this handoff.
