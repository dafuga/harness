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
