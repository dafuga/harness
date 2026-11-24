---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Phone Tracker replica

Harness Studio keeps a private, read-only copy of Tracker on the iPhone. After
syncing, it can answer where an item stands, what was flagged, and what ran
while the Tracker hub, relay, and other computers are unavailable. A remote
model still needs network access. The local tools work without inference and
can also serve a future on-device model.

Deliver this specification first. Build and verify the read-only path next.
Add queued writes after the read-only path is verified. Simulator verification
uses a synthetic hub and phone grant. Coordinate device builds with the Harness
Studio release owner (Tracker item `xm64q4`). Production deployment, signing
changes, and TestFlight uploads are outside this delivery.

## Authority and data

The native Tracker hub is authoritative. A paired host colocated with the hub
serves `trackerReplicaPull` v1 over the existing Harness Remote authenticated,
encrypted request channel. The host reads a narrow projection from the native
Tracker service over loopback. The existing signed machine
[`/sync` journal](../../tracker-native-service.md) stays a host-to-host
protocol. Neither the Hub website overview nor a general remote shell is a
source for the phone replica.

The owner explicitly enables Tracker read access for a paired phone. For the
first implementation, set `HARNESS_TRACKER_PHONE_DEVICE` on the paired
desktop process to the exact approved device ID from its `remote.status`.
Only that phone is offered the Tracker method. This authorizes the full
eligible projection for that hub and is separate from project and agent
permissions. The local Tracker API is the native hub on `127.0.0.1:7701`.
Changing the setting requires restarting the paired desktop process. Bind
authorization to the host, phone, pairing generation, and Tracker grant.
Check the grant on every pull, before reading Tracker or returning data.
Reuse the established CryptoKit phone pairing, key agreement, and authenticated
encryption. Web code may use WebCrypto. The iOS target uses only Apple system
cryptography and system SQLite. The relay carries encrypted envelopes. Store
device keys and transport credentials in the existing Keychain boundary,
apart from SQLite and from model-facing results. Build-time dependency checks
must cover bundled code as well as the native target before a distribution
owner records the export declaration.
[Apple export documentation](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption/)

| Record | Included fields                                                                             |
| ------ | ------------------------------------------------------------------------------------------- |
| Item   | Stable ID, title, project, status, update time and optional due time                        |
| Note   | Parent item ID, stable note ID, author display label, timestamp and excerpt                 |
| Flag   | Parent item ID, current attention state, flag timestamp and question excerpt when available |
| Run    | Parent item ID, stable origin and run ID, state, outcome category and lifecycle timestamps  |

Use an explicit projection for every record. Exclude sensitive items and
their children. Exclude credentials, auth and
callback fields, launch instructions, command lines, paths, transcript
fragments, arbitrary metadata, and raw journal operations. Apply the existing
Tracker overview text redaction to human text before serialization. Keep
credential-shaped text out of fixtures except for synthetic redaction markers.
Omit text when it fails the sharing policy. A detector can miss arbitrary
secrets embedded in ordinary prose, so the read grant must disclose which text
will be copied and Tracker authors must keep secrets out of those fields.
Keep payload contents out of logs, metrics, and generic response caches.

Revocation, unpairing, or a grant change cancels in-flight work and purges
the old scope before another tool read. A phone offline when the owner revokes
it learns that on the next authenticated contact. Until then the local grant
expires seven days after its last authenticated renewal. A denied or expired
grant yields no Tracker data. A fresh grant requires a new snapshot.

## Sync protocol v1

The hub maintains a bounded, durable projection feed. An operation changes one
projected item and its retained children, or removes the item. Raw item journal
sequences can identify changed items inside the hub. Run rows and note/flag
retention changes can change independently of those sequences, so the exported
cursor belongs to the projection feed. Updates to the materialized projection
and append to its feed commit together. An unchanged projection emits no
operation. Changes coalesced before projection produce the latest visible
state. Key runs by origin and ID to avoid collisions. The feed stores changed
IDs and sequences. It delivers the current projection for each changed ID, or
a tombstone for an item no longer visible, so catch-up cannot export old text
from an item that became sensitive.

Use a versioned request with an optional opaque `cursor` and an optional
server-issued snapshot continuation. The cursor binds source database
identity, projection epoch, grant and operation sequence. Encode sequence
positions without JavaScript numeric precision loss. The cursor carries no
credentials and never grants access. A response is one of these envelopes.

