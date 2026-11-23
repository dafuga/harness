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
  `show` includes retained run history and the local schedule preview.
  `ignore` and `unignore` use journal transitions and retain the actor, notes,
  and prior status. Automatic expiry for `ignore --until` is still pending.
  `sync` wakes the configured spoke links. Native launch writes a durable
  intent for the selected node. A fenced host can also run the scheduler
  and reconcile launches. Commands outside the native list fail explicitly.
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
- **Watchdog.** A fenced node can scan retained tmux panes, check startup
  dialogs, nudge an idle pane after rechecking its identity, and journal
  alerts. `tracker watchdog alerts` and `tracker watchdog dry-run` use the
  same loopback routes as the retained client. Dry-run reports idle decisions.
  Automatic startup trust and missing-session relaunch still require host
  qualification and are disabled in this draft.
- **CoS watchdog.** The primary Mac can forward local watchdog alerts into
  its idle CoS tmux pane. A configured host driver can own peer relay. The
  separate primary Mac `com.danielfugere.cos-tracker-alert` LaunchAgent
  continues to own the 30-minute flagged-item tick via
  `~/chief-of-staff/bin/tracker-alert.py`. It reads `list --flagged --json`
  through the existing Tracker shim and keeps its own seen-state file.
- **Adapter polling.** Only the designated primary Mac can poll retained
  GitHub sources. It uses the existing source owner, cursor, and
  `adapter-runner.lock` beside the journal. The GitHub CLI binding uses an
  explicit, private account directory and the existing `tracked` label.
- **Other effects.** Fleet telemetry, job execution, and external backup
  scheduling remain out of the foreground configuration. Recurrence is
  enabled by a configured hub webhook.

## Host-effect configuration

Set `"hostEffects": { "mode": "held" }` to hold provider, watchdog, adapter,
notification, and recurrence workers while the operator reconciles ownership.
The API and configured signed links can still run. Omit `hostEffects` to retain
the pre-existing notification and recurrence configuration behavior.

An active config requires a private fence receipt with `"hostEffects": true`
and an exact matching checkpoint. The node must still hold its SQLite
lease and all listeners before any worker runs. Only configure bindings
whose ownership, credentials, and effect scopes the operator has verified.

```json
{
	"hostEffects": {
		"mode": "active",
		"checkpoint": "approved-cutover-01",
		"launch": {
			"maxConcurrent": 9,
			"legacyRunDirectory": "/absolute/retained/tracker/autolaunch",
			"managed": {
				"tmux": "/absolute/bin/tmux",
				"stateDirectory": "/absolute/private/tracker-attempts",
				"trackerBinDirectory": "/absolute/qualified/tracker/bin",
				"native": {
					"codex": "/absolute/bin/codex",
					"claude": "/absolute/bin/claude",
					"profile": "/absolute/private/native-provider-profile"
				},
				"docker": {
					"harness": "/absolute/qualified/managed-docker-harness",
					"image": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					"profile": "/absolute/private/docker-launcher-profile"
				}
			},
			"repositories": {
				"Harness": { "repo": "/absolute/repos/harness", "platform": "linux" },
				"iOS": { "repo": "/absolute/repos/ios", "platform": "macos" }
			}
		},
		"watchdog": { "tmux": "/absolute/bin/tmux", "chiefOfStaff": true },
		"adapter": {
			"scheduleDue": true,
			"dueDisk": { "freePct": 5, "freeGB": 50 },
			"github": {
				"executable": "/absolute/bin/gh",
				"configDirectory": "/absolute/private/tracker-github"
			}
		}
	}
}
```

`launch.due: true` enables due scheduling through the existing due-owner and
signed permit path. The primary adapter's `scheduleDue` opt-in works
independently. Its `dueDisk` limits apply to its due work and are checked
against the repository and managed worktree disks. `maxConcurrent` counts
retained running work, committed reservations, and independent live
sessions. Carry forward the verified host value.

To route tester corrections, configure `adapter.followUp` for one retained
GitHub task source. Set `target` to its `owner/repo`, `author` to the tester's
GitHub login, and `titlePrefix` to the project's Tracker title prefix.
`issueInstructions` describes the project's regular intake rules.
`instructions` supplies the tester's acceptance instructions and can use
`{issue}` for the GitHub issue number. Set `coveredComments` to a map of
GitHub comment IDs to existing full Tracker item IDs when earlier work already
covers those requests.

