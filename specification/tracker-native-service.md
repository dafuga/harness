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
and `peer.listenPort`. The Macs also exchange run history over this link. Each
link reports on its own, so a hub that is down does not hold back the peer.
Fleet status still uses only the hub's machine samples.
Sync endpoints use HTTPS or literal IPv4 loopback HTTP.
An optional `accessFile` beside an upstream URL supplies `clientId` and
`clientSecret` for Cloudflare Access over HTTPS. The sync listener routes
only signed Tracker sync requests. Each spoke sends its local run records to
the hub through the signed machine exchange. Native spokes also report their
launcher heartbeat, active local run count, and current holds. Autolaunch status
uses recent samples to show per-host and per-request waits on the hub.
The hub stores them under the sender’s node and run ID for run history and
watchdog checks. The local API keeps
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
  `runs`, `models report`, and `pick` read the same native journal and support
  human-readable and JSON output. Use `tracker launch ITEM --model fable:high`
  to explicitly pin Fable for any project. Automatic selection excludes Fable.
  `models report` shows API-equivalent cost estimates with run coverage and
  ranges when retained Codex usage spans unknown context tiers. Managed native
  Codex receipts persist token counters when one rollout matches the attempt’s
  owned worktree. Older or ambiguous attempts may have no usage.
  `show` includes retained run history and the local schedule preview.
  Chief of Staff runs `tracker chase ITEM [--note TEXT]` when Daniel had to
  ask for an overdue update or reports a miss. Each journal entry records
  its actor, time and optional reason. `show` and `list` display the latest
  entry and cumulative count, including after `done`. `list --chased`
  includes completed items. The digest counts distinct items chased in the
  last seven days.
  `ignore` and `unignore` use journal transitions and retain the actor, notes,
  and prior status. The hub restores the previous status when an
  `ignore --until` deadline passes and records an expiry note. Date-only
  deadlines expire at midnight in the configured Tracker time zone.
  Ignores without a deadline stay in place until explicitly cleared.
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
- **30-minute digest.** The hub's `webhook` target gets updates and new
  needs-Daniel asks as one batch, at most once every 30 minutes. Quiet
  hours apply only to what is meant for Daniel. Chief of Staff and agents
  get asks, done and blocked lines, due events and reminders at any hour;
  Chief of Staff holds asks for Daniel until 08:00 Lisbon. A target is a webhook, such as the Grok Bot Chief
  of Staff, or a local tmux session running Claude Code or Codex:

  ```json
  "notifications": {
  	"targets": {
  		"claude": { "cli": "claude", "session": "cos", "tmux": "/opt/homebrew/bin/tmux" },
  		"codex": { "cli": "codex", "session": "codex-cos", "tmux": "/opt/homebrew/bin/tmux" },
  		"grok": { "url": "https://example.invalid/digest", "bearerFile": "/private/token" }
  	},
  	"webhook": "claude",
  	"suggestions": ["play guitar", "practice a language", "just relax"]
  }
  ```

  To switch, change `webhook` to another target ID and restart the service.
  Queued lines go to the new target. Session targets are digest only. Tracker
  types into one only while its composer is idle; a busy session is retried
  after two minutes. From 08:00 to 22:00 Lisbon each digest adds the next entry of
  `suggestions`; an empty list turns them off. Setting `webhook` also starts
  the hub's recurring scheduler.

- **Watchdog.** Configure `watchdog.tmux` on each fenced node to run a
  local health scan every ten minutes. Tracker reports missing sessions,
  startup pickers, stranded launches, orphan panes, and panes left after
  completion. It submits one check-in to an unflagged idle session and
  verifies provider activity. Codex receives a second Enter only while
  the same pane contains the watchdog draft. A second idle period
  escalates to Chief of Staff. The existing owned-session sweep closes
  finished idle panes when their linked items and identities allow it.
