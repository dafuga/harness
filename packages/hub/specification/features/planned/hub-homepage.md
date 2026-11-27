---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Feature: Hub Homepage

## Overview

The Hub root is the public front door of Harness for signed-out visitors. It says what Harness is and who it is for, how a change moves from spec to proof, and where to download the Mac app. Its Log in control opens `/projects`, where Google sign-in and the authorized project cards live.

The page is `src/components/public-site/HomePage.svelte`, rendered by `src/routes/(public-site)/about/+page.svelte`. Download links come from `src/configs/public-site/homeDownloadConfig.ts`; `src/utils/public-site/publishedDownload.ts` confirms the Mac archive.

## Acceptance Criteria

- `/` shows the hero, how it works, why Harness and the download section to signed-out visitors. It holds no sign-in panel and no project list; besides the sign-in status it asks only whether the Mac archive is published.
- Log in in the header, hero and footer links to `/projects`.
- On each visit the page sends a same-origin `HEAD /downloads/Harness-mac-arm64.zip` without credentials or redirects. Only a 200 answer of type `application/zip` turns Download for Mac into a download link to that path; any other answer, a redirect or a network failure keeps the pending state: the hero link to the download section and the disabled download-section button both read exactly "Mac app coming soon", and the button is described by the note that the build is being prepared. A published archive reads "Download for Mac". Publishing the release switches the link on without rebuilding the site.
- The iPhone app shows Coming soon until a verified store address is set as `ios`.
- The page follows the visitor's light or dark scheme. Dark uses the shared Harness palette; light is mixed from the same catalog tokens. Body and hero text keep at least WCAG AA contrast in both.
- From a 390px phone to a desktop the page never scrolls sideways. The hero sits beside its example loop and the steps share a row from 900px; below that they stack.

## Future Enhancements

- Link the iPhone app once a verified store address exists.
- Prerender the public homepage so its first paint does not wait for the sign-in status.

## Signed-in Hub home

A verified browser session sees Home at `/`. Signed-out visitors see the public homepage.
Home follows the OS color scheme and uses the approved design in
`specification/designs/hub-home`.

- The six cards preview Agents, Quota, Plans, Scheduled, Projects, and Work in progress.
  Each opens its own dialog and contains a bounded preview on phone, tablet, laptop, and wide.
- Agents group by state. Chat uses the agent's current visible Tracker item, with an explicit
  answer action for an open question. A phone uses separate list and chat steps.
- Plans are Tracker plan items. Progress and next steps come from their child items.
- Scheduled combines Tracker due dates and Claude scheduled routines. Box cron is deferred.
- Projects use the signed-in member's Hub projects and their authorized catalog and commit
  history. When Shared Projects cannot be read, the configured owner can see the already
  authorized, fresh Tracker projects and open Project Overview. A failed first read ends
  loading, and the Projects dialog can retry. A successful shared list takes precedence.
- Work in progress orders open tasks by due date. By project uses the existing overview
  and only includes done projects when Show done is selected.
- Quota shows provider-reported remaining allowance, reset times, stale readings, and up
  to seven days of observations. Low means below 25 percent, Almost out means below
  10 percent and Out of quota means nothing is left. These are display warnings.
- The header has one quota pill per subscription, Claude first, with its 5-hour and weekly
  room left. A used-up limit names its reset day and Lisbon time instead. A provider with no
  reading from the last hour says its usage is unknown. Hover or tap explains each limit.
- Empty and loading views keep the section structure. Busy views clamp previews and long
  titles. Owner data is cleared when the verified account changes.
- When the verified owner has no usable Tracker snapshot, Home asks them to open Harness on
  their Mac and sign in with the same Google account. The existing refresh shows fresh data
  when it arrives. An account without owner access receives no owner data or linking prompt.

### Live sessions from linked computers

Signing in is enough. Home asks every online computer linked to the signed-in Google account
for its Home view (running agents and sessions, plans, schedule, quota) over the same
end-to-end encrypted device connection as Devices, with no click and no stored copy on the
Hub. The Mac answers the read-only `homeSnapshot` wire method, and takes Home's answers and
notes through `homeChat` (see `specification/features/implemented/needs-you-row-answers.md`). Each browser keeps one device
key pair per computer, so a reload is the same device and adds no new one. Views from several
computers are merged: work the Tracker syncs between them appears once. The headline counts
running sessions. Quota stays Unknown until a computer reports it. `Connect a computer`
appears only when the account has no linked computer. The owner snapshot below remains a
fallback.

