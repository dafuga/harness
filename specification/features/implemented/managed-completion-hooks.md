---
status: implemented
shippedIn: null
unitIds:
  - config.agents-providers-completion-hooks
  - service.agents-providers-completion-hooks
owner: null
reviewedAt: null
---

# Feature: Managed Completion Checks

Harness runs completion checks after a successful provider turn in `harness task orchestrate` or `harness task worker`. The check uses the provider, model and effort selected for that run. A failed required check blocks orchestration success or module review. Optional outcomes remain visible and the handoff can continue.

Commit `harness.completion.json` at the project root to override defaults or add checks. Harness reads the configuration from the run's source revision. Omitted settings on a default check keep their default values. A new check supplies all five fields. Check names are unique within their scope.

```json
{
	"checks": [
		{
			"name": "simplify-contract",
			"scope": "orchestrator",
			"prompt": "Remove repeated contract requirements and preserve acceptance criteria.",
			"required": true,
			"enabled": true
		},
		{
			"name": "security-review",
			"scope": "module",
			"enabled": true
		}
	]
}
```

## Defaults

- `simplify-contract` runs for orchestrators and can edit the task's contracts. Its receipt states what it simplified.
- `reduce-module-bytes` runs for module workers. Harness measures separate source and test byte totals and per-file coverage before and after in a disposable worktree. Candidate edits enter the review checkpoint only when both totals decrease, the same tests pass, and comparable coverage does not fall. An unchanged candidate can pass with verified tests and coverage.
- `security-review` is optional and disabled for both scopes. When enabled, it runs last. Custom checks and security reviews are read-only.

## Module verification

Include test files in the task's `verificationFiles`. The built-in verification runs those files with `bun test` and collects LCOV. To use another test runner, set `moduleVerification` to an executable and its arguments. An argument equal to `{tests}` expands to the admitted test file paths. The command must return a failing exit status when tests fail and write fresh LCOV to the file named by `HARNESS_COMPLETION_LCOV`. It runs inside the candidate worktree. Supply any dependency setup the command needs.

The comparison uses line, function and branch coverage when the runner reports them. Changed source needs comparable per-file line coverage. Missing verification files, missing coverage and out-of-scope edits fail the check. Rejected simplification edits are discarded with the disposable worktree. The pre-check worker submission and its checkpoint remain available for review of the failure.

## Run records

The orchestration Tracker item lists check outcomes and links the private JSON receipt. If Tracker is unavailable, Harness prints the receipt path and records that delivery could not be confirmed. `harness task show` retains module outcomes and measurement data in the worker result and points to the claim's full JSON receipt. Receipts are stored under `harness-completion/` in the repository's Git common directory. The module outcome travels with the Git-backed task queue and the detailed JSON receipt stays on the executing host.

The check gates the managed Harness handoff. Land approved work only after the required checks pass.
