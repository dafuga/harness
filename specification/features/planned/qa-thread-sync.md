---
status: planned
shippedIn: null
unitIds:
  - command.agents-providers-qa-sync
  - service.agents-providers-qa-sync
owner: null
reviewedAt: null
---

# QA thread sync

`harness qa-sync` keeps a project's Slack QA threads and GitHub issues in step.
Every decision is a fixed rule; no model is called. A project enables it with
configuration only.

## Rules

- A **QA thread** is a parent message by a configured author whose first line holds
  the heading marker (default `QA · #`) followed by an issue number. When the
  parent links issues of the configured repository, they must include that number.
  Anything else, such as a runbook review thread, is ignored.
- **Approval:** a configured tester's check mark on the parent adds
  `approved by {name}`. Each check mark is applied once, so a label somebody later
  removes stays removed until the tester removes and re-adds the mark.
- **Retest:** a new reply from a tester or a configured requester (user or bot id)
  that asks for a retest adds `needs testing on {environment}`. Recognised forms
  are a reply starting with `retest`, "please retest", "can you test … again",
  "ready for retest/testing/QA" and "needs testing/a retest". Negated sentences,
  quotes and code are ignored. The environment is the one named in the request,
  else the only one named in the reply, else the default.
- **Comments:** new human replies become one tracker note per thread per pass. It
  goes to the one open item of the project's agent whose title names that issue
  and no other. Otherwise it goes to `tracker.inboxItem` with the related item
  ids. Slack text is shortened, redacted and marked as untrusted.
- Labels are only ever added. Nothing is removed or replaced, and nothing is
  posted to Slack. Pull request numbers are never labelled.
- Edited and deleted replies are not handled again. Threads are watched while the
  parent is younger than `lookbackDays` (default 30, at most 90).

## Delivery

The sync polls `conversations.history` and `conversations.replies` instead of
using Socket Mode. Slack splits an app's events between its open sockets, so a
second subscriber would take events from a project bot that already has one.
Polling also picks up marks added while the sync was down. Replies are read only
when a thread's latest reply is past its cursor. Rate limits are waited out.

The state file is owner-only. The first pass applies existing check marks and
treats existing replies as already seen (`--backfill-comments` includes them). A
reply cursor moves only after its labels and note were written, so a failed pass
retries. A crash between a tracker note and the state save can repeat that note.
A failed thread does not stop the others; a one-off run then exits 1. With
`--watch`, errors are printed and the next pass retries, so the host must watch
the output.

## Credentials

Neither the config nor the state holds a credential. Pass tokens as owner-only
files (`--slack-token-file`, `--github-token-file`) or as
`HARNESS_QA_SLACK_TOKEN` and `HARNESS_QA_GITHUB_TOKEN`.

- Slack: a bot token with `channels:history` (public) or `groups:history`
  (private), with the bot invited to each channel. No app-level token is needed.
- GitHub: a fine-grained or App installation token for that one repository with
  Issues read and write.

The host also needs a signed-in `tracker` CLI. `GitHubIssueLabelAdapter` accepts a
token callback, so a host with short-lived App tokens can refresh them.

## Configuration

Defaults cover `threads.headingMarker`, `approval`, `retest` and `lookbackDays`.

```json
{
	"project": "example",
	"slack": { "workspaceId": "T0000000000", "channels": ["C0000000000"] },
	"github": { "owner": "acme", "repo": "app" },
	"threads": { "authors": ["U0000000BOT"] },
	"testers": [{ "slackUser": "U0000000001", "name": "Sam" }],
	"retest": {
		"environments": { "staging": ["staging"], "production": ["production", "prod"] },
		"requesters": ["U0000000002"]
	},
	"tracker": { "agent": "example", "inboxItem": "abc123" }
}
```

## Running

```sh
harness qa-sync --config qa-sync.json --dry-run
harness qa-sync --config qa-sync.json --watch --interval 300
```

A dry run reads everything and writes no label, note or state. One pass holds a
lock beside the state file, so overlapping schedules do not run together.

## Rollout

Enabling it for a production project needs the owner's approval. Retire the
project's earlier label workers or checkers at the same time, so only one writer
applies labels and reports comments. Give the project a lasting inbox item.