Set `adapter.manual: true` during activation to hold periodic polls while
leaving the designated runner available for explicit commands. First run
`tracker adapter run github:<owner/repo> --backfill-comments --dry-run`.
The preview covers comments created in the last seven days on currently open
issues. Apply confirmed actions with the same command without `--dry-run`,
then remove `manual` to resume periodic intake. Comment backfill preserves
the regular issue cursor. Item and comment receipts deduplicate subsequent polls.

Launch requests use a configured repository, and an item repository
override must match it exactly. Configure the lanes qualified on each host.
Linux uses plain Docker through the pinned Harness
`harness task orchestrate --platform linux` entry point and its managed provider
adapter. Mac-only projects use interactive native Codex or Claude in the
retained tmux socket on a registered Mac. The launcher creates a detached
task worktree and records the attempt key before opening the worker pane.
Worker profiles are separate private directories. The worker's host-side
Tracker client only receives the verified loopback role and port. The
generated client file holds inert placeholders for daemon-only paths.
Use the immutable native `harness` and `tracker` shim in the configured
tool directory so worker commands reach that foreground service.

The staged managed Docker runner keeps the guest on `--network=none`.
The separate relay fixture in #164 uses the attached streams for its
own protocol and does not compose with provider prompts and output.
Production Docker needs a qualified provider credential and egress path,
plus an item-scoped host-signed Tracker completion channel that works
alongside provider I/O. The optional node signer hook writes the private
per-attempt authorization file just before launch. Its path reaches only
the Linux host worker via `HARNESS_TRACKER_GUEST_AUTH_FILE`. The writer
receives the item, run, canonical attempt key and loopback port. The
worker removes the grant as it exits. This draft
provides the consumer and leaves the signer and guest route to that
integration. The host-side client binding keeps
the daemon socket, signing key, and credentials outside guest storage.
Worker exit alone never completes the Tracker item. Keep the Docker lane
held on the protected hosts until the production seams pass rehearsal.

### External provider driver protocol

Set `launch.driver` instead of `launch.managed` for a separately qualified
provider driver. It uses the same reservation, capacity and route checks.

The foreground service invokes a configured, owner-controlled executable
directly, with one operation argument and a version 1 JSON request on stdin.
It expects bounded JSON on stdout. The child receives a minimal environment.
It receives no Tracker database path, sync key, or ambient provider credentials.
The driver owns its provider credentials, worktree isolation, and detached
worker lifetime. Use the existing managed Docker provider stack for the
`docker` backend. A production binding for that stack and a live provider
rehearsal are cutover prerequisites.

- `inspect` receives `node` and the current reservation `keys` and returns
  authoritative sessions. Each session
  carries `itemId`, `key`, `id`, `state` (`live` or `exited`),
  and `startedAt` epoch milliseconds. Include `activityAt`, `exitCode`, and
  the managed `tmux` name when available. Exit receipts remain observable
  after the process ends. Failed or malformed inventories hold dispatch.
- `start` receives `node`, `itemId`, `runId`, `key`, `selection`,
  `queuedAt`, the approved `repo`, `platform`, `backend`, and the generated
  `brief`. Release at most one detached worker for that key. Return
  `{"status":"started","session":{...}}` once identity is known,
  `{"status":"pending"}` if the outcome needs observation, or
  `{"status":"rejected"}` only if no process could have started. A timeout
  or missing acknowledgement leaves the journal reservation pending.
  Persist a recoverable receipt before releasing the worker. Use the
  generated brief so the worker runs `tracker done` before cleanup.
- A retained live pane can be adopted from the configured tmux inventory.
  A custom driver can also return a session with `legacyRunId`, the exact
  `tmux` name, and an item ID or its six-character prefix. The service
  checks the existing local run and its start time before recording the
  host identity. When `legacyRunDirectory` points to the verified retained
  autolaunch directory, the exact local `run-<id>/exit` receipt also allows
  reconciliation after the old tmux pane disappears. The legacy session ID
  stays available to old readers.

For an explicitly qualified external watchdog bridge, use
`watchdog.driver` instead of `watchdog.tmux`. Its operations are
`watchdog-scan` (pane inventory or `null` when unavailable),
`watchdog-nudge` (compare the supplied pane identity and return
`{"sent":true|false}`), and `watchdog-cos` (deliver the alert IDs supplied
in the batch and return the same receipt shape). The bridge owns any
cross-host reads. The direct tmux binding uses the default socket on the
primary Mac and the `claude` and default sockets on MB2.

### Completed launch sessions

