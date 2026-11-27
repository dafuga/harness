---
status: implemented
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Tracker due scheduling

A due task launches at its due time. The due scheduler is on unless the host launch
configuration sets `due` to `false`; the global automatic-launch switch still turns it off.

- The existing limits apply: the host session cap, two automatic launches per minute, and no
  automatic launch from 22:00 to 08:00 Europe/Lisbon. Waiting work queues, urgent first and
  then oldest due.
- Only open tasks launch. Plans, reminders, blocked, parked, opted-out and recurring items,
  production deploys, unanswered asks, and personal or Chief of Staff agents never do.
- A task runs on its own computer. The hub authorizes a spoke's launch once the spoke has
  pushed its request.
- `tracker block` records the dependency only. It never asks Daniel; use `tracker flag` for a
  real question.

`tracker autolaunch dry-run` lists what is due and why each item would or would not launch.
