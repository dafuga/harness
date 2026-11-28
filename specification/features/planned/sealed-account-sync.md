---
status: planned
shippedIn: null
unitIds: []
owner: null
reviewedAt: null
---

# Sealed account sync

Tracker items, notes, runs and session output reach every signed-in Harness
app (Mac, iPhone, web, the box) through Cloudflare. Cloudflare (Hub Pages,
the relay Worker, D1, R2 and Durable Objects) stores and forwards only
ciphertext. Each app keeps a local copy, so a session it has shown before
opens instantly. Tracker item `fx4c15`; it serves `egkyz7` (account sync),
`d7ddya` (Hub shows live sessions) and `pkkbnh` (one app).

The existing Harness Remote channel (`packages/remote`, P-256 + HKDF-SHA256 +
AES-256-GCM between a paired phone and a Mac) keeps carrying commands to a
live Mac. This design adds stored, account-wide state that stays readable
when the Mac is offline.

## Threat model

| Party                                           | Can                                                                             | Cannot                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cloudflare, or anyone with Hub/D1/R2 access     | See account id, device ids and public keys, opaque ids, padded sizes, times, platform and approximate location | Read titles, notes, statuses, projects, computer or device names, session output         |
|                                                 | Withhold, delay or reorder data; serve an old chain head to a new device        | Forge or alter data, inject a key, enroll a device, roll a known device back unnoticed   |
| Someone with Daniel's Google session only       | Download ciphertext; write garbage that clients reject                          | Decrypt anything: Google sign-in never unlocks keys                                      |
| A revoked device                                | Keep what it already downloaded and decrypted                                   | Read anything written after the revocation rotates its scopes                            |
| A stolen, unlocked enrolled device              | Read its scopes until revoked from another device                               | Act on scopes it was never granted (the box only holds its project scopes)               |
| A malicious Harness build or compromised client | Everything that device can do                                                   | Out of scope: we trust the code that runs on enrolled devices (signed builds, no CDN JS) |

