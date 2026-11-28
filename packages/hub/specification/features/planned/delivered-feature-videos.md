# Delivered feature videos

A project’s Tracker overview shows its feature deliveries newest first. Each entry has a title, delivery date, dev/staging/live stage and an inline player. The list appears on the project’s existing overview and does not add a Reports tab.

## Delivery

- The feature author supplies a checked-in Playwright walkthrough for the built app. It runs headless with an isolated fixture when a real operation would spend money or take substantial time. The fixture identifies itself on screen with a visible MOCK badge.
- The feature delivery command records the walkthrough, validates a playable 20–60 second clip and uploads it to the private Reports R2 evidence store. It attaches the authenticated playback link to the Tracker item's build artifact while keeping its existing planning notes and links.
- The command records the same link in the Tracker done note. For an already-completed item or another release stage it can attach evidence without changing the item's completion state.
- The Hub only lists an entry after Tracker has accepted completion or the item was already done, and only when the referenced clip is available. Each project listing reads its own records through the owner-authenticated Hub API.

## Acceptance

- Focused tests cover the delivery order, validation and failure behavior, and Hub sorting, playback and project scope.
- A headless acceptance run records a real built-app walkthrough, attaches its evidence to an isolated Tracker item and plays the clip on the project overview.
- Backfill this week's Harness feature deliveries. Preserve their original delivery dates and inspect extracted frames before attaching evidence.
