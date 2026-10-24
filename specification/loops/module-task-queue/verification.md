# Committed module tasks

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

Workers claim matching assignees/modules atomically and serialize work on the same module. Work runs in an isolated checkout beneath the repository's `.cache/harness/task-worktrees`, pinned to the task's source commit. Changes remain available for review. Writes outside the declared scope or changes to the pinned commit fail the task. Claude receives file tools with edit acceptance; Codex uses workspace-write. Saved host login is reused without forwarding inherited provider API keys.

Successful CLI completion produces `review`, preserving requested and reported model information separately. Existing `task check` and project verification still decide completion. `task retry` preserves failed results and claim history; a running claim is recoverable only after confirming its local owner ended or its PID was reused. Unknown or other-clone owners are preserved.

## Verification

Focused unit, source/ownership and project-template checks pass. The initial eight end-to-end CLI cases pass on `harbor-mbp-2`, covering committed contracts, source isolation, fresh-clone retrieval, shared prompt prefixes, exact Claude/Codex model intelligence, quota-only fallback, competing claims and outside-scope writes. Provider protocol fixtures are synthetic; they do not prove live account/model access.

The unchanged pre-implementation CLI admission test fails on source `76064a9aebe4e1d55a62d84bc5afc74bc246568a`: the feature command exits 1 where committed context requires exit 0. Its ordinary remote run preserves that assertion. Running this CLI fixture through the existing instrumented snapshot recorder instead times out at 30 seconds; that timeout is not counted as red/green proof. A separate command-discovery regression and focused unit observation capture retain their own scopes.

Final revision IDs, full-check results, immutable records and native-runner evidence are recorded below after verification. The Project Reports run is `0808761d-acee-44b6-b9e0-3c5d26cb7108`. Required blocked checks keep its report active and PR #114 draft. There is no frontend change requiring a new browser screenshot for this CLI feature.
