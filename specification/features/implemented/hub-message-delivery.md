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
- The computer that owns the pane types it in, only at an empty prompt: Chief of Staff's `cos`
  pane on the Chief of Staff computer, or the run's own pane on the run's computer. A run that has
  ended, been replaced or belongs to another item is refused and the message is never sent to a
  different session. Pane text is one line and never starts with `/` or `!`.
- Receipts, each a Tracker note keyed to the message id: stored, delivered (the prompt showed the
  message submitted) and acknowledged (the session replied). A refusal says why.
- The session answers with `tracker reply <message id> <text>`; the delivered text says exactly
  that. The reply shows under the message in the Hub thread. The Hub re-reads every 3 s for 5
  minutes after a send.
