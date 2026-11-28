---
status: planned
---

# Hub Home live overview

Tracker item `emeep5kyvr` · part of `dzmj43vga7` · Hub web and the Mac app that answers it

Hub Home shows every Tracker project, session and run, on a desktop and a phone browser.

## Source

The overview is part of a linked Mac's `homeSnapshot` answer over the end-to-end encrypted device connection. Computers that sync with the Tracker hub have their runs in it without being linked themselves. It is never uploaded or stored on the Hub: the uploaded Home snapshot is built without it, and the parser for the stored Home drops it. Hub, Pages and R2 settings for the plaintext Home upload stay off.

When several linked computers answer, the overview holding the newest Tracker change is shown whole. Overviews are not added together, so a run that has ended cannot return from a computer that is behind.

## What is shown

- Each listed project shows Running, Blocked and Not running counts in its collapsed header.
- One card for each live run, and one for each task in motion without a live run: in progress, waiting to start, or ended within the last day.
- Cards show a two-line title, state chip, model, computer and time since the last update. The responsive grid shows five columns on desktop, two on tablet and most phones, and one on narrow phones.
- Selecting a card opens the full title, run outcome, planning stage, task status, owner, timing and latest note. Links in the title and note are clickable in the detail.
- The planning stage is the one Tracker records (see Tracker planning stages). It is never derived from status. A Tracker that reports none reads "Stage not reported".
- Private and ignored items are never described. Their live runs are counted in one line.
- Open and blocked tasks without a running session appear under their project’s job disclosure. A project lists up to 100 rows and says how many were left out.

## Computers on Home

Hub web and Harness Mac Home use the shared computer header to show active Tracker agent
sessions on each computer. The online primary Mac appears first, followed by other online
computers by name, then offline computers by name. The same order applies to the shared
Project Overview computer strip. Runs are identified by their origin computer and run number.
Tracked work delegated to a second computer also counts there, once per run even if it holds
multiple leases. Finished and
queued runs do not count. Private runs can contribute to the count without exposing their titles.

Selecting a computer opens a read-only detail with available and total RAM, one-minute load and
core count, estimated spare cores, startup disk space, and the sessions using that computer.
The header and detail use the status and reasons from the same Tracker reading. An offline
computer has no current resource reading. Earlier Trackers may report delegated work
as a count only. Historic completed-item totals are omitted from project rows and retained in
the source counts. The separate iPhone landing page does not mount the computer header. Its
shared project summaries follow the same count rule.

## Freshness and empty states

Linked computers are asked on every 20 second turn while the page is visible, including while change notices are connected. The section states how many linked computers answered and when the answer was read.

With nothing current to show, the section says which of these is true: still reading, the list of linked computers could not be read, no computer is linked, no linked computer answered, the Mac could not read Tracker, or the Mac app predates the overview. It shows no rows in any of them, so an old reading never looks live.

## Release

The Hub and the Mac app both need this change. A new Hub with an older Mac app asks for the Mac to be updated.

## Home placement

Live overview is the last section on Hub Home, below Needs you, Chief of Staff, computers and quota.
Mac Home uses the same job cards below its priority sections. The iPhone landing page has its own
layout. Every project group starts collapsed and can be expanded independently. Offline computers and failures reading the live connection appear in a
compact banner above the Home heading.

By default, the overview lists only projects with a running session. “See all projects (N)”
shows the remaining projects in two groups, “Blocked or open” followed by “Nothing in motion”.
N is the total number of projects in the snapshot. Each project header shows its Running,
Blocked and Not running counts. Opening a project lists running jobs first. Its own “See all”
control reveals blocked and other jobs.