- **Recovery and handoff.** Tracker alerts on missing sessions and uses its
  normal dispatch path to recover eligible items with briefs after a grace
  period. It rechecks the live pane inventory before requesting recovery.
  Recovery and retry use the same gates as automatic pickup. Tracker holds
  personal and Chief of Staff work, reminders, non-task items, opted-out,
  blocked, inactive or parked items, and items waiting on Daniel. Titles
  containing `PROD DEPLOY` require an explicit launch for every attempt.

  The native `autolaunch.enabled` setting governs unattended launches.
  When omitted, the node follows the legacy setting in
  `~/.config/tracker/config.json` if present. Automatic launches run at any
  hour: quiet hours cover only what is for Daniel. The hub admits up to two
  automatic launch reservations in any rolling minute across the fleet.
  Connected spokes wait for a hub slot. If the hub is unreachable, a spoke
  still starts the due tasks it owns, using the same two-per-minute limit on
  its own slots. Unreachable means a timeout, a failed DNS lookup or
  connection, or HTTP 502, 503, 504, 521–524 or 530. A denial, any other HTTP
  error, a redirect, a certificate error or an unreadable reply holds the
  launch. A due pause or local-due opt-out that the spoke has already received
  still applies. Other automatic launches wait for the hub. Explicit launch
  requests get the first available local slots and bypass the rate limit.
  Each adapter can classify intake as urgent, normal or low. The configured
  GitHub tester rule marks issues and comments by its allowed tester logins
  urgent. Urgent items take the next free slot ahead of normal and low
  automatic work. If a tester request's primary is full, the hub can
  delegate the unclaimed request to an online Codex runner with the
  approved checkout, a free slot and enough disk for the source policy.
  Chief of Staff gets a queue alert after 15 minutes for urgent work and
  after 30 minutes for other pending launch requests. Use
  `tracker priority ITEM urgent|normal|low` to change an item's priority.
  Lists and digests display the current priority.

  For other open or in-progress tasks, the hub watchdog checks for owner
  activity, pending launches and active runs or panes before requesting
  dispatch. It checks at any hour, after two idle hours by default. Configure `hostEffects.watchdog.idleWorkMinutes` to change
  that threshold. The dispatcher chooses an approved computer, applies
  normal capacity and retries pending requests. The digest lists queued
  requests and their wait. A future due time holds unattended requests,
  claims and retries until the item is due. If the task has no approved placement, the
  watchdog alerts Chief of Staff. Ordinary tasks added by Daniel or
  Chief of Staff queue by default. `tracker add ... --later` records a
  24-hour pause. `tracker unlaunch ITEM` cancels a pending request and
  pauses automatic pickup for 24 hours. `tracker launch on ITEM` clears
  a pause early. The digest lists open pauses with the reason and expiry.
  Explicit manual intake keeps its source's launch policy.
  For active context above
  150,000 tokens, Tracker requests a short handoff once an owned pane is
  idle. Workers can also file their own checkpoint using a Tracker note
  that starts with `stopped: watchdog context handoff; resume from:`, then
  leave the item in progress and pause at the idle prompt. After verifying
  the note and original attempt, Tracker closes the pane and recovers
  the same item with the recorded model and effort in a fresh session.
  An overdue checkpoint alerts Chief of Staff while the item remains active.
  Busy, attached, and unowned panes
  require Chief of Staff attention. Transcript roots allow local context
  measurement without including transcript contents in alerts.

- **Chief of Staff.** `tracker needs-attention` and `tracker watchdog alerts`
  show active watchdog alerts with the item, computer, and session.
  `tracker watchdog dry-run` previews idle, startup, and recovery
  decisions without taking action. Set `watchdog.chiefOfStaff` on the
  primary Mac to deliver alerts to its idle CoS tmux pane and include MB2
  alerts over the existing host-key-verified SSH link. Delivery observes
  Lisbon quiet hours and the thirty-minute cadence for routine alerts. The hub
  checks each enabled launcher's last completed tick about once a minute.
  A heartbeat more than three minutes old prompts a Chief of Staff alert
  outside the routine cadence during delivery hours. Tracker sends one alert
  per missed heartbeat and clears it from the active list when polling resumes.
  Alerts waiting for a live CoS pane stay in the CoS queue during a normal turn.
  Tracker retries them on the first watchdog tick with an idle prompt, even
  inside the routine cadence. During delivery hours, Tracker asks Daniel after
  the pane stays busy or fails to accept delivery for 30 minutes, or an outage
  or security alert waits 30 minutes. With no live pane, routine alerts retain
  their one-hour grace period. The delivery reminder closes on the tick that
  confirms the queue is empty. Hub suppresses answered or done reminders even
  when a linked computer still holds the earlier open copy.
  The separate tick can still read `tracker list --flagged --json` for decisions.

  CoS dependency messages are delivered once per item and message text.
  When tmux misses an acceptance, Tracker checks Claude's recorded prompt
  or queue receipt before retrying. Changes to the dependency text can
  trigger a new alert. Open blockers continue to appear in the daily digest.
  CoS batches carry up to four alerts within a 450-byte composer budget. A long alert uses its item ID
  and a short sentence, with full details available in Tracker. The batch
  includes the slot summary when it fits.

  Tracker sends the first ask, follows up two and six hours after the first
  delivery, then repeats at 08:00 Lisbon each morning. These reach Chief of
  Staff at any hour. If both follow-up times have passed, the next repeat
  waits for the next 08:00.
  Each ping includes how long the ask has waited. The digest shows every
  open ask, including deferred and completed-item asks. Record Daniel's
  answer with `tracker answer`, or use `unflag` or `ignore` to dismiss an
  ordinary ask. iPhone push delivery depends on the separate `0wn8nf` rollout.

  A Hub or CLI answer to an assigned task is routed to its current Codex or
  Claude pane. Tracker waits for an idle composer, records the computer and run
  once submission is confirmed, and alerts Chief of Staff if delivery stays
  pending. An answer that releases a finished blocked run allows the watcher to
  relaunch the task. The answer stays available on the item during recovery.

  Chief of Staff files ideas when Daniel raises them and sets the project.
  Use `add --next-step` or `update --next-step` to record a decision. Use
  `done --next-step` when work finishes with a decision outstanding. That
  completion records the work result while the question stays on the Lisbon
  follow-up schedule. The digest lists the project, decision and its age even
  if the project has no active runs. `answer` records a reply and leaves the
  next step available for an explicit decision to move on.

  Daniel can use `tracker park ITEM --until DATE` to hold pings until 08:00
  Lisbon on that date, or pass an ISO timestamp with a time zone. The digest
  shows the hold while the flagged worklist and reminder destinations wait.
  `tracker move-on ITEM` records his decision and closes the item. These
  commands use the trusted local Tracker actor and reject managed CLI
  runners. Chief of Staff may relay Daniel's explicit decision with
  `--by Daniel`. The actor is a local audit label.

