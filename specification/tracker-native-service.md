# Tracker native service

Run the foreground entry point under the host service manager. Use the same
immutable Harness launcher for the supervisor and the packaged Tracker shim.

```sh
harness tracker serve --config /absolute/private/tracker.json --role hub
harness tracker serve --config /absolute/private/tracker.json --role spoke
```

Set `HARNESS_TRACKER_CONFIG` to select the configuration for both
`harness tracker` and the shim, or put it at `$XDG_CONFIG_HOME/harness/tracker.json`
(default `~/.config/harness/tracker.json`). The configured shim sends commands to
the native loopback API and checks the configured node and role on every
request. In this mode, `ensure` checks readiness and leaves restart ownership to
the host manager. It exits 3 when the service is unavailable. With no native
configuration selected, the shim uses the retained Tracker client.

## Configuration and ownership

Use version 1 JSON. The config, fence receipt, secret files and existing
SQLite file must be private and owned by the service user. Use the same
canonical SQLite path and API port as the fenced installation. Keep the
API and signed sync listener on different ports. This is a hub example with
illustrative paths and ports.

```json
{
	"version": 1,
	"node": "fixture-hub",
	"role": "hub",
	"database": "/absolute/private/tracker.sqlite",
	"apiPort": 49201,
	"syncPort": 49202,
	"legacyFenceFile": "/absolute/private/tracker-fence.json",
	"syncSecretFile": "/absolute/private/sync.secret"
}
```

A spoke omits `syncPort` and supplies `"upstream": {"url": "https://hub.example.com"}`.
For direct Mac peer replication, a spoke may also configure `peer.upstream`
and `peer.listenPort`. Sync endpoints use HTTPS or literal IPv4 loopback HTTP.
An optional `accessFile` beside an upstream URL supplies `clientId` and
`clientSecret` for Cloudflare Access over HTTPS. The sync listener routes
only signed Tracker sync requests. The local API keeps
the existing health, status, item and digest paths used by local readers.

The cutover operator must first stop and persistently disable the legacy
launchd, systemd or standalone restart path. For a hub, the cutover also
needs independently verified fencing of the preceding authority. Record the
verified checkpoint in the fence receipt. The service checks that this file
matches its exact node, role, database and ports. The receipt records an
external verification and cannot independently verify the fleet or boot
configuration.

```json
{
	"version": 1,
	"checkpoint": "approved-cutover-01",
	"legacyAutostart": "disabled",
	"node": "fixture-hub",
	"role": "hub",
	"database": "/absolute/private/tracker.sqlite",
	"apiPort": 49201,
	"syncPort": 49202
}
```

For a standalone legacy supervisor, set `legacySupervisorSocket` in both
files to the same canonical Unix socket path in its private state directory.
The native process claims the existing supervisor protocol slot and rejects
a conflicting socket. The operator handles any stale socket after verifying
the previous supervisor is stopped.

Startup claims an exclusive SQLite sidecar lease and all configured listener
ports before opening the journal. SIGTERM and SIGINT stop admission, cancel
sync, drain requests and worker ticks, and check the stopped journal for
legacy rollback blockers. An unacknowledged delivery or incompatible run or
job receipt fails that check. Keep the legacy manager fenced until the
operator verifies the stopped database and chooses a rollback.

## Compatibility and effect owners

- **CLI.** Native mode supports `add`, `note`, `flag`, `answer`, `done`,
  `launch`, `status`, `digest`, and `sync`, plus the item and inspection
  commands listed in `tracker help`. Item commands accept unique ID
  prefixes and JSON output. Duplicate exit codes 4 and 5 are retained.
  `runs`, `models report`, and `pick` read the same native journal and keep
  the established human-readable and JSON formats.
  `sync` wakes the configured spoke links. Native launch writes a durable
  intent for the selected node. Fleet placement and provider execution
  remain external. Commands outside the native list fail explicitly.
- **Callbacks and CoS.** Set `notifications.targets` to a map of stable
  IDs to `{ "url": "...", "bearerFile": "/optional/private/bearer-token" }`.
  Name IDs in `itemCallbacks` to bind the exact legacy item or agent HTTP
  URL, in `chiefOfStaff` for direct attention reminders, and in the hub's
  `webhook` for batched attention and recurring wakes. The foreground
  supervisor runs the durable notification tick and transmits a stable
  `Idempotency-Key`. The receiver must honor that key across retries.
  The target owner must reconcile migrated callback mappings and pending
  delivery receipts before enabling sending. Shell command targets and
  legacy custom webhook headers require separate integration.
- **Watchdog.** The pinned legacy daemon calls the dispatcher's
  `watchdog.tick()` in its dispatcher tick. Pane discovery, tmux writes,
  startup trust and answered-run recovery belong to its process adapter.
  The native watchdog decision services have fixture coverage. The
  foreground entry point still needs a host process adapter to run them,
  and surfaces this in `status.native.watchdog`.
- **CoS watchdog.** The legacy daemon separately creates `WatchdogCos` on
  the primary Mac, polls its own and MB2's watchdog alerts and sends them to
  the CoS tmux session. The primary Mac's external
  `com.danielfugere.cos-tracker-alert` LaunchAgent runs
  `~/chief-of-staff/bin/tracker-alert.py` every 30 minutes. That script
  uses the absolute Tracker shim with `list --flagged --json` and owns its
  own seen-state file. Its dry-run path reads the feed without sending
  tmux keys or updating seen state. Native HTTP callbacks and attention
  batches cover the notification tick. The watchdog alert bridge and
  external timer need separately verified ownership.
- **Other effects.** The foreground command leaves provider execution,
  fleet telemetry, job execution, adapter polling, and external backup
  scheduling disabled. Recurrence ticks are enabled only with a configured
  hub webhook. The existing native scheduler passes completion
  instructions to its runner. A host runner must append them to its
  generated brief before launching a session.

## Rollback evidence

Identify the candidate by its Git SHA and launcher SHA-256. Identify the
retained Tracker release by its pinned Git SHA and launcher SHA-256.
Keep the fence checkpoint, database identity and pre/post-stop SQLite
fingerprints together. Preserve the database containing the candidate's
writes for rollback. Compare quiesced disposable copies with
`harness tracker verify-cutover` and verify that item, note and queued
operation identities remain readable before re-enabling the previous
manager. Verify fleet effect resumption separately under the cutover runbook.
