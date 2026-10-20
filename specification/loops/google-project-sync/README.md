# Google account projects across devices

## Behavior to prove

Sign in with the same Google account on Web, Electron or iOS. The account's
project list includes projects it owns and projects whose invitations it has
accepted. A project appearing on one device becomes discoverable on another
open device without signing in again. Invitation acceptance is still explicit.

A local folder does not become a hosted project merely because its owner signs
in. Shared projects use the existing connected GitHub repository and membership
records. Sharing a project does not upload unrelated local folders.

| Membership | Read | Comment | Ask an agent to change code | Manage members |
| ---------- | ---- | ------- | --------------------------- | -------------- |
| Reader     | Yes  | No      | No                          | No             |
| Commenter  | Yes  | Yes     | No                          | No             |
| Writer     | Yes  | Yes     | Yes                         | No             |
| Owner      | Yes  | Yes     | Yes                         | Yes            |

The server checks membership and capabilities on each request. Knowing a project
ID, possessing a cached screenshot, or being paired with a Mac grants no hosted
membership. Accepted invitations bind the verified Google identity; devices do
not maintain independent invitation lists.

## Refresh and isolation

The shared refresh coordinator handles focus, visibility and reconnection, plus
a bounded interval while visible. It avoids overlapping refreshes and releases
timers and listeners when its view is disposed. Hidden clients stop polling.
Unchanged project discovery must not fetch every project's snapshot again.

Changing accounts removes the previous account's project views before displaying
the next account. A late response from the previous account or a disposed view
must not restore them. Removal from a current membership list purges protected
desktop cache entries; an older offline list must not resurrect removed projects.
Revoked device sessions return to sign-in. Temporary network failure preserves
the saved login and never authorizes writes from an offline copy.

## Platform boundaries

Web keeps its opaque session in a secure, HTTP-only cookie. Electron keeps its
device credential in the existing OS-encrypted main-process store. iOS keeps its
own account credential in a separate device-only Keychain namespace and opens
the trusted hosted Google approval flow in Safari. Credentials and PKCE verifier
material never enter renderer status, links or screenshots.

The iOS account lane is independent of pairing. Pairing remains the way to reach
explicitly granted local Mac projects; unpairing must not remove an independently
authorized hosted project. Hosted request failures must never fall back to a
different authority.

## Standardized proof

The existing native connection, workspace projects, remote projection, Capacitor
environment, remote disconnect, native authentication, Hub session and hosted
access suites cover these behaviors. Server membership characterization covers
one person owning one project and accepting an invitation to another.

Test-only commits precede the product repair. Immutable red/green checkpoints in
this loop record their revisions, unchanged commands, test hashes and results.
The browser scenario uses two isolated clients of a synthetic account; it is
evidence of client behavior, not evidence of a live Google provider deployment.

## Live configuration boundary

The checked-in Hub resource names and database ID are placeholders. Live Google
sign-in requires a dedicated Google web client, a session secret, an exact HTTPS
Hub origin and provisioned auth storage. Connected shared projects also need the
dedicated GitHub App, collaboration repository and projection storage described
in `packages/hub/README.md`. Native builds must name that same public Hub origin.

No credentials, cloud resources, memberships or invitations are created by these
tests. Actual Google login and synchronization between physical devices remain
unverified until the dedicated hosted environment is configured and tested.

## Verification results before the repair commit

- Test-only revision: `5cd2afcd`. The red checkpoint records the actual missing unpaired
  account operation and failing automatic discovery with the committed original code.
- Focused desktop account and membership behavior: 36 passing tests.
- Existing phone, cache and pairing compatibility: 47 passing tests.
- Hub sign-in, invitations, account switching and device approval: 11 passing browser cases.
- Existing Hub unit suite: 471 passing tests; its build and audit pass.
- Existing verified-Google identity and auth checks: 43 passing tests. Owned/invited server
  membership characterization: 4 passing tests.
- Native Swift account and pairing logic: Debug 286 passed, Release 264 passed; no failures.
  Swift size guard: 53 files, no findings. The native simulator app builds with ad hoc
  signing and no team or account. Renderer integration is rebuilt separately after repair.
