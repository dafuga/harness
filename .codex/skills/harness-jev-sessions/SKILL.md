---
name: harness-jev-sessions
description: Use to install, inspect or troubleshoot automatic Jev Clean Code checks for local Codex Harness sessions, including scope, hook trust, cache and incomplete runs. Use harness-jev-clean-code to interpret code findings.
---

# Harness Jev Sessions

Operate the existing SessionStart integration. Do not create a scheduled automation
or invent a completion-time hook to satisfy a request about this system.

## What runs

The installed background hook matches startup, resume and clear. It reviews
Harness-governed projects under configured roots, including associated Git worktrees.
A project must contain harness.audit.json. Unrelated sessions are skipped before
loading the checker credential. Cloud-orchestrated sessions are outside this integration.

The session runner forces advisory mode, honors the project's model and exclusions,
and reuses the Clean Code cache. It reads only HARNESS_JEV_API_KEY from the selected
owner-only regular credential file. An application's cleanCode.apiKeyEnv cannot
redirect this checker to another credential. It receives a minimized lifecycle event;
transcripts and assistant messages are not review inputs.

A background result may arrive later in the session. It describes source at startup;
source edits require another review. An incomplete result is not a clean verdict.
Read [harness-jev-clean-code](../harness-jev-clean-code/SKILL.md) for judgment
interpretation and repair verification.

## Inspect before changing setup

Resolve the Codex configuration directory from CODEX_HOME when set, otherwise
~/.codex. The installer defaults to ~/.codex; pass --home explicitly for another directory.
The current installation uses:

- hooks.json: the command definition and exact-definition trust boundary.
- harness/session-checks/index.js: a stable built CLI, independent of checkout lifetime.
- harness/session-checks/settings.json: allowed roots and a credential-file reference.

Inspect these non-secret configuration files and resolve the command's executable.
Use the stable bundle if the checkout's CLI does not yet have the session command.
Changing the current configuration is a separate action from explaining or inspecting it.

## Install or update when requested

Use a tested Harness revision with the session command and build:cli script:

```bash
bun run build:cli
bun run dev -- session install --root /path/to/projects \
  --credential-file /path/to/private-jev.env --bundle dist/index.js
```

For a custom Codex directory, add --home /path/to/codex-config. The installer checks
credential presence and permissions without contacting Jev. The credential file must
contain exactly one HARNESS_JEV_API_KEY. Keep the key out of commands, URLs, hook
JSON, settings, evidence and Git. Use the existing dedicated Harness checker credential
only for the scope approved for this checker; do not copy application credentials.

The installer copies the bundle and preserves unrelated hooks. Repeated installation
keeps one owned hook. Review the exact definition through Codex's normal /hooks
interface and verify it is enabled and trusted. Never bypass trust, write its trust
store directly, or call an untrusted installed hook active. Changed definitions need
review again. Configuration does not retroactively prove a review of an existing turn.

## Offline sanity check

Use the installed command with --dry-run and a minimal event on stdin:

```json
{
	"hook_event_name": "SessionStart",
	"source": "startup",
	"session_id": "manual-dry-run",
	"cwd": "/absolute/project/path"
}
```

Invoke `session hook --settings /absolute/settings.json --dry-run` through the
installed Bun/bundle paths. Label this a manual diagnostic, not a real startup event.
Expected output is valid hook JSON with a dry-run coverage summary, or {} for an
unrelated project. No provider request or credential read is required by this dry run.
Do not remove --dry-run merely to test whether an existing key works without a live-review request.

## Troubleshoot from the reported state

- No hook result: inspect discovery, exact trust status, matcher and project scope.
  Use /hooks, or hooks/list through a supported local Codex app-server, without
  creating a model turn just to inspect configuration. Do not assume discovery means execution.
- {} output: confirm the source event, absolute cwd, harness.audit.json and configured
  roots. For worktrees, check their primary repository identity.
- Incomplete configuration warning: verify the referenced file exists, is owner-only
  and contains the selected variable without exposing its contents.
- Incomplete provider review: inspect safe local failure metadata and availability;
  do not retry a failed provider for every file. The runner stops new provider requests
  after its first error and has a 110-second review deadline inside a 120-second hook timeout.
- Needs-review or violations: assess the actual code with harness-jev-clean-code.
  The hook exits successfully for advisory findings; inspect its reported status.
- Stale judgment: confirm source/context cache invalidation; use a fresh requested
  review for edits made after startup. Do not change exclusions or confidence to hide a failure.

Keep setup proof separate from live-provider proof. Dry runs, trusted metadata and
mocked tests do not prove a successful live Jev judgment.
