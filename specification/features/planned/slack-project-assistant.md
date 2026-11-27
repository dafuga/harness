---
status: planned
shippedIn: null
unitIds:
  - command.agents-providers-assistant
  - service.agents-providers-slack-assistant
  - adapter.agents-providers-assistant-slack-media
owner: null
reviewedAt: null
---

# Slack project assistant

Harness answers Slack mentions in configured channels and one-to-one messages from the bound workspace. The BuildFlexity profile uses the existing Slack app and recognizes #qa and #dev. Ordinary questions get read-only tools for the linked GitHub repository, project Tracker items and run states, HTTPS health checks and the current allowed Slack channel's recent history. The assistant links GitHub Actions jobs so readers with access can open their logs. Task-specific answers should cite the sources returned by the tools. Provider-hosted application logs and Slack history outside the current channel require separate scoped sources.

Configured writer IDs can explicitly request “Create a GitHub issue …”, “Create a Tracker item …” or “Launch a Tracker item …”. All other messages use read-only tools. Repository mutations are limited to issue creation and the separate QA thread link-back. Deployments, merges, branch changes and credential reads are outside the tool set.

## Configuration on Daniel’s primary Mac

Run the offline check from the pinned Harness checkout.

```sh
bun run dev -- assistant check --config specification/examples/buildflexity-slack-assistant.json
```

Use a project-owned, private credential directory provisioned by the approved secret-safe runner. The expected files are `slack-bot-token`, `slack-socket-token`, `github-app-key.pem` and `anthropic-api-key`. The assistant accepts regular files owned by the service user with no group or other permissions. Keep this directory outside the checkout. The runner uses the local Tracker spoke and supports an explicit Tracker executable path.

The Slack bot requires `chat:write`, `app_mentions:read`, `im:history` with App Home messages enabled, and `channels:history` or `groups:history` for history in the relevant channels. Subscribe to `app_mention` and `message.im`. The app-level Socket Mode token requires `connections:write`. Grant `canvases:write` for canvas actions and `files:write` for video. Join the configured channels before enabling the runner. Verify that the installed app displays **BuildFlexity** and describes general project Q&A and staging QA. GitHub App installation tokens are bound to the configured repository with Contents, Pull requests, Actions, Checks and Issues read access. Issue writes use a separate Issues-write token.

[Slack direct-message event](https://docs.slack.dev/reference/events/message.im/) · [Slack canvas access](https://docs.slack.dev/reference/methods/canvases.access.set/) · [Slack file completion](https://docs.slack.dev/reference/methods/files.completeUploadExternal/) · [GitHub check runs](https://docs.github.com/en/rest/checks/runs)

## QA and canvas

The canvas reads Markdown files from one pinned commit of the configured branch on each refresh, strips QA video blocks and links outside the allowed origins, and grants read access to the configured channels. The assistant can link the canvas from those channels. QA threads carry the generated checklist inline with the video. BuildFlexity runbooks come from `dev:docs/qa/runbooks` and are published to #qa. Verify that Jessel can open the shared canvas from her Slack account and has read access.

Enable QA thread creation only by passing both `--qa-since <UTC timestamp>` and `--qa-recipe <absolute module path>`. Use the exact cutover timestamp, with the old worker already stopped, and reconcile any issue that fell in the cutover gap. The sample lists the seven previously verified BuildFlexity QA parent issues. Refresh `qa.existingThreadIssues` against Slack immediately before the switch so relabeling an issue that already has a thread cannot create another parent. Keep the durable `~/.harness/assistant/buildflexity` state across restarts. The module exports `planQaRecording` using the interface beside `assistantQaRecorder.ts`. It must use a disposable staging account, assert visible behavior in the recipe, and reset test state. The module is local, reviewed code. GitHub text and model output are checklist data. The recorder uses Harness's native Playwright video service and attaches the MP4 with the checklist to the parent message.

The QA runner checks the Cloudflare Pages installation's successful check for the exact staging branch SHA and the staging health service, then verifies that the fix is an ancestor of that SHA. The runner polls for matching GitHub label events. It reserves each issue before Slack posting and records the parent timestamp. When a delivery result is ambiguous or a link-back fails, use the ledger and #qa to reconcile manually before attempting another post. The separate `harness qa-sync` integration continues to handle approvals, retest requests and Slack replies.

## Switch and rollback

Get Daniel’s approval for switching the live app to the primary Mac and retiring **BuildFlexity Coder** after acceptance. Prepare the pinned Harness checkout, credential bindings and recording recipe before the switch. Preserve the existing Google worker service and its configuration for rollback and record its current state. Reuse the existing Slack app identity. Two consumers on the same Socket Mode app can split event delivery, so confirm that the Google worker has stopped and cannot restart automatically before starting the Mac runner.

Exercise the new bot in #qa, #dev and a DM. Check a project question with a GitHub source, a Tracker question, staging and production health, a canvas link Jessel can open, and a real newly eligible QA label that produces one parent, checklist, playable recording and issue/Tracker backlinks. Confirm that an ordinary member's create request leaves the repo and Tracker unchanged. Record the deployed Harness revision and observe that the old responder is quiet before retiring it. If an acceptance check fails, stop the Mac runner, verify it disconnected and restore the previous Google worker. Reconcile deliveries using the Mac ledger and Slack before re-enabling automatic QA posting.