Residual risks, accepted for v1: traffic analysis from sizes and timing;
the web app trusts the Hub to serve honest JavaScript (mitigated by the
Mac/iPhone apps, which do not load remote code, and by Subresource Integrity
on the Hub's bundles); a server that forks the device chain can show a
device a stale view until it meets a device with a newer head.

## Keys

| Key                | Kind                                     | Lives                                                                         | Purpose                                  |
| ------------------ | ---------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| Device KEM key     | P-256 ECDH                               | Secure Enclave (iPhone, Mac), WebCrypto non-extractable, 0600 file on the box | Receives scope keys (HPKE)               |
| Device signing key | P-256 ECDSA                              | Same place as the KEM key                                                     | Signs device-chain entries               |
| Scope data key     | 32 random bytes, one per scope and epoch | Wrapped per device on the server; unwrapped in memory or Keychain             | Seals records, blobs and stream frames   |
| Scope index key    | 32 random bytes, one per scope           | Wrapped with every epoch                                                      | HMAC opaque ids, stable across rotations |
| Recovery secret    | 32 random bytes, shown once              | Credential Vault and Daniel's printed copy                                    | Opens the recovery device blob           |

A scope is the account scope or one project scope; each has a random 16-byte id.
Scoped bots such as Grok Bot hold only their project scopes.

**Algorithms.** HPKE (RFC 9180) base mode, suite DHKEM(P-256, HKDF-SHA256),
HKDF-SHA256, AES-256-GCM: CryptoKit `HPKE` with Secure Enclave keys on Apple
devices and `@hpke/core` (exactly pinned) over WebCrypto elsewhere. Records:
HKDF-SHA256 per-object key from a random 16-byte salt, AES-256-GCM with a
random 12-byte nonce. Signatures: ECDSA P-256 SHA-256, raw `r||s`.

## Device chain

The device list is an append-only chain of signed entries kept on the server
and verified by every client. Clients wrap keys only for devices the chain
enrolls, so the server cannot add a listening device.

Each entry is canonical JSON (sorted keys, no spaces) `{seq, prev, at, by,
body}` plus `sig`, signed over `harness/sealed/v1/chain` ‖ 0 ‖ those bytes.
`prev` is the hex SHA-256 of the previous signed entry. `by` names an active
device whose role may sign that type: admins sign everything, the recovery
device signs only `enroll`, bots sign nothing. `genesis` is self-signed by
the first device.

| Type      | Body                                                                        |
| --------- | --------------------------------------------------------------------------- |
| `genesis` | First device keys, recovery device keys, initial scopes and key commitments |
| `enroll`  | New device id, KEM and signing public keys, role (`admin` or `bot`), scopes |
| `revoke`  | Device id; marks its scopes stale until rotated                             |
| `scope`   | New project scope commitment at epoch 0 and the devices that get it         |
| `rotate`  | Scope id, next epoch, key commitment                                        |

A commitment is `SHA-256("harness/sealed/v1/commit" ‖ 0 ‖ scope id ‖ epoch ‖
dataKey ‖ indexKey)`.

Clients remember the highest verified `seq` and head hash and refuse a
shorter or different chain. Writes always use the newest epoch in the
verified chain. A key grant `{account, scope, epoch, device, enc, ct}` is
accepted only when the chain gives that scope to this active device and the
unwrapped keys match the epoch's commitment. The server knows every public
key, so it could wrap keys of its own; the commitment stops that without a
grant signature.

## Enrollment, revocation, recovery

1. A new app signs in with Google (or the device code flow on the box),
   creates its two key pairs and a secret 32-byte nonce, and posts its public
   keys with a commitment `SHA-256(label ‖ keys ‖ nonce)`. The request holds
   no name.
2. An existing admin device (normally the iPhone) shows "New sign-in" and
   claims it with its device id and its own random nonce.
3. The new device reveals its nonce; the approver checks the commitment.
   Both screens show the same 6-digit code, `SHA-256("harness/sealed/v1/sas"
‖ 0 ‖ request keys ‖ approver signing key ‖ both nonces)` mod 10^6.
   Committing first means a server in the middle cannot grind keys to match.
4. Compare the codes and approve with Face ID or Touch ID in the native app.
   In Hub, a trusted click with active browser user activation confirms the
   comparison. The approver appends `enroll` and wraps a grant per scope for
   the new device.
5. The new device checks the approver in the chain, verifies the chain to
   genesis, pins its head, unwraps its grants and writes its own sealed
   device name.

The account mailbox accepts one claim, one reveal from its opener, and one
receipt from its claimant. Retrying the same step returns its original
position. Competing claims leave the transcript intact. Completed mailboxes
leave the approval inbox and remain readable until their ten-minute expiry.
The approved inbox may show a fixed device label derived from the platform,
the relay's creation time, and the country observed by the Hub edge when
available. The comparison code authenticates the public keys. Personal device
names are sealed after enrollment. Retrying the same opening preserves the
first display details. Individual mailbox reads and live announcements do
not include the platform or country.
On recoverable accounts, claiming and acknowledging require a current
device-bound admin session. The individual request is readable by its
opening session and the account's enrolled admins. The reveal belongs to the
requesting device and session. The iPhone keeps polling its account while it
shows the comparison code and withholds protected reads until admission.
The reviewing client pins the opening before claiming it, checks the reveal
against that commitment, and presents the comparison code. After local user
confirmation it rechecks the same mailbox and uses its previously pinned
account chain to wrap the current scope grants for those exact device keys.
A cancelled review sends no enrollment or grant. Any approved installation
can deny an undecided mailbox. The claimant's publication reserves that same
mailbox for the exact signed entry before the chain transaction. Denial and
publication reservation exclude each other. Neither can replace the other's
decision. A denied request leaves the inbox. The waiting installation sees
that outcome when it polls. A denied or expired sign-in clears the comparison
code, stops polling and offers a return to sign-in. A lost publication reply retries the same signed
entry and grant bytes.

Approved installations show pending requests in their inbox. When notifications
are enabled, a new request can also raise a generic system alert. Device and
account details remain in the authenticated inbox. A notification opens
Harness for review. Approval still requires the matching codes and local
confirmation. Hub uses a separate notification tag for device approval so
Tracker decision alerts retain their own state.

Devices link through Google sign-in (see `google-device-linking.md`). A new
installation waits for approval from an approved iPhone, Mac, or Hub browser.
Revoking appends `revoke`, then `rotate` for
every scope that device held, with fresh grants for the remaining devices.
Older epochs stay readable by remaining devices; re-sealing old data is
optional later work.

The genesis device also creates a recovery device that holds every scope.
Its private keys are sealed with AES-256-GCM under `HKDF(recoverySecret,
salt, "harness/sealed/v1/recovery")` and stored on the server as salt 16 ‖
nonce 12 ‖ ciphertext. With every device lost, Daniel enters the recovery secret
from the Credential Vault on a new device, which acts as the recovery device
to enroll itself.

On first sign-in the client saves the recovery secret through the independent
custody adapter before submitting the account's signed genesis, wrapped grants
and encrypted recovery blob. Hub commits these together for an empty account.
Only the signing installation and one recovery device are present in genesis.
Both receive a grant for every initial scope. A competing bootstrap leaves all
three stores unchanged. The losing installation requests approval through the
existing-account flow. The recovery blob can be retrieved in the same Google
account and opened with the independently held recovery secret. The client
checks that its recovered public keys match the signed genesis before use.

## Sealed formats (v1)

All headers are authenticated data. Integers are big-endian.

| Object       | Layout                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Record       | `0x01` ‖ scope id 16 ‖ epoch u32 ‖ object id 32 ‖ revision u64 ‖ salt 16 ‖ nonce 12 ‖ AES-GCM ciphertext                                                                       |
| Stream frame | `0x02` ‖ scope id 16 ‖ epoch u32 ‖ stream id 16 ‖ counter u64 ‖ AES-GCM ciphertext; nonce = 4 zero bytes ‖ counter; key = HKDF(dataKey, stream id, "harness/sealed/v1/stream") |
| Grant        | HPKE `enc` 65 and ciphertext of `dataKey ‖ indexKey`; info = `harness/sealed/v1/grant` ‖ 0 ‖ canonical `{account, device, epoch, scope}`                                       |

Record keys are `HKDF(dataKey, salt, "harness/sealed/v1/record")`; the
whole prefix up to the ciphertext is authenticated data. Plaintext is UTF-8
JSON with a `kind` field, padded before sealing: a 4-byte
length, the bytes, then zeros up to the next bucket (256 B doubling to
64 KiB, then 64 KiB steps). Object ids are `HMAC-SHA256(indexKey, kind ‖ 0 ‖
local id)`, or random for op-log entries. Clients keep the highest revision
seen per object and reject an older one.

## Data on Cloudflare

| Store                                 | Holds (all bytes sealed unless noted)                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| D1 `sealed_chain`                     | `account, seq, entry` (public keys and signatures in clear; names sealed in the account scope)                                     |
| D1 `sealed_grants`                    | `account, scope, epoch, device, grant`                                                                                             |
| D1 `sealed_ops`                       | `account, scope, seq (server-assigned), device, received_at, envelope`: the op log                                                 |
| D1 `sealed_objects`                   | `account, scope, object id, revision, size, r2 key or inline envelope`: snapshots, session state                                   |
| R2 `sealed/<account>/…`               | Large envelopes: transcript segments, compaction snapshots                                                                         |
| DO `AccountSyncObject` (relay Worker) | One per account: WebSocket fan-out of `{scope, seq}` pokes and live stream frames; no storage of frames beyond a short replay ring |
| Push                                  | Generic "Harness has updates"; the app fetches and decrypts                                                                        |

API, under the Hub (`/api/sync/v1`, Google session plus device id):
`GET chain?after`, `POST chain` (append a verified legacy entry),
`GET grants?device`, `POST grants`, `POST ops/:scope` (batch), `GET
ops/:scope?after&limit`, `PUT|GET objects/:scope/:id`, `GET live`
(WebSocket to the account object), `POST enroll`, `GET enroll/:id`. The
server never parses an envelope beyond its length and header ids.

### Sync server wire contract (as built, child 3)

Every call needs the Google session (cookie, or `Authorization: Bearer` for native apps) and the
app's own device id in `X-Harness-Device` (16 random bytes, base64url). The account is the
session's actor and nothing in a request names another. Project-scoped sessions (`project:<id>`)
do not reach `/api/sync` yet. Answers are `Cache-Control: private, no-store`; no CORS header.
Scope ids, device ids and object ids are base64url (16, 16 and 32 bytes); envelopes are base64url text.

| Call                          | Body and answer                                                                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET chain?after=N`           | `{entries, head, more}`, 200 entries a page, oldest first                                                                                                                           |
| `POST chain`                  | One entry signed by the named device and verified against the account and stored chain. 201 `{seq, hash}`. Existing positions, gaps and mismatched previous hashes return 409.      |
| `POST bootstrap`              | `{entry, grants, recovery}` on an empty account. 201 `{seq: 0, hash}`; an exact retry returns 200, and a competing or changed request returns 409.                                  |
| `GET bootstrap`               | `{recovery}` for the signed-in account, or 404 when the account has no stored recovery blob.                                                                                        |
| `GET device-session`          | A stage from `first-device`, `waiting-for-approval`, `proof-required`, or `approved`. Only the proof stage carries a challenge.                                                     |
| `POST device-session`         | `{challenge, signature}` proves the enrolled device's signing key for the current Google session. On success the session records the approved device.                               |
| `POST devices`                | `{entries, grants, enrollment?}` commits a verified device change and its wrapped grants together. Mailbox approval supplies the request id. 201 on creation and 200 on exact retry. |
| `POST grants`                 | A grant or an array of up to 32. First write per scope, epoch and device stays; `account` must be the session's. 201 `{stored}`                                                     |
| `GET grants?device=ID`        | `{grants}` for that device                                                                                                                                                          |
| `POST ops/:scope`             | JSON array of up to 64 record envelopes (base64url). Header scope must match; the header object id is the retry key. 201 `{ops: [{opId, seq}], head}`; seq is per scope from 1      |
| `GET ops/:scope?after&limit`  | `{ops: [{seq, opId, device, receivedAt, envelope}], next, more}`, 200 entries or 2 MiB a page                                                                                       |
| `PUT objects/:scope/:id`      | Body is the base64url record envelope; header scope, object id and revision are checked against the path. Up to 4 MiB; over 32 KiB it goes to R2. 409 `stale-revision` unless newer |
| `GET objects/:scope/:id`      | The envelope as base64url text, revision in `X-Sealed-Revision`                                                                                                                     |
| `GET objects/:scope?after=N`  | `{objects: [{id, revision, size, change}], next, more}`: what changed since the scope's change counter N                                                                            |
| `POST enroll`                 | Public keys and commitment, at most 4 KiB. 201 opens a mailbox. An identical live opening by the same device returns the existing mailbox (200) without notifying again. A new opening at capacity returns 429.                                              |
| `GET enroll`, `GET enroll/ID` | Pending requests in the approved inbox, or the steps and outcome of one request. Requests expire after 10 minutes. |
| `POST enroll/ID`              | Appends a claim, reveal or receipt. An approved installation can send `{deny: true}` before publication is reserved. |
| `GET live` (WebSocket)        | Upgrade to the account's `AccountSyncObject`                                                                                                                                        |

The device signs `harness/sealed/v1/session` followed by a zero byte and the
base64url challenge using its P-256 signing key. The server binds the challenge
to the account, device, Google session and a short time window. Standalone
legacy chain and grant writes are disabled after recoverable bootstrap. The
sealed HTTP log and object routes then require the matching approved session
and an active grant for the requested scope. The recoverable account also requires an active, session-bound admin device to list all pending approvals or open its live WebSocket. A waiting device can still submit its opening and poll the individual mailbox.

Revisions are limited to 2^53 - 1. Live socket: the client sends `{"t":"subscribe","scopes":[...],
"after":ring}`; the server answers `{"t":"subscribed","ring":n}` and then sends text
`{"t":"poke","scope","seq","kind":"ops"|"objects"}` and `{"t":"enroll","id","n"}`, and binary
`u64 ring ‖ sealed frame`. A client sends a bare sealed stream frame (binary, at most 256 KiB); the
object checks only the frame type, length and scope id, keeps it in a 64-frame, 2-minute ring and
relays it to the other subscribers of that scope. Anything else closes the socket with 1008.

Tracker state is an encrypted op log per scope (per-field last-writer-wins
with hybrid clocks, append-only notes, tombstones, as decided on `egkyz7`).
Any device may upload a sealed compaction snapshot so new devices do not
replay the whole log.

## Client cache and speed

Every client stores envelopes exactly as the server holds them, plus a
cursor per scope, and decrypts on read: IndexedDB on the web (scope keys as
non-extractable `CryptoKey` objects, so a reload needs no unwrap), system
SQLite on iPhone and Mac (keys in the Keychain). Opening a session renders
the cache first, then applies the delta and the live stream. Writes are
applied locally at once (optimistic) and queued in an outbox.

| Path                                    | Budget                               |
| --------------------------------------- | ------------------------------------ |
| Previously viewed session to first text | p50 ≤ 50 ms, p95 ≤ 100 ms            |
| Never viewed session, good network      | p50 ≤ 600 ms                         |
| Live output, Mac to viewer              | ≤ 250 ms over network latency        |
| Foreground catch-up to fresh            | ≤ 300 ms, cached view shown first    |
| Crypto per 100 KiB record (open)        | ≤ 2 ms web, ≤ 1 ms native            |
| Grant unwrap                            | Once per scope and epoch per install |

Measure open-session latency on the current paths (Hub Home, iPhone via the
relay) before the switch and on the sealed paths after, with the same
fixture sessions.

## Core API

`packages/remote/src/utils/networking-security/sealed*.ts`, types in
`models/networking-security/Sealed.types.ts`. Children build on these and do
not reimplement them; Swift matches them through the vectors.

| Module             | Functions                                                                             |
| ------------------ | ------------------------------------------------------------------------------------- |
| `sealedScopeKeys`  | `newScopeKeys`, `scopeCommitment`, `sealedScopeKeys`, `sealedObjectId`, `scopeName`   |
| `sealedRecord`     | `sealedRecord`, `openSealedRecord`, `sealedRecordHeader`                              |
| `sealedFrame`      | `sealedStreamKey`, `sealedFrame`, `openSealedFrame`, `sealedFrameHeader`              |
| `sealedDevice`     | `sealedDevice`, `sealedDevicePublic`                                                  |
| `sealedGrant`      | `sealedGrant`, `openSealedGrant`                                                      |
| `sealedChainEntry` | `sealedChainEntry`, `verifyChainEntry`, `chainEntryHash`, `sealedCanonical`           |
| `sealedChain`      | `sealedChain(entries, { account, pin })` returns devices, scopes, epochs, stale flags |
| `sealedSas`        | `sealedEnrollCommit`, `checkEnrollCommit`, `sealedSas`                                |
| `sealedRecovery`   | `newRecoverySecret`, `sealedRecovery`, `openSealedRecovery`                           |
| `sealedPadding`    | `sealedPadding`, `sealedUnpadding`, `sealedBucket`                                    |

Test support for other packages: `test/support/plaintextCanary.ts`
(`expectNoPlaintext`) and `test/support/sealedServer.ts` (a recording server).

## Proof

- Known-answer vectors (`packages/remote/test/support/sealed-vectors.json`)
  shared by the TypeScript and Swift implementations.
- Tamper tests: any changed header or ciphertext byte, wrong scope, epoch,
  object id or key fails to open; an unsigned, wrongly signed, forked or
  rolled-back chain is refused; a grant whose key misses its commitment is
  refused.
- Zero-plaintext tests: a recording server captures every byte a client
  sends (D1 rows, R2 objects, DO messages, request bodies, headers, URLs).
  Canary strings and their base64, base64url and hex forms must not appear.
  The sync server's Workerd test runs the same check on its stored rows.

## Build plan

Wave 1 starts now; each child owns the listed paths only.

| Child                                       | Item     | Owns                                                                                                                             | Needs                                     |
| ------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1. Sealed core (TypeScript)                 | `fx4c15` | `packages/remote/src/**/sealed*`                                                                                                 | none                                      |
| 2. Swift sealed + Secure Enclave keys       | `pkkbnh` | `packages/desktop/ios/App/App/Sealed/**`, iOS vector checks                                                                      | formats above, vectors from 1             |
| 3. Sync server: D1, Hub API, account object | `egkyz7` | `packages/hub/db/migrations/0008-*`, `packages/hub/src/routes/api/sync/**`, `packages/relay/src/lib/networking-security/sync/**` | API above; 1 in tests only                |
| 4. Tracker in the Mac app bundle            | `jda9nt` | Desktop packaging, launch agent                                                                                                  | none                                      |
| 5. Preferred provider setting               | `mq3s9y` | Tracker config, launcher model choice, settings UI                                                                               | none; becomes an `account` record after 6 |

Wave 2, after 1 and 3 merge:

| Child                                            | Item     | Owns                                                    |
| ------------------------------------------------ | -------- | ------------------------------------------------------- |
| 6. Tracker op-log sync client and migration      | `egkyz7` | `src/services/projects-sessions/tracker-sealed-sync/**` |
| 7. Enrollment, revocation, recovery (Hub + apps) | `fx4c15` | Hub devices and enroll routes, iOS `Account/Enroll*`    |
| 8. Session stream publisher on the Mac           | `d7ddya` | `packages/desktop/src/services/session-stream/**`       |

Wave 3: 9. Hub sealed cache and live Home (`d7ddya`,
`packages/hub/src/lib/sealed-client/**`); 10. iPhone sealed cache and live
sessions (`pkkbnh`, `TrackerReplica*` sealed source); then latency
measurements, the hub/spoke migration with backup and count/hash checks,
and production deploys after Daniel's go.