- **Adapter polling.** Only the designated primary Mac can poll retained
  GitHub sources. It uses the existing source owner, cursor, and
  `adapter-runner.lock` beside the journal. The GitHub CLI binding uses an
  explicit, private account directory and the existing `tracked` label.
- **Dispatch watchdog.** A dispatch tick has two minutes to finish.
  On timeout the scheduler cancels that tick and resumes polling. The
  next tick reconciles reservations for which a host start may have
  happened before the reply was lost. Host commands have a separate
  deadline and settle on child close, with an exit-event fallback when
  close does not arrive. A partial response is discarded.
- **Fleet telemetry.** Each node samples itself; see
  [Computers and placement](#computers-and-placement).
- **Box jobs.** A recurring item on the hub can run a shell command at each
  occurrence in place of waking a bot. Use
  `tracker job set ITEM --cmd 'C' [--wake-on finding|fail|always] [--timeout S]`
  and `tracker job list`, `rm ITEM` or `test ITEM`. Exit 0 records the
  occurrence as done. Exit 10 also records it as done and wakes the owner
  with the output as `finding`. Any other exit or a timeout records it as
  failed. `wake-on` defaults to `finding`; `fail` adds failures and `always`
  wakes after every run. `test` runs the command now and records nothing.

  Commands run at low priority under `/bin/sh` on the hub's own computer,
  two scheduled jobs at a time, in `jobs/state/ITEM` beside the journal. They
  receive `TRACKER_ITEM_ID`, `TRACKER_OCCURRENCE`, `TRACKER_STATE_DIR` and a
  limited environment (such as `HOME` and the service's `PATH`) without the
  service's other variables. Each command's process group is killed on exit,
  timeout and shutdown. Output keeps the first 8 KB, with obvious secrets
  redacted. An item with a job still waiting or running skips the next
  occurrence, which later shows as missed. A job interrupted by shutdown or
  a crash records a failure and is never rerun; after a crash its processes
  may still be running. The latest receipt for each item is in
  `jobs/receipts`.

  Job definitions live in the local, unsynced `box_jobs` table. Only the
  hub's loopback API can set them. A hub migration must carry those rows to
  the new journal or set them again, and the commands' scripts and paths must
  exist on the new hub's computer.

- **Other effects.** External backup scheduling remains out of the
  foreground configuration. Recurrence and box jobs are enabled
  by a configured hub webhook.

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
				"opsWorkdir": "/absolute/approved/operations-directory",
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

On the two Macs, set `hostEffects.launch.managed.opsWorkdir` to an existing
absolute directory approved for native operations work. An item without an
explicit repository or project uses this directory if its agent has no
repository mapping. Tracker runs the session there directly and keeps the
brief and launch receipts in its per-attempt state directory. A mapped agent
still uses its repository. Due Chief of Staff tasks may use this route when
due scheduling is enabled, subject to the usual eligibility and grant checks.

`launch.due: true` enables due scheduling through the existing due-owner and
signed permit path. The primary adapter's `scheduleDue` opt-in works
independently. Its `dueDisk` limits apply to its due work and are checked
against the repository and managed worktree disks.

The Mac launcher defaults to 20 concurrent sessions. `maxConcurrent` is an
explicit ceiling for running and verifying sessions and committed launch
reservations. It advertises and admits up to one new session per GiB of
available RAM above the existing 25% reserve. The disk and inode checks still
apply at launch. Automatic placement and due-start grants keep the stale
telemetry, memory, swap and disk checks. Placement estimates CPU cores and RAM from the upper quartile of recent
process-group peaks for light agent or heavy test work, with defaults for
new installations. It scores the workload ratio against each host’s cores
per GiB, then packs work into available CPU and RAM below 80% and 75%
utilisation targets. The Hub shows actual readings next to both targets.
A scheduling round deducts already assigned demand when ranking the next
run. Mac launch CPU utilisation affects ranking. Heavy test placement uses
CPU and RAM fit and retains the overload guard.

For the combined release that enables RAM-based placement, set
`hostEffects.launch.maxConcurrent` to 20 on `harbor-mbp-2` in place of its
emergency value of 5. Carry forward 20 on `daniel-primary-mbp`. Preserve any
explicit `nonHarborSessionLimit` if configured. Verify both installed ceilings
and each host's RAM-limited free slots after activation.

Managed full checks and browser suites use the separate macOS heavy test
lanes. On a Mac with at least 10 cores, the first two suites can run at
background priority and subsequent suites wait for a free lane and lower
load. Use `harness resources run --heavy-test -- <command>` for other heavy
suites. In a managed session, `tracker host-work ssh auto -- <command>`
chooses an eligible Mac for a portable CPU-heavy command and runs it through
the managed lane with the estimated budget. Remote execution uses the
existing SSH route for that Tracker computer. The command must use paths
available on either target. Follow any suite-specific host restriction.
The lane policy leaves production monitors outside the heavy test queue.

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
Native Codex and the Docker launcher use separate private profile directories
as their homes. Native Claude uses the service account's home and login name
to find its existing Claude Code session. Point `native.claude` at the
installed Claude Code executable when using the default account configuration.
A wrapper that overrides `CLAUDE_CONFIG_DIR` can hide the saved sign-in.
Tracker runs `claude auth status` in the worker's account environment before
creating the attempt worktree. It refuses a signed-out or unverifiable CLI.
New Claude attempts stay queued until the tmux pane reaches its composer.
A sign-in screen, first-run theme chooser, or two minutes without a composer
counts as a startup failure and follows Tracker's retry and flag policy.
Tracker saves the startup verdict without retaining the captured terminal text.

The worker's host-side
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

### Launch resource guards

The managed launcher reads this computer before every launch, including
explicit ones. A hold keeps the request queued, reports
`Tracker host resource hold: <reason>` as its wait reason, and spends no retry
or recovery attempt. An external driver owns its own host and is not sampled.

- Available RAM must be at least `launch.minAvailableMemMB` (default 2048).
- The home, repository (or operations workdir) and managed state filesystems
  need `launch.minFreeDiskGB` (default 5) free, at least 50,000 free inodes
  and 1% of inodes free. An unreadable filesystem holds the launch.
- On the primary Mac, MB2 and the box, the home filesystem needs 30 GB free.
  Disk percentage does not hold a launch.
- The Macs need at least 25% free memory (unknown holds) and a one-minute load
  under 15. They also hold when the five-minute load exceeds 1.5 per core. Other
  hosts use that sustained-load threshold and hold while free memory is under 10%.
- The shared box also waits while busy: load over 1.0 per core, free memory
  under 15%, or under 100,000 or 3% free inodes.

On MB2, Harbor is the home project and its requests are considered first. All
other work gets one session at a time, only while the one-minute load is under 4. Its worker runs under `nice -n 10` with a four-core budget in
`TRACKER_CPU_BUDGET` and the CMake, Cargo, Make, OpenMP, Rayon and Go
parallelism variables, and its brief states the budget. These cap
cooperating build tools; they do not enforce a hard CPU limit.

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
other active owner. When a worker runs `tracker start` for another item, the
local journal also links that item to the worker's run. The pane stays open
until each linked item is done and its grace period has passed. The sweep checks
the provider prompt and pane identity immediately before closing, including the
attempt marker for a managed launch.

Closure leaves provider transcripts and worktrees in place. Tracker adds a note
with the computer, closed session and provider resume command. Long-lived
control sessions fall outside the auto-launch name filter. Pending flagged
launches report `waiting on Daniel (flagged)` in autolaunch status.

### Launch events and waiting requests

The transaction that changes a run also records its launch event: launched, done,
blocked, failed, escalated, gave up or launch failed. Ten minutes after the oldest
unsent event, the node settles them as one `autolaunch` summary. Only a hub with a
webhook queues it. As in the legacy sender, Chief of Staff batch mode drops the
summary (`webhook.batch: false` delivers it) and sends only its item batch.

A due request adds a note naming its computer and model. Before a request has a
run, `show` reports `launch_status` with its computer and wait reason. Autolaunch
status lists unstarted requests as `ready` or `skipped`.

### Stop a managed session

Run `tracker stop <item>` or `tracker stop '#<local run number>'` on the
computer that owns the run. Tracker clears the launch request and opts the
item out before terminating the verified tmux session. The run remains in
history and the task status stays available for follow-up. Use an explicit
launch to start a new run or `tracker launch on ITEM` to allow unattended
pickup again.

### Reminder items

Use `tracker add --reminder --at <ISO timestamp with a time zone> "Title"`
to create an item that only delivers reminders. Use
`tracker remind <id> --at <time> --reminder` to convert an existing item,
or `tracker remind <id> --at <time>` to snooze a reminder. Reminder items
never start or recover a session, including when an explicit launch is
requested. The hub delivers to Chief of Staff at the scheduled time,
including overnight, and follows up after two
hours, six hours, and at 08:00 daily until the item is done or snoozed.

### Repeating reminders

`tracker add --reminder --every "0 10 * * 0" "Title"` creates a reminder that
repeats (`--tz` defaults to Europe/Lisbon; `--at` may set the first time).
`tracker update <id> --every "<cron>" --kind reminder` makes an existing item
repeat. The item has one armed time, `remind_at`. `tracker done <id>` records
this one as done and arms the first scheduled time after both now and the armed
time, so done before the time skips it. `--occurrence <armed time>` refuses a
second done once the reminder has moved. `tracker remind <id> --at <time>`
snoozes this one only; the schedule stays. Nothing else re-arms it: until it is
done or snoozed it follows up like any reminder. To end the series, run
`tracker update <id> --every none`, then `tracker done <id>`. The recurring job
scheduler ignores reminders. Every computer needs this release before it can
create or finish a repeating reminder.

### Scheduled reminders on other items

Use `tracker remind <id> --at <ISO timestamp with a time zone>` for an
active item. Convert requests such as “remind me tomorrow at 14:30” to an
absolute timestamp using the person's time zone. Use the command again to
reschedule. Normal item lists and `tracker show` expose `remind_at` in UTC.
While the reminder is in the future, `tracker list --flagged` and the text
and JSON digests omit the item. This also hides it from the Chief of Staff's
status tick. The reminder time is stored separately from the item's flag,
question, due date and dispatch state.

At the requested time the item becomes eligible for its normal digest sections.
The hub's notification worker sends the explicit reminder on the first
available poll, including during quiet hours. It uses the configured direct
Chief of Staff destination, its webhook, or the primary Mac's existing CoS
host binding. An unavailable destination is retried. Resolving, unflagging,
unblocking, closing, ignoring or deleting the item cancels its reminder.
The journal replicates the reminder time and the hub stores delivery receipts.

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
| `launch`, `launch on/off`, `unlaunch`, `pick`, `runs`, `models report`                                                                                                    | Native item and run routes. A manual launch confirms the recorded run or reports its exact hold.                                                                                                                                                                                   |
| `autolaunch [status]`, `autolaunch dry-run`                                                                                                                               | `GET /autolaunch` and `GET /autolaunch/dry-run` use the local runtime, stored state and configured due decisions. Dry-run inspects each due item without writing a token, reserving a slot, or contacting another node. Capacity across a batch remains a host admission decision. |
| `adapter list`                                                                                                                                                            | `GET /adapters` reads non-removed source records on the persisted or configured runner. Other nodes return the legacy ownership error.                                                                                                                                             |
| `backup list`                                                                                                                                                             | `GET /backup/list` reports regular backup files in `~/backups/tracker` or an absolute `backupDirectory` in native config. The native scheduler is external. The listing reports file metadata without opening backup contents.                                                     |
| `status`, `sync`, `ensure`, `help`                                                                                                                                        | Native status, sync and health routes, plus local help. Native `ensure` checks the configured supervisor listener.                                                                                                                                                                 |

The native CLI confirms a manual launch against the run for that exact request.
It reports the run number, state and computer, or exits non-zero with the
admission reason. If the target has not reported an outcome within 20 seconds,
the CLI reports the timeout. A hold or timeout leaves the request pending.
After an answer, reopen, or unblock releases an item with only finished attempts,
an explicit launch starts a fresh request and keeps the blocked run in history.
The CLI points to `tracker show ITEM` for the current outcome and to
`tracker unlaunch ITEM` if the new request is still pending and should be cancelled.
`tracker launch on` and `tracker launch off` still set the due-scheduling preference.

The primary watchdog alerts CoS when a request has no matching run after
60 seconds. It checks both local and replicated runs, sends one alert per request,
and clears the alert when the request is withdrawn or receives a run. Spokes
send signed updates promptly when their launch holds or run state change.

While an attempt's session is live, crossing its ETA and inactivity limit or its
run cap raises an overdue alert and preserves its run ID and slot. The activity
clock includes Tracker item updates, pane output, and a quiet pane reporting a
background shell or monitor. Use `tracker stop <item>` to end a hung attempt.
Session check-ins are eligible for delivery while the item is in progress and
the host observes its session. Completing the linked credential rotation clears
the exposure alert. A new detection can reopen the rotation.

To replace a pending managed launch, run `tracker unlaunch <item>` and then
`tracker launch <item>`. The local launcher retires an undispatched queued run in the
same write that cancels the request. After five minutes, it also retires an undispatched retry whose item
became ineligible, preserving any open question. For a dispatched reservation,
expiry requires absence of the exact tmux session and all startup or exit
markers. An eligible request can retry within its existing retry limit. Old
rows remain in run history as abandoned. Live or uncertain attempts continue to
fence new launches for the same item while the scheduler considers other work.
A queued legacy run without a native reservation can also expire after five minutes
when the managed launcher confirms the exact session and its receipts are absent
and the verified legacy run directory and tmux inventory contain no startup evidence.
Consumed tokens remain recorded for deduplication and are excluded from the pending
dispatch scan.

### Launch holds

`tracker autolaunch pause` and `resume` run on the hub (a spoke returns 409). The
choice persists, and the hub sends it with every journal pull. A spoke keeps the
last value it received while the hub is unreachable. The pause stops due launches
only. A hub with `launch.due: false` does not pause its spokes.

On each scheduler tick the launcher reads the panes of its own runs. A usage-limit
or empty-credit notice behind the CLI's own glyph holds all new starts of that
provider on that computer, including manual launches, retries and relaunches. A
warning that work continues on credits does not. The hold records one watchdog
alert with a note on the item, and watchdog relaunch attempts are not used up
while it lasts. It stays until `tracker autolaunch clear-quota <codex|claude>`
runs on that computer, even after the provider's limit resets. Notices already
seen cannot restore a cleared hold. Detection needs a tmux executable. Placement
on another computer does not read these holds.

`hostEffects.launch.codexPausedUntil` (ISO time) holds Codex starts until then.
Change it in the configuration and restart the node.

### Remaining commands

- [x] Wire `reject` and post-done verification (see Completion review).
- [x] Wire `autolaunch pause/resume/clear-quota`, quota holds and the Codex pause.
- [ ] Verify host admission, launcher limits, `ready/skipped`,
      repository mappings and live provider hold data before claiming full
      autolaunch status parity. Persisted quota holds are visible in status.
- [x] Wire `machines`, `place`, resource history and overload alerts (see
      Computers and placement).
- [ ] Reconcile `watchdog dry-run/alerts` with the native host-process
      integration.
- [x] Wire `health [--alert]`, log rotation and host supervision (see Health,
      logs and host supervision).
- [x] Wire `adapter run` and comment preview and backfill through runner ownership.
- [x] Wire `adapter add/pause/resume/remove` and issue backfill. Changes run on the
      designated runner under the poll lease; a running poll refuses them with a retry
      message. `adapter add --dry-run` previews on any configured node and writes nothing.
- [ ] Bind external backup receipts for last result and next run. Qualify
      `backup now` and `restore --yes` with the backup owner and an isolated
      restore rehearsal.
- [ ] Qualify `agent register/list/rm`, `webhook status/pause/resume/test`,
      `cos-test`.
- [x] Wire local `instructions [--check] [file...]`. It needs no service or config. The
      canonical block ships with Harness and names only native commands.
- [x] Print human `history`, `check` and refused-duplicate matches, and the model pick
      after `add`. `block` accepts `--no-needs-daniel`; `--needs-daniel` points to `flag`.
- [x] Schedule ignore expiry on the hub.
- [ ] Compare remaining legacy output for `rm` and empty `list`.

## Computers and placement

Each node samples its CPU load, memory, swap, disks and agent sessions once a
minute. Command lines are read only to classify test runners and Playwright
browsers and never leave the sampler. A spoke adds its sample to the signed
machine exchange. The hub keeps 30 minutes of per-minute samples and seven
days of five-minute history in the retained `machines*` tables, and returns
every computer's latest report to each spoke. Samples stay out of the journal.
Sampling is read-only, so it also runs while host effects are held.

- `tracker machines [name] [--hours N]` shows each computer as `ok`, `busy`,
  `overloaded` or `offline` (no sample for five minutes), with its reasons. A
  name also shows its heaviest sessions and history. A spoke has only the
  history it received while running.
- `tracker place [--kind codex|claude|browser-tests|build|general]
[--needs-ram GB]` ranks computers by headroom and role and names the best
  one that fits.
- A computer is overloaded when its 5-minute load exceeds 1.5 per core,
  available memory is under 10%, macOS reports critical pressure, swap grew
  more than 512 MB in 10 minutes, or a disk has under 20 GB free. Busy uses 1.0
  per core, 15%, pressure warnings, 256 MB and 30 GB. Unlike the retained
  Tracker, a low free percentage alone does not count.
- When `hostEffects.watchdog.chiefOfStaff` is set on the hub, a computer
  overloaded for 10 minutes gets one `Computer overloaded: <node>` item and an
  `overload` watchdog alert with its heaviest sessions and a suggested move.
  It never asks Daniel. After 10 calm minutes the item closes and the alert
  clears. An ignored item is not raised again.
- A launch without a computer preference, or with `--computer auto`, considers
  polling launchers that map the project and have free slots. Light sessions
  favor available RAM and slots on memory-rich computers like MB2. Builds and
  portable browser tests favor free cores on CPU-rich computers like the primary
  Mac. Desktop computer-use and Chrome work queue on the primary Mac. A named
  computer or checkout keeps its target. With no known fit, portable launches
  use the local default. Due tasks keep their configured ownership rules.
- The hub assigns a queued launch that names no computer to such a peer, with
  a note, and keeps it otherwise.
- The hub grants a due start to a peer that reports resources only while its
  sample is at most 135 seconds old and its session admission checks pass.
  Mac sessions use memory, swap and disk admission checks. Mac heavy-test lanes
  have a separate CPU load guard. A peer that has never reported resources
  keeps its grant and applies its local checks.

### Work sent to another computer

From a managed Tracker run, wrap a foreground remote check or build:

```sh
tracker host-work ssh mb2 -- ssh harbor-mbp-2 ./run-checks.sh
tracker host-work colima mb2 -- ssh harbor-mbp-2 ./run-colima-proof.sh
```

Pass the Tracker computer as the destination. The command can use its usual
SSH alias. Keep startup, verification, and task-owned teardown inside the
foreground command for a Colima proof. Raw SSH commands and detached work
outside its lifetime have no lease.

The local Tracker records the origin run and renews the lease while the
command runs. The signed fleet exchange carries the destination and expiry.
The Hub computer chip counts an origin run once per destination even if it
has multiple leases there. The count clears when the command releases its
lease or when the run finishes, and expires after 150 seconds without a renewal.
Launcher admission uses the destination's sampled operating-system load.

## Health, logs and host supervision

`harness tracker health [--alert] [--json] [--config PATH] [--log FILE]...`
runs in its own process, so it also reports a stopped service. It exits 0 when
healthy, 1 when a check fails and 2 when it cannot run. It checks the local API;
on a hub the sync listener, webhook delivery and, once native backups report
`enabled`, backup freshness; on a spoke the hub link. Every node checks for a
second long-lived service on the same config, free database disk and load, and
Linux also checks available memory. Quiet peers, a paused webhook, disabled
backups and a host that cannot list processes are information only.

With `--alert`, a newly failing check flags one `Tracker health on <node>` item
and repeats daily while it fails. Backup failures are reported here but asked
only by the backup service. Once every other check recovers, the item is noted
and closed, even while the backup alert stays open. An ignored item is never
raised again. An alerting run waits 20 seconds and asks
the API again before calling it down. When the Tracker cannot record the alert,
or the webhook check or a spoke's hub link check fails, it also posts to the URL
in `health-fallback.url` with the bearer key in `health-fallback.key`. Both are
private files beside the native config; the URL is HTTPS or literal IPv4 loopback. The fallback waits out
22:00-08:00 Lisbon unless the Tracker could not take the alert because its API
is down. Alert state is kept in `<database>.health.json`. Without `--alert`
nothing is written or sent.

Each `--log` file, and the supervisor log, rotates above 5 MB by copying to
`<log>.1` and truncating, because the writer keeps the file open for appending.

`harness tracker service print|install|uninstall [--config PATH]
[--executable PATH]` sets up the current host. `print` changes nothing. A
launched session's `HARNESS_TRACKER_CONFIG` is a client stub, so `health` and
`service` refuse it; pass the node's own config with `--config`.

- **Linux with systemd:** user units run `serve` with `Restart=always` and run
  the health check 5 minutes after the timer starts and every 4 hours Lisbon
  time. The journal owns log rotation.
- **Linux without systemd:** a marked `~/.bashrc` line starts `tracker
supervise`, and install starts it at once. The supervisor holds one lock per
  database, restarts `serve` with backoff, rotates `<database>.log` and runs the
  same health schedule. After a container restart it starts with the first new
  shell.
- **macOS:** the existing `local.harness.tracker` agent keeps supervising the
  service. Install adds `local.harness.tracker-health`, which runs every 4 hours
  in the Mac's time zone, runs whichever executable the service agent names and
  rotates that agent's log files. The executable must include `tracker health`.

## Completion review

- **Verify.** A managed macOS route may set `verify` to a shell command, for
  example `"verify": "~/.bun/bin/bun run test"`. After `tracker done`, the run
  waits in `verifying` while the command runs in that run's worktree under
  `/bin/bash -lc`, with a clean environment and a 30 minute limit. Its process
  group is killed on exit, timeout and shutdown. Exit 0 records `done`. Any
  other exit reopens the item with the last output lines as a note, records
  `failed` and retries within the normal limit. Output matching a known
  credential format is withheld from the note. A restart runs an interrupted
  verify again; reopening the item stops it. Runs record their checkout in
  `source_repo`, which selects the command, so routes sharing a checkout must
  agree. Linux (Docker) routes and external launch drivers refuse `verify`:
  their worktrees must not run on the host. Done notifications and callbacks
  are still sent when the session reports done, before verification.
- **Reject.** `tracker reject ITEM [reason...]` reopens a completed item. When
  this computer's latest attempt produced the completion, that run becomes
  `rejected` and retries within the normal limit. Otherwise the item is only
  reopened. It refuses an item that is not done, a run that is still finishing
  or verifying, a run owned by another computer, and launched runs.
- **Human redo.** When a done item has failed, rejected or timed-out attempts
  with no active attempt and no later successful one on any computer, the
  owning computer records `redone_by` as `human`.

## Launch settings

- **Run limits.** `launch.maxRetries` (default 1), `defaultEtaMinutes` (120),
  `stallMinutes` (45) and `maxRunMinutes` (480) override the dispatcher on that
  host. Closing finished sessions has no setting here.
- **Routing.** The optional top-level `routing` object sets `ladder` (effort and
  price for the built-in `haiku`, `terra` or `sol` model IDs),
  `learning.minSamples` (3), `learning.upBelow` (0.5) and `claudeOnlyUntil`.
  Launch, retry and `tracker pick` share it; run reports list the same ladder.
- **Learning.** A first launch reads finished runs on similar tasks, local and
  replicated, as `tracker pick` does. History only moves a task to a stronger
  rung. Pinned items ignore it, and retries step up the route without it.
- **In place.** On a managed macOS route, a directory outside git runs in place,
  as does a route with `"worktree": false`. Sessions there share the directory,
  and `verify` runs in it. A git failure other than "not a git repository" still
  rejects the launch, and Docker workers never run in place. In-place Codex runs
  report no token usage, because a shared directory cannot identify the rollout.
- **Retired model.** A queued, unstarted `gpt-6.1-sol` run starts on
  `gpt-6.2-sol`.

These keys are new. An older release rejects a node configuration that sets
them, so remove them before rolling back.

## Release copy and soak

Stage the release locally under
`~/.local/state/tracker/harness-releases/<id>/` with its `SHA256SUMS`. Copy it
to every other computer with the checked-in script, from the release revision.
Do not copy a previous session's staging script or run `rsync` into the
releases folder by hand.

```sh
scripts/tracker-release-copy.sh copy ~/.local/state/tracker/harness-releases/<id> <ssh-host>
# after activation on every computer; waits 15 minutes, so run it in the background
scripts/tracker-release-copy.sh soak <id> <ssh-host>...
```

A failed or timed-out copy can leave an `rsync --server` receiver running on
the other computer. It keeps a handle on its destination directory, even after
that directory is renamed. With `--partial` it can later rename a partial file
over the real one: this truncated a live `harness` binary 11 minutes after a
release which had passed its checksums. `copy` therefore:

- gives every attempt a fresh directory and never uses `--partial`, so a retry
  sends the whole release again;
- kills the release's receivers and confirms none remain before each attempt,
  after a failed or interrupted one, and before publishing. If it cannot
  confirm this, it publishes nothing;
- publishes a local copy, made on that computer, in a directory `rsync` never
  wrote to, after checking `SHA256SUMS` and the signature.

`soak` checks `SHA256SUMS`, its match with this computer's copy, the signature
and the absence of receivers on this computer and every named host. A release
is not done until it exits 0. Treat any `FAILED` line as a broken release: do
not restart that computer's Tracker until its files verify again.

If the connection is lost altogether, `copy` warns that it could not stop the
receiver. Run `copy` again once the host is reachable; it stops leftovers first.
`HARNESS_RELEASE_BWLIMIT` sets the transfer cap in KB/s (default 2000).

## Rollback evidence

Identify the candidate by its Git SHA and launcher SHA-256. Identify the
retained Tracker release by its pinned Git SHA and launcher SHA-256.
Keep the fence checkpoint, database identity and pre/post-stop SQLite
fingerprints together. Preserve the database containing the candidate's
writes for rollback. Compare quiesced disposable copies with
`harness tracker verify-cutover` and verify that item, note and queued
operation identities remain readable before re-enabling the previous
manager. Verify fleet effect resumption separately under the cutover runbook.
