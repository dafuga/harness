---
status: implemented
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Hub browser notifications for "needs you"

Daniel, 26 Nov: show browser notifications when something needs attention, and again every
15 minutes while it does.

## Behaviour

- Only an open structured ask counts: the rule Home's "Blocked - needs you" list uses
  (`trackerStructuredAsk`). Pings, flags without choices, dependency blocks, parked,
  snoozed and sensitive items never notify.
- A new ask (new item, or a new question on the same item) notifies at once. While any ask
  stays open, the notification repeats every 15 minutes. Two sends are at least one minute
  apart.
- One notification summarises every open ask. It replaces the previous one (same tag) and
  alerts again.
- A click opens Home on the "Blocked - needs you" list. With exactly one open ask it opens
  that ask in its session chat.
- Quiet hours default to 22:00-08:00 Europe/Lisbon. Home has the setting: on or off, start
  and end. A held notification is sent when quiet hours end.
- Signing out unsubscribes that browser, so a signed-out browser gets no decision text.
- A state file that cannot be written never makes a notification repeat early.
- Works with every Hub tab closed. Chrome on a Mac or Android phone; on iPhone only after
  Harness is added to the Home Screen.

## Who sends

The Hub cannot see decisions: the plaintext Mac Home upload stays off. The sender is the
Tracker hub node (the primary Mac), which already holds every item.

- The browser stores its push subscription in the Hub (owner session only). The Hub holds
  subscriptions, the quiet-hours setting and each browser's last delivery time. It holds no
  Tracker text and no private key.
- The Tracker hub reads the subscriptions only when a notification is due. It signs the
  request with its application server key; the Hub verifies it with the public key in
  `HARNESS_PUSH_PUBLIC_KEY`, allowing one minute of clock difference.
- The Tracker hub sends straight to the browser's push service. The message is encrypted for
  that browser (RFC 8291) and signed with VAPID (RFC 8292), so neither Cloudflare nor the
  push service can read it.
- Push addresses are accepted only on the known push services (Google, Apple, Mozilla,
  Microsoft), by the Hub when stored and by the sender before use.

## Device sign-in alerts

- An approved browser can enable generic device sign-in alerts from the same notification row.
  The Hub binds the subscription to the Google session and its proven installation key.
- The Hub sends one alert when the account mailbox creates a new request. It checks the
  active device chain and session before selecting recipients. Opening retries, expired sessions
  and revoked installations receive no new alert.
- The encrypted payload says only that a device sign-in needs review. The click opens Hub Home,
  where the approved session can read the inbox and review the request.
- The approval service worker has its own scope and VAPID key. Configure the Hub's
  `HARNESS_APPROVAL_PUSH_PUBLIC_KEY` and secret `HARNESS_APPROVAL_PUSH_PRIVATE_KEY` and
  apply migration `0012-approval-push.sql` before enabling delivery. The Tracker sender keeps
  its own key. Removing the approval binding disables this delivery.

## Setup and release

1. On the Tracker hub: `tracker web-push setup --origin https://<hub>`. It writes
   `web-push.json` (mode 0600) beside the journal and prints only the public key. The
   private key is never printed. The running node picks the file up without a restart.
2. Hub: apply `db/migrations/0009-web-push.sql`, set `HARNESS_PUSH_PUBLIC_KEY`, deploy.
3. Release the Tracker hub node.
4. In each browser: Home, "Turn on notifications".

`tracker web-push status` shows whether it is set up, the last send and the last problem.
Without `web-push.json` the node sends nothing; without the public key Home shows no
notification control.

Rollback: remove `web-push.json` (stops sending), roll back the Hub deployment, and
optionally drop the two new tables. `tracker.json` is unchanged, so older Tracker releases
start as before.

## Proof

- Encryption checked against the RFC 8291 test vector.
- Planner tests for new, repeat, quiet hours, spacing, failures and no subscribers.
- Hub route tests for owner-only access, sender signature, address allowlist.
- Browser tests at desktop and phone widths with screenshots of each state.
- Live: a real notification in Chrome on Daniel's Mac from the production Hub.
