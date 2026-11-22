# Hub home: design against the built app

Each PNG puts a design screen (left, from `../screens`) beside the built app (right), captured by
`packages/hub/tests/e2e/hub-home.spec.ts` with `TAKE_SCREENSHOT=true` and the same synthetic
fixture data. All 146 design screens were compared at 390, 834, 1440 and 1920 wide; these are the
screens the gap fixes changed most.

## Gaps closed (tracker bcy1n6)

- Empty cards use the overview's quiet panel, the design's sentence and one next step (Connect a
  computer, Connect a subscription, Start a plan, Schedule a task, Add a project). Before, they
  drew a dark dashed outline.
- Avatars use the first and last initials ("Chief of Staff" is CS, not CO).
- The Quota card counts low limits in a state pill ("5 running low") and shows one Almost out
  callout with the limit, what is left and the reset.
- The Quota dialog counts subscriptions ("2 subscriptions · 1 running low"), gives each one an
  OK, Low or Almost out pill and border, names the reset clock and countdown, and ends with an
  Add a subscription tile.
- A yes-or-no question offers quick replies (Approve / Not yet, or Yes / No) that answer on
  Tracker. On a phone the chat step's header names the agent.
- The Plans, Scheduled and Projects dialogs summarise their counts, schedule days carry the
  weekday ("Mon 23 Nov"), and plan statuses use the overview's state pills.

## Differences kept on purpose

- **Warn me at 25% left** is not built. What a warning does (notify, hold or move work) is still
  open question 8 in `../README.md`.
- **New plan** and **Schedule** dialog buttons are not built. Plans and scheduled runs are read
  from Tracker and Claude routines; Hub has no place to create them yet.
- Scheduled filters are **Tracker** and **Claude routines** (the two sources) rather than
  Routines, One-off and Paused.
- Work in progress rows show project and status, not a separate agent: in Tracker data the agent
  of a work item is its project card.
- The callout does not say "Agents on it pause until the reset", because nothing pauses them yet.
