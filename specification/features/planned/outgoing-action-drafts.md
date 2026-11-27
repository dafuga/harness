# Outgoing action drafts

When Daniel asks Chief of Staff or a Harness session to contact someone or publish
something on his behalf, the session creates a Tracker draft. Daniel reviews the
exact message and sending account in Chief of Staff chat on Hub, Mac, or iPhone.
Send approves that version and submits it through the selected account. Discard
ends the draft. Both outcomes stay in the conversation and Tracker history.

## Card and editor

| State          | Hub web                                                                                                                                                                                                                                                          | Mac app                                                                                                                                          | iPhone                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Draft          | In the bottom-right Chief of Staff chat overlay. A channel icon and sending account identify the sender. Subject, linked “In reply to,” To/Cc and a short body preview follow. Edit opens the full draft. Discard and the primary Send button sit in the footer. | The same shared card inside Chief of Staff chat from Desktop Home or Tracker Work. Long addresses wrap and Edit keeps the conversation in place. | The same card in full-screen Chief of Staff chat. Metadata wraps, body text is capped, and Discard and Send remain reachable with touch. |
| Edit           | A dialog opens with the full body, applicable recipient and subject fields, the sending account and reply context. Save changes updates the draft. Cancel closes the dialog.                                                                                     | Open the same editor in an app modal with keyboard focus returned to the draft card on close.                                                    | Open a sheet over chat with keyboard-safe scrolling and visible Save changes and Cancel controls.                                        |
| Sending        | Keep the card visible, show Sending and disable its controls while the outcome is pending.                                                                                                                                                                       | Same state, including after reopening Tracker Work.                                                                                              | Same state, including after leaving and returning to chat.                                                                               |
| Sent           | Replace controls with Sent and the provider receipt link when supplied. Keep channel, account and message preview in the conversation.                                                                                                                           | Same receipt and keyboard-accessible link.                                                                                                       | Same receipt and tappable link.                                                                                                          |
| Discarded      | Replace controls with Discarded and keep the summary in the conversation.                                                                                                                                                                                        | Same outcome on refresh and app restart.                                                                                                         | Same outcome after reopening chat.                                                                                                       |
| Delivery issue | Show a short reason. Retry is available only when the provider confirms it did not accept the message. For an uncertain result, show Delivery unconfirmed while Tracker reconciles it.                                                                           | Same state and available action.                                                                                                                 | Same state and available action.                                                                                                         |

The card uses the existing chat typography, button roles and spacing. It has no
inline fields. Edit is a compact header action. Focus returns to the card after
closing the editor. Provider links use verified HTTP(S) URLs, wrap, and open
safely. For channels without a subject, Cc, or a reply, omit those rows. Show the
destination for posts in the To position. Label provider delivery without a
link as Sent and show the provider reference in Tracker. Use synthetic content
in screenshots.

## Tracker and delivery

1. Persist a typed record with draft ID, creating actor, task and conversation
   references, channel, sending account, recipients, subject, thread reference,
   body, revision and draft/sent/discarded status. Record who edited, approved
   or discarded it and when. Scope reads to authorized participants and Daniel.
2. Expose draft creation and readback to authorized sessions through Tracker API
   and CLI. Use an authenticated Daniel-only API for Edit, Discard and Send.
   Create never triggers provider delivery. Derive actors from authenticated
   identities and keep outbound credentials with the delivery executor.
3. Bind approval to the displayed revision. At the hub, reserve that revision
   durably before calling a provider. Parallel approvals, edits, discards and
   replays must never result in a second delivery. A stale card reloads the
   current revision. Disable approval during hub outages. Persist a provider
   receipt and Tracker history together. Reconcile uncertain outcomes before
   retrying. Approval and discard history contains references and outcomes, with
   message bodies visible only through authorized draft reads.
4. Route Gmail replies by authorized account and native thread ID with the
   provider's reply headers. Route Slack DMs and threaded replies by workspace,
   conversation and message ID. Bind SMS/iMessage, Telegram, GitHub comments and
   posts to their configured sender and validated destination. Make unsupported
   account/channel combinations unavailable before approval. Inventory and
   replace direct on-behalf send paths in Chief of Staff and Harness sessions.
5. Project the records into the shared Chief of Staff chat. Preserve drafts and
   their outcomes on refresh and across devices, independent of the transient
   cap on visible chat messages. Keep operational alerts outside this flow.

## Acceptance and rollout

- CLI/API proof covers creation and readback, account and recipient validation,
  authenticated actor checks, revision conflicts, restart durability, concurrent
  sends, discard racing send, provider failures and redacted receipts.
- The same declared product cases reach Draft, Edit, Sending, Sent, Discarded
  and delivery issue in the actual renderers. Check keyboard/focus, safe links,
  narrow wrapping, appearance and spacing. Capture and inspect desktop Hub,
  native Mac and iPhone evidence. Test each provider adapter with a disposable
  fixture before enabling it.
- From a configured Gmail test sender, start from a message in a controlled
  test mailbox. Prove the draft reached Chief of Staff chat without delivery,
  have Daniel approve it there, then verify one message in the original Gmail
  thread and an identical receipt across Tracker and all clients.
- Merge source through Harness PR policy. Installed Hub, Mac and iPhone rollout
  requires Daniel's release approval, followed by version readback and signed-in
  acceptance on each surface.
