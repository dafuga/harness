---
status: planned
shippedIn: null
unitIds:
  - desktop.page.projects
  - reports.page.harness-projects
  - reports.endpoint.api-project-overview
  - reports.component.projects-sessions-project-overview-project-overview
  - reports.module.projects-sessions-project-overview-read-project-overview
owner: null
reviewedAt: null
---

# Feature: Project Overview

## Overview

One page in Harness with a card per project, so Daniel sees at a glance what is being worked on and what is waiting on him. It is fed by the tracker data and is part of merging the tracker into Harness (tracker item m8fkcj). The approved design (tracker item n79x63) is implemented in tracker item xm64q4.

Approved design: https://claude.ai/artifact/SKiYRVdFAv9zRVGqc4so7Y (private to Daniel). It holds five boards: desktop dark, desktop light, phone dark, phone light, and a sheet of the five card states in both themes. Sample content is a tracker snapshot from 2026-11-20 20:41 Lisbon, shortened.

The dark boards use the shared values in `packages/reports/src/lib/styles/app-tokens.css` (background, surface, border, text, primary, info, success and error roles, Inter, panel and control radii) and the current navbar with a new Projects category. Harness has no light theme today: the light boards are a proposal derived from the same roles. Primary is reserved for "needs you", the brand mark, the current nav item and focus rings.

## Card states

A project has exactly one state, picked in this order:

1. Needs you (waiting on Daniel): at least one item is flagged for Daniel and not answered or ignored. The question sits on the card with an Open item action.
2. Blocked: one or more items are blocked and no session is live. The newest blocked reason sits on the card.
3. Active: a session is live, or an in-progress item changed in the last 24 hours. Blocked items show as a count with one reason, not as the state.
4. Quiet: no live session or recently updated in-progress item. Open work that has not started is quiet. In-progress items left untouched for more than 24 hours are labelled stale.
5. Done: every included item is done and the newest update to a completed item is within seven days. The tracker exposes an update timestamp for these items.

State is never shown by colour alone: each badge has its own shape and a text label.

## Page layout

- The headline states the count that needs Daniel; below it, project and live-session totals and one pill per computer (ok, busy, overloaded, offline).
- Filter chips: All, Needs you, Blocked, Active, Quiet, Done, each with a count.
- Bands in order: Needs attention (needs you, then blocked), Active, Quiet, Done.
- Desktop: three full cards per row; Quiet and Done use four compact cards per row.
- Phone: full cards show the question or blocked reason, the top in-progress item and the last milestone; Quiet and Done collapse to one row per project.

## Tracker data behind each card part

- Project: the item `agent` field.
- Live sessions: runs in state running, joined with the agent sessions each computer reports.
- In progress and ETA: items with status `in_progress`; live runs first, then by `due`. ETA is `due`; past `due` reads "Overdue"; no `due` reads "No ETA".
- Needs you: `needs_daniel` true and `resolved` false; text from `question`, falling back to `blocked_reason`.
- Blocked: status `blocked` with `blocked_reason`.
- Last milestone: the newest `notes_log` entry across the project's items, with its time.
- Counts: items per status for the project.

## Acceptance Criteria

- The page is reachable in the native renderer and the Harness Explorer website. Both read the tracker local to their host, with unavailable and empty states.
- The read boundary uses only fixed local GET operations. Cards and item details expose only the fields they display, excluding sensitive items, callbacks, runtime paths and credentials.
- The build reproduces the five states and both widths from the boards, using the shared style roles and no new colour literals.
- Text contrast is at least 4.5:1 and phone touch targets are at least 44px.
- Desktop, tablet and phone captures cover the declared states with synthetic tracker records, including a working read-only item detail.

## Approved decisions

- Each tracker `agent` value represents one project, including non-code areas.
- Quiet starts after 24 hours. Done remains visible for seven days.
- The first build is read-only and offers Open item.
- Use the existing dark theme.

## Hosted and paired acceptance

Daniel approved the same read-only cards for the hosted Hub, Electron, local Explorer and paired iOS. Release authorization applies to this Hub website change. Electron and iOS acceptance uses an owned desktop and an approved device or native acceptance fixture.

- The local tracker authority and its fixed GET operations stay on the computer. An expressly enabled Electron background publisher reads the same filtered snapshot as its local cards. It uses the existing Hub session, verified HTTPS origin and secure credential storage. It stops on disconnect, sign-out or application shutdown. A disconnected tracker produces an unavailable snapshot. No browser action can publish or mutate tracker items.
- Hub exposes the exact path `/api/tracker-overview`. The server binds every operation to a current verified session matching the configured Daniel actor ID. The actor ID is the canonical Hub identity derived from the verified Google issuer and subject. No email or project membership confers access. Missing configuration, another actor, or a project-scoped token cannot read or publish. The cache key is server-owned and private.
- `GET` accepts the existing browser cookie or native bearer session. It returns the display-only `OverviewSnapshot` and `Cache-Control: private, no-store`. It takes no query or request body. An authorized owner sees unavailable if the publisher or tracker has no current snapshot. A snapshot received more than 90 seconds ago is unavailable. The page never displays saved data from a prior account or pairing.
- `PUT` is a separate native publisher operation for the exact path. It requires a valid owner native bearer credential and never accepts a browser cookie. It accepts an explicitly bounded `OverviewSnapshot` JSON document and returns `204` on success. The server rebuilds the display projection, rejects unexpected keys and invalid shapes, redacts recognized credentials, and stamps reception using the server clock. No raw tracker payloads, callback commands, filesystem paths, tracker sync keys or credentials cross the network. Authorization is checked before payload parsing or storage. No response, log or evidence contains credentials or original tracker text used for secrets tests.
- The hosted page uses the established signed-in Hub shell and the existing overview renderer. An eligible owner can navigate to it from the Hub. Verify loading, ready, empty, unavailable, signed out, denied and account-switch states, and the read-only item detail at desktop, tablet and phone widths.
- Paired iOS uses its existing Hub account to read the same owner-only endpoint through a fixed native GET. The project overview is offered while the paired connection is online and the account is eligible. Credentials and request origin stay in native Keychain-backed code. Loss of pairing or account invalidates in-flight responses and clears visible rows. Existing paired project grants, relay protocol and tracker mutation permissions are unchanged.
- Each of the API, hosted page, desktop publisher, native iOS HTTP admission and paired renderer units requires independent focused tests and screenshots from an integrated committed build. Service/API screenshots show the consuming surface and its own exercised state. Synthetic owner, unauthenticated, non-owner, expired, revoked, malformed, credential redaction and stale fixtures are used for browser evidence. Production acceptance requires an owner-approved read of fresh live data and a denied non-owner or anonymous read, with private tracker text omitted from retained evidence.

## Future Enhancements

- Project detail page behind "Open project".
- Per-project hide and ordering.