- Shared alias, Select and search impact contracts: 13 passing tests. The 1306-unit registry
  is valid, with the pre-existing 62 uncertain references; the root audit passes.

Full verification remains open. Desktop type checking still reports TS2589 in the existing
`ui-evidence-fixture.ts:172`; its audit counts 221 lines in the unchanged Desktop types
file. Hub lint still reports complexity 11 in `HubApiController.projects`. The broader
Desktop suite also finds five catalog assertions that reproduce on pre-change `a7ce3b70`;
the other two failures in that run were the unimplemented phone lane, now passing.
The broader Hub browser suite still has unchanged navbar and old page-link expectations.
These are recorded failures, not passing checks. Electron UI tests are excluded by request.

Screenshots use synthetic accounts and remain outside Git. The live Google provider,
production deployment, real Keychain persistence and physical-device sign-in are not
proven by these fixtures or the simulator build. No real account was signed out.

## Committed clean replay

The feature is committed at `23641dc6`. A final clean checkout found that the
native account adapter depended on generated Hub configuration. The follow-up
`google-project-sync-bootstrap` loop records the cause, boundary guard and repair.
The portable bootstrap repair is `2386c0f7`; test-only revision `81386391` precedes it. The ownership follow-up records the remaining migration metadata and cold helper entry checks.

| Loop                      | Red checkpoint | Green checkpoint | Result                                                                |
| ------------------------- | -------------- | ---------------- | --------------------------------------------------------------------- |
| Account synchronization   | `6880c1b3`     | `5f3d4478`       | Unchanged command passes at the fix revision                          |
| Portable client bootstrap | `a2c4ee0c`     | `f6eafba0`       | The original upward imports are rejected; portable bridge starts cold |

Both replays install only frozen dependencies, initialize the shared renderer,
run Desktop account/boundary tests and Hub session/cold-entry tests, then run all
11 hosted account and device-approval browser cases. No prior Hub build cache is
available. The isolated mutation also proves the normal boundary guard rejects
reintroducing the original application dependency and passes after restoration.

The two new static test path lookups add two scanner uncertainties; the registry
has 1307 valid units and no errors. The pre-existing 62 uncertainties remain.
Full-project verification and real hosted Google/device acceptance remain open
for the blockers above. Passing focused proof does not close those gates.

The ownership follow-up's final repair is `7f848772`: clean checkpoint `f3eef9d7`
passes after test-only `7a1624a6` / failing checkpoint `789cb3a8`. That replay also
runs the existing root migration and shared-workspace registry checks, keeping
all 411 helper identities and definition hashes enforced. Private helpers stay
beside the portable client that uses them; public exports continue forwarding.

## Final verification at `7f848772`

- Root unit suite: 217 files passed, two live-service files skipped; 889 tests
  passed and 25 explicitly skipped. Root formatting, TypeScript, lint and Rust
  checks passed in the broader check before its unit phase found the now-repaired
  registry/ownership expectations. That complete root unit phase was rerun green.
- Latest clean acceptance checkpoint: `f3eef9d7`, 76 passing checks across root,
  Desktop, Hub session/cold entries and browser flows.
- Hub type checking: zero errors and warnings. Hub Web build passed.
- Fresh iOS simulator renderer/native app build passed, signed ad hoc with no
  team/account. Native Swift logic remains Debug 286 / Release 264 passing.
- Fresh hosted account and device browser run: all 11 passed with the shared
  unexpected-browser-error assertions enabled. Three screenshots were captured
  after fonts were ready and inspected; they use synthetic accounts and remain
  outside Git. No Electron app UI was launched or exercised.

`bun run check` is not fully green. Current Desktop type checking still reports
TS2589 in `tests/e2e/ui-evidence-fixture.ts:172`; current Hub lint still reports
complexity 11 in `HubApiController.projects`. Those source files are unchanged
from the task base `a7ce3b70`. The unchanged Desktop types audit debt and the
previously recorded broader catalog/browser test failures also remain open.
No failing gate is waived. Full loop verification therefore remains pending.

No live Google client or dedicated hosted environment was configured or
published. Real Google login, device-only Keychain persistence, physical-device
acceptance and production deployment are unverified. The work remains on the
feature branch until the outstanding project gates and live setup are resolved.