A retained pane identified by a finished local run no longer occupies launch
capacity or blocks another request for the same item. The dispatch tick sweeps
the node's own auto-launch socket. It closes a single, detached provider pane
only when the run and item are complete, ten minutes have passed since the
latest of completion and pane activity, and Tracker finds no unanswered flag or
other active owner. It checks the provider prompt and pane identity immediately
before closing, including the attempt marker for a managed launch.

Closure leaves provider transcripts and worktrees in place. Tracker adds a note
with the computer, closed session and provider resume command. Long-lived
control sessions fall outside the auto-launch name filter. Pending flagged
launches report `waiting on Daniel (flagged)` in autolaunch status.

### Legacy CLI inventory and remaining checks

Compared the `7acf3ca` CLI command switch and daemon routes with the native
routes. The primary Mac's `~/.local/bin/tracker` resolved to that release
during the inventory. The installed Codex and Claude instructions use it
for task updates, duplicate checks, and service status. The Chief of Staff
skill and briefs use `show`, and its cost-review brief uses `autolaunch status`,
`runs`, and `models report`. The `com.danielfugere.cos-tracker-alert` LaunchAgent
uses `tracker-alert.py` for `list --flagged --json`. The
`com.danielfugere.tracker-backup-pull` LaunchAgent runs `pull-tracker-backup.sh`
and writes the weekly artifact under `~/backups/tracker` independently of
the CLI. The inventory used local installation files and did not probe MB2.

| Legacy commands                                                                                                                                                           | Native path and scope                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add/plan/goal`, `list/show/update/rm`, `start/reopen/done/history`, `note/progress`, `block/unblock`, `ignore/unignore`, `flag/unflag/answer/resolve`, `check`, `digest` | Native item, history, check and digest routes. History remains hub-owned.                                                                                                                                                                                                          |
| `launch`, `launch on/off`, `unlaunch`, `pick`, `runs`, `models report`                                                                                                    | Native item and run routes. Launch records intent. The host runner executes it.                                                                                                                                                                                                    |
| `autolaunch [status]`, `autolaunch dry-run`                                                                                                                               | `GET /autolaunch` and `GET /autolaunch/dry-run` use the local runtime, stored state and configured due decisions. Dry-run inspects each due item without writing a token, reserving a slot, or contacting another node. Capacity across a batch remains a host admission decision. |
| `adapter list`                                                                                                                                                            | `GET /adapters` reads non-removed source records on the persisted or configured runner. Other nodes return the legacy ownership error.                                                                                                                                             |
| `backup list`                                                                                                                                                             | `GET /backup/list` reports regular backup files in `~/backups/tracker` or an absolute `backupDirectory` in native config. The native scheduler is external. The listing reports file metadata without opening backup contents.                                                     |
| `status`, `sync`, `ensure`, `help`                                                                                                                                        | Native status, sync and health routes, plus local help. Native `ensure` checks the configured supervisor listener.                                                                                                                                                                 |

- [ ] Wire owner-approved admin commands for `autolaunch pause/resume/clear-quota`
      and `reject`. Verify host admission, launcher limits, `ready/skipped`,
      repository mappings and live provider hold data before claiming full
      autolaunch status parity. Persisted quota holds are visible in status.
- [ ] Reconcile `machines`, `place`, `watchdog dry-run/alerts`, and `health
[--alert]` with the native host-process integration.
- [x] Wire `adapter run` and comment preview and backfill through runner ownership.
- [ ] Wire `adapter add/pause/resume/remove` and issue backfill.
- [ ] Bind external backup receipts for last result and next run. Qualify
      `backup now` and `restore --yes` with the backup owner and an isolated
      restore rehearsal.
- [ ] Qualify `agent register/list/rm`, `webhook status/pause/resume/test`,
      `cos-test`, `job set/list/rm/test`, and local `instructions [--check]`.
- [ ] Schedule ignore expiry on the hub. Compare remaining legacy output for
      recurring `history`, `check` match details, `rm`, and empty `list`.

## Rollback evidence

Identify the candidate by its Git SHA and launcher SHA-256. Identify the
retained Tracker release by its pinned Git SHA and launcher SHA-256.
Keep the fence checkpoint, database identity and pre/post-stop SQLite
fingerprints together. Preserve the database containing the candidate's
writes for rollback. Compare quiesced disposable copies with
`harness tracker verify-cutover` and verify that item, note and queued
operation identities remain readable before re-enabling the previous
manager. Verify fleet effect resumption separately under the cutover runbook.
