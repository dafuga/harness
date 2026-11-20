---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Feature: Project Overview

## Overview

One page in Harness with a card per project, so Daniel sees at a glance what is being worked on and what is waiting on him. It is fed by the tracker data and is part of merging the tracker into Harness (tracker item m8fkcj). The approved design (tracker item n79x63) is implemented in tracker item xm64q4.

Design for review: https://claude.ai/artifact/SKiYRVdFAv9zRVGqc4so7Y (private to Daniel). It holds five boards: desktop dark, desktop light, phone dark, phone light, and a sheet of the five card states in both themes. Sample content is a tracker snapshot from 2026-11-20 20:41 Lisbon, shortened.

The dark boards use the shared values in `packages/reports/src/lib/styles/app-tokens.css` (background, surface, border, text, primary, info, success and error roles, Inter, panel and control radii) and the current navbar with a new Projects category. Harness has no light theme today: the light boards are a proposal derived from the same roles. Primary is reserved for "needs you", the brand mark, the current nav item and focus rings.

## Card states

A project has exactly one state, picked in this order:

1. Needs you (waiting on Daniel): at least one item is flagged for Daniel and not answered or ignored. The question sits on the card with an Open item action.
2. Blocked: one or more items are blocked and no session is live. The newest blocked reason sits on the card.
3. Active: a session is live, or an in-progress item changed in the last 24 hours. Blocked items show as a count with one reason, not as the state.
4. Quiet: open or in-progress items, but no live session and no change for 24 hours. In-progress items left untouched are labelled stale.
5. Done: every included item is done and the most recent completion was within seven days.

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

## Future Enhancements

- Project detail page behind "Open project".
- Per-project hide and ordering.