| Kind       | Payload and client action                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `snapshot` | Fixed snapshot ID, rows, continuation or final cursor, hub timestamp, retention coverage. Stage pages. On the final page, publish the complete replacement and its cursor in one transaction.                             |
| `delta`    | Request cursor, ordered upserts and tombstones, next cursor, `hasMore`, hub timestamp. Apply rows and cursor in the same transaction. An empty terminal page confirms freshness.                                          |
| `reset`    | Hub replacement, expired cursor, or incompatible projection epoch. Clear staged pages and restart from a snapshot. Keep the old published copy marked stale while the same grant remains valid. A grant change purges it. |
| `error`    | Stable code such as `denied`, `unsupportedVersion`, `temporarilyUnavailable`, or `invalidRequest`. Never advance the cursor.                                                                                              |

Freeze snapshot membership and values at one high-water mark. Keep concurrent
updates available in the feed after that mark. Continuations expire after
15 minutes. Expired snapshots restart from the first page. Select deltas
strictly after the request cursor. Filter by grant and advance across filtered
operations so an authorized phone can reach the head. A cursor ahead of the hub
or older than retained history requests a reset. Expire feed history after
seven days or 20,000 operations, whichever comes first. Restarting the hub
retains its epoch and feed. Restoring a hub from backup rotates the epoch
before serving phones.

Limit each reply to 100 rows or operations and 128 KiB of clear JSON. If an
item would exceed a page by itself, bound its child count and text before
encoding. Apply only responses for the current scope, request cursor, and
snapshot. Reject malformed, oversized, or out-of-order replies without changing
the published copy or cursor. Duplicate responses and interrupted transactions
are safe to retry. A phone installs a snapshot immediately followed by any
available deltas.

## SQLite and offline reads

