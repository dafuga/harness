---
status: implemented
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Hub messages reach the session

Daniel, 26 Nov 2026 (esqhv8, part of dzmj43). Replaces the overview rule that kept every input off
Home for one field: the Chief of Staff chat box.

- Hub Home has a "Message Chief of Staff" box: the latest messages with their receipts and replies,
  and one field. Chief of Staff is always reachable, with or without a current Tracker item.
- Each session's "Message" button opens its chat, which sends to that session's one live run,
  named as `<computer>#<run>`. A session without a live run can only take a Tracker note.
- The Hub hands a message to a linked Mac over the end-to-end encrypted device connection
  (`homeChat`, kind `message`), so it works with the Home upload off. The Mac stores it in the
  Tracker (`POST /messages`) as a note on its thread item: Chief of Staff's "Hub chat with Chief of
  Staff" item, or the session's own item.
- Chief of Staff messages go through the hub's Chief of Staff notification channel, the same
  destination the digest and needs-Daniel alerts use (else the Chief of Staff callback), as event
  `hub_message` with idempotency id `hub_message|<message id>`. They never depend on a tmux pane.
  A busy channel leaves the message stored with the reason ("Not delivered yet: ...") and retries;
  no channel refuses it: "Not delivered: Chief of Staff channel not configured".
- A session message is typed in by the run's own computer, only at an empty prompt of that run's
  pane. A run that has ended, been replaced or belongs to another item is refused and the message
  is never sent to a different session. Pane text is one line and never starts with `/` or `!`.
- Receipts, each a Tracker note keyed to the message id: stored, delivered (the channel took it,
  with its attempt id, or the prompt showed it submitted) and acknowledged (the session replied).
  A refusal says why.
- The session answers with `tracker reply <message id> <text>`; the delivered text says exactly
  that. The reply shows under the message in the Hub thread. The Hub re-reads every 3 s for 5
  minutes after a send.
