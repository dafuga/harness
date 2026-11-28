# Project module progress on Home

Tracker's loopback project progress read supplies the Mac Home renderer and the encrypted answer used by Hub web and iPhone Home. The CLI reads the same plan with `tracker progress --project <name>`. First release includes only that milestone's modules. Full includes every module. Built and Live count toward completion. In progress has its own lighter segment. Opening a project shows its modules by state.

## Harness

- Full comes from active entries in the merged unit registry. Retired entries and historic work items do not expand the denominator.
- The current release scope in [the generated scope file](harness-first-release-modules.json) uses the recorded primary Mac source baseline and the pinned f08g99 release candidate. To refresh it, diff those two revisions with `git diff --name-only <baseline> <candidate>`, then select active candidate registry units with an owned source path in that diff. Store the full SHAs and sorted unit IDs. The scope contains the registered units in the release delta, including the changes already merged into its base.
- The candidate's modules, work started in the module task queue, and matching Phase 4 Tracker work contribute to In progress. A module counts as Built when a current accepted attempt has a passing proof record that ran checks, the proof commit is in the integration history, and the owned and verification files still match it. Legacy accepts without recorded proof remain In progress. The initial strict count can be zero while proofs are reconciled.
- Live requires a recorded deployment and observed acceptance of that module on its intended target. The existing acceptance queue supplies build evidence. There are no module-level live records in the current Harness snapshot.

## Harbor

The reviewed plan resides in `dafuga/harbor:specifications/project-module-plan.md`. Tracker reads it from its local Harbor checkout's fetched `origin/main` and recognizes an explicitly approved plan only. A Built row cites its merge revision and passing acceptance proof. A Live row also cites the deployment readback. The review verifies those links against each owning repository before integration. Draft plans show a review state.

Both source checkouts conventionally live under `~/projects` on the Tracker computer. A missing or unreadable proof source leaves the affected plan unavailable. Older linked Macs can still serve Home without the module fields. The encrypted live response remains separate from persisted Hub snapshots.