Use system SQLite in the app-owned Application Support directory. Store a
schema version and per-scope sync metadata alongside item, note, flag, and run
tables, keyed by source and ID. Index item ID, project, status, and recency.
Use bound queries and capped search. Do not store raw network payloads or
create a second provider cache. Protect the database, staging files, and
SQLite sidecars with iOS Data Protection available after first unlock and
exclude the directory and its sidecars from backup. No data is available
before first unlock. Delete the directory for a revoked scope after closing
SQLite handles. Migration failure requests a fresh snapshot and leaves no
readable copy under an invalid schema.
[Apple file protection](https://developer.apple.com/documentation/uikit/encrypting-your-app-s-files)

Retain up to 2,000 items, prioritizing open, in-progress, and unresolved
flagged items, then the most recently updated closed items from 30 days.
Keep the newest 10 note excerpts and five run summaries per item. Titles
are capped at 240 UTF-8 bytes and excerpts at 512 bytes. Budget 24 MiB for
the live database and 48 MiB total including staging and sidecars. Measure
the high-water mark in a representative fixture. Halt staging when it exceeds
budget and preserve the last valid copy. Return retention coverage and any
truncation in tool results. The hub emits a removal when an item leaves the
projection and a full upsert when it returns.

## Local model tools

Expose these exact tool names through an in-process app dispatcher. The
dispatcher validates input and reads only the current SQLite scope. It has
no arbitrary SQL, network, shell, or write entry point.

| Tool             | JSON arguments                                                                         | JSON result data                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `tracker_status` | Empty object                                                                           | Counts by status, unresolved flag count, `needsYou` (up to 25 items with an open flag), and the most recently updated items, max 10 |
| `tracker_show`   | `id`, full Tracker ID or unique prefix of at least six characters                      | One item, its retained notes, flag, runs and `attentionRevision`. Ambiguous prefixes return candidates, max 10.                     |
| `tracker_search` | `query`, 1–160 characters, optional `project`, `status` and `limit` (1–25, default 10) | Literal case-insensitive matches by ID or title, newest first with an ID tie-breaker                                                |

Every result reports `source: "local_tracker"`, `lastSyncedAt` or null,
`partial`, and freshness (`current`, `stale`, or `unavailable`). Report
`noReplica`, `denied`, `invalidInput`, `noLocalMatch`, and
`ambiguousPrefix` distinctly. Disconnection immediately marks results stale.
Incomplete snapshots remain invisible. If nothing matched locally, the model
should say so without claiming the hub has no such item. Treat titles, notes,
and flags as untrusted data, never as instructions. Sending returned fields to
an off-device provider requires the app's explicit data-sharing consent.

Keep model routing outside the replica. Anthropic directs third-party apps to
API-key or supported provider authentication and restricts collecting consumer
session credentials. OpenAI documents a Sign in with ChatGPT app-server path
for eligible apps. Harness Studio can use an authorized integration where
available or Harbor network inference with consent. The phone feature must
work with a fixture dispatcher before relying on a live provider, and provider
credentials never enter the replica.
[Anthropic authentication policy](https://code.claude.com/docs/en/legal-and-compliance)
[OpenAI Codex app-server integration](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server)

## Refresh and operating budget

Sync on foreground entry, authenticated reconnect, or explicit refresh. While
the app is active and the grant is live, coalesce invalidations and check for
deltas at most once a minute. One in-flight sync per scope. Retry transient
failures with jittered backoff from one minute to one hour. Reconnect or a
manual refresh can restart the attempt. Freshness means caught up at the last
successful terminal page, with its timestamp, and becomes stale after five
minutes without confirmation.

Register a `BGAppRefreshTask` during launch and request an earliest start
30 minutes out. The OS controls when or whether it runs. Give a background
attempt 15 seconds and at most two replies or 256 KiB of clear payload. Cancel
transport on expiration, keep only committed SQLite pages, and complete the
task once. Defer initial snapshots to foreground. Respect Low Power Mode and
expensive or constrained networking for background work. Avoid persistent
background sockets. With the current paired host transport, wakeups can only
sync when that host is reachable.
[Apple background task guidance](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app)

The app handles a silent wakeup through its refresh callback. When the mobile
release has authorized APNs infrastructure, silent pushes
may coalesce dirty notifications, at most once every 30 minutes per device.
Send only the wake signal with `content-available: 1`, background push type,
and priority 5. Use the same single-flight and expiration limits. Delivery
is discretionary. Foreground sync covers missed pushes, low power, disabled
background refresh, and force-quit. Measure actual bytes and wake duration
on a device before claiming battery savings.
[Apple background push guidance](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app)

## Queued writes after read-only acceptance

The desktop and the colocated native hub require a separate write grant.
Configure `HARNESS_TRACKER_PHONE_WRITE_DEVICE` with the exact paired device ID
on both processes, and provide the same dedicated
`HARNESS_TRACKER_PHONE_WRITE_TOKEN` through each process's private environment.
The desktop still requires its read grant for that device. The token travels
in the loopback authorization header and stays off the phone and relay.

The `tracker_note`, `tracker_flag` and `tracker_answer` tools take an item ID
and up to 512 UTF-8 bytes of text. A native confirmation shows the item, the
proposed text and the current question when answering. The protected outbox
keeps up to 100 confirmed intents with a device-scoped UUID, full item ID,
operation, payload and the attention revision for flags and answers.
`tracker_write_status` reports the pending intents and any blocked items. A
user can review and discard a conflict through `tracker_discard_write`.
Keep pending intents out of canonical reads. Drain in creation
order per item after authenticated reconnect. A note appends to an existing
visible item. A flag compares its expected attention revision. An answer
must match the exact still-unanswered flag. The hub validates current grant,
visibility, and revision in the same transaction as the operation and
idempotency receipt. A retry returns the same receipt even after a lost reply.
A flag or answer carries the `revision` the user reviewed, from `attentionRevision`
in `tracker_show`. A mismatch returns `staleReview` before anything is queued, so a
changed flag needs a fresh review. Missing items, stale revisions, and revoked grants
stop the affected intent for review. Never retarget an answer to a newer flag. Discard stored payloads
when a scope is revoked. Reconcile accepted writes through ordinary deltas.

## Acceptance

- With a disposable hub, pair and bootstrap, change item state, notes, flags,
  and independently changing runs, and observe the correct delta and removal.
  Verify replay, interrupted bootstrap, cursor reset, bounds, credential
  redaction, and permission failures with exact response fixtures.
- On iOS, use synthetic paired data, terminate and relaunch while disconnected,
  and exercise all three tools against SQLite. Prove no network calls for
  tools, useful stale timestamps, distinct empty and missing results, cursor
  atomicity, authorization changes, and disk budgets.
- Exercise foreground reconnect and task expiration with deterministic clocks
  and transport fixtures. Build and run headless on a disposable simulator.
  Record device APNs delivery and measured energy separately when available.