While Home is visible and the account remains signed in, it re-reads the stored Home,
linked computers and Hub projects every 20 seconds, including when the live socket
stays connected without a Home change notice.

### Scheduled shows only the future

Scheduled lists only runs whose time is still ahead. Work whose time has passed is Running,
Queued with its launch position (urgent first, then oldest due) or Blocked with a reason. It
appears in Work in progress, and what has not started sits under "Past due, not started".
A due time on in-progress or blocked work is an ETA, not a scheduled start. Past and future
work are bounded separately. Hub applies the same rule to a published run whose time passes
later, and to snapshots from older Mac apps. Personal and family agents, including the Chief
of Staff's list, never appear in Scheduled or in past-due work. Hub shows no line about Claude
routine dates when it has no current reading of them.

### Release acceptance for live counts

For each Hub Home release, compare the signed-in Agents card's working session total with
live Tracker runs on the online linked Macs. Include any synced Mac whose runs the
release is expected to show. The Agents card can group several runs under one working agent.
Require a stable sample with at least one eligible running session and exact count parity.
A zero working count during that sample fails the release check.
Record this result beside the Needs you answer canary on the same release item.
Both checks must pass before closing a release that changes Home counts or their data sources.
Follow the [post-release gate](../../../README.md#post-release-gate).

### Owner-host data

The signed-in Projects card and dialog use the existing per-member project APIs. Tracker chat
and provider details require the existing configured overview owner and a verified native
connection, with `HARNESS_HUB_HOME_PUBLISH=1` on the desktop that reads Tracker. Previously
configured overview publishing continues to work independently. The new Hub chat table is
created by migration `0005-hub-home-chat.sql`. Messages expire after two minutes if no native
publisher claims them. A claimed message with an ambiguous result is shown as unconfirmed.

The owner desktop reads the Claude and Codex quota and Claude routine dates from a single
owner-managed JSON file. Set `HARNESS_HUB_HOME_PROVIDER_FILE` to its absolute path on the
same computer as the verified native connection. The file is read about every five minutes.
Replace it atomically when updating it, and keep its permissions restricted to the owner.
Only display metadata belongs in this file. A later collector can update the same format.

```json
{
	"routinesReadAt": "2026-11-22T08:00:00Z",
	"routines": [
		{
			"id": "morning-review",
			"title": "Morning review",
			"at": "2026-11-22T09:00:00Z",
			"agent": null,
			"machine": "Claude cloud",
			"source": "claude",
			"recurring": true,
			"paused": false
		}
	],
	"quota": [
		{
			"id": "claude-personal",
			"provider": "claude",
			"plan": "Max",
			"account": null,
			"readAt": "2026-11-22T08:00:00Z",
			"limits": [{ "id": "weekly", "label": "Weekly", "left": 47, "resetsAt": null }],
			"credits": null,
			"history": [{ "day": "2026-11-22", "used": 53 }],
			"agents": []
		},
		{
			"id": "codex-personal",
			"provider": "codex",
			"plan": "Pro",
			"account": null,
			"readAt": "2026-11-22T08:00:00Z",
			"limits": [
				{ "id": "weekly", "label": "Weekly", "left": 81, "resetsAt": "2026-11-26T13:00:00Z" }
			],
			"credits": null,
			"history": [],
			"agents": []
		}
	]
}
```

Use UTC ISO 8601 timestamps ending in `Z`. History dates use `YYYY-MM-DD`. Percentages
range from 0 to 100. Use stable identifiers for routines, subscriptions, and limits. The
file may contain up to 200 routines and 20 subscriptions, with up to 10 limits, seven history
entries, and 10 agent descriptions per subscription. Agent entries have `name` and
`description` strings. `null` means unknown, while an empty array indicates a verified
empty list. Set `routinesReadAt` whenever supplying a known routine list. The validator is
`homeProviderPayload.ts` in Reports. Invalid or unreadable files are treated as unknown.

Hub shows unknown for missing or stale provider data. Routine freshness comes from
`routinesReadAt` and quota freshness comes from each subscription’s `readAt`. A missing
timestamp, a timestamp in the future, or a reading over an hour old is unknown. The scheduled
view still includes current Tracker due dates. Stale quota does not contribute numbers,
history, or warnings. Low and almost-out warnings are informational.
