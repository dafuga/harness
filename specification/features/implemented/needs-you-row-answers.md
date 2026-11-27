---
status: implemented
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Needs-you rows answer in place

Daniel, 26 Nov 2026. Replaces the 25 Nov layout rule that kept answer controls off the overview.

- Hub Home, the Mac app and the iPhone app: every "Blocked - needs you" row shows its 2-4 options
  (recommended first) and "Other". "Other" opens a modal; no reply field sits in a row. The rest of
  the row still opens the asking session's chat, which offers the same choices.
- Hub Home uses one-line option chips with a small Recommended badge. Explanations and
  attachments are available in the asking session’s detail. Other opens the answer dialog.
  Confirmation opens a dialog with the selected option and its explanation.
- HTTP and HTTPS addresses in Hub item titles, questions, options, and notes open as links in a
  new tab. Long URLs wrap. A link in a question or choice is independent of the item and answer
  actions, with the same behavior in shared detail views.
- A tap is a Tracker answer by Daniel, so the owner is notified as for any answer. Deploy, money
  and secret asks keep their confirm step (Face ID on the iPhone).
- Mac and iPhone rows answer the revision they show. A replaced question is refused.
- Hub web sends the answer to a linked Mac that showed the ask, over the end-to-end encrypted
  device connection (`homeChat`). The Hub does not read or store it, so it works with the Home
  upload off. With no such Mac, the earlier Hub queue is used. It is never tried after a Mac may
  already have received the answer.
- `homeChat` writes only what the Hub queue could: an answer to an open structured ask, or a note on
  a listed agent's current item, checked against the Tracker at the time of the write.
