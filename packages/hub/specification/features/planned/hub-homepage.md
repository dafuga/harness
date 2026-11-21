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

The page is `src/components/public-site/HomePage.svelte`, rendered by `src/routes/+page.svelte`. Download links come from `src/configs/public-site/homeDownloadConfig.ts`; `src/utils/public-site/publishedDownload.ts` confirms the Mac archive.

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
- Projects use the signed-in member's Hub projects and the project's authorized catalog
  and commit history.
- Work in progress orders open tasks by due date. By project uses the existing overview
  and only includes done projects when Show done is selected.
- Quota shows provider-reported remaining allowance, reset times, stale readings, and up
  to seven days of observations. Low means below 25 percent and Almost out means below
  10 percent. These are display warnings.
- Empty and loading views keep the section structure. Busy views clamp previews and long
  titles. Owner data is cleared when the verified account changes.

### Owner-host data

The signed-in Projects card and dialog use the existing per-member project APIs. Tracker chat
and provider details require the existing configured overview owner and a verified native
connection, with `HARNESS_HUB_HOME_PUBLISH=1` on the desktop that reads Tracker. Previously
configured overview publishing continues to work independently. The new Hub chat table is
created by migration `0005-hub-home-chat.sql`. Messages expire after two minutes if no native
publisher claims them. A claimed message with an ambiguous result is shown as unconfirmed.

Codex reads subscription limits from the signed-in local Codex app server on the owner desktop.
The app retains up to seven daily readings of weekly allowance. These readings describe the
subscription balance and reset times. For other subscriptions and Claude cloud routines, the
desktop accepts normalized display data from an owner-managed JSON file named by
`HARNESS_HUB_HOME_PROVIDER_FILE`. The file contains `routines` and `quota` arrays or null for
an unavailable source, and must be readable by the owner desktop. The supported fields are
defined by `homeProviderPayload.ts`. Only display metadata belongs in the file. Provider items
are read about every five minutes and quota readings older than one hour are shown as stale.

Claude Code documents interactive scheduled-task listing and its usage page. An automated feed
for personal Claude cloud routines and subscription windows still needs a supported owner-host
source. Empty and unavailable states remain distinct. Low and almost-out states warn on the
page without changing agent scheduling.
