# Harness desktop

A local Electron workspace for browsing Pages, Shells, Components, Helpers, Models, Configs and Services, finding any of them with the global search in the top bar, reviewing committed designs, and sending Plan or Change requests to installed agent CLIs.

## Google account projects

Use **Connect shared projects** to sign in with Google through the trusted Harness Hub.
The same account sees projects it owns and projects whose invitations it accepted on Web,
Electron and iOS. Lists refresh on focus, when a page becomes visible or reconnects, and
at most every 30 seconds while visible. A removed membership or rejected session clears
protected views; a temporary outage preserves the saved login.

The iOS account connection works without a paired Mac. Pairing adds explicitly granted
local Mac projects beside hosted projects; removing that pairing leaves the independent
account intact. Local folders are not uploaded automatically by signing in.

Configure the dedicated Hub using [the Hub setup guide](../hub/README.md). Electron reads
its exact `HARNESS_HUB_ORIGIN` in development. An iOS build uses the public Xcode build
setting of that name through `HarnessHubOrigin` in Info.plist. iOS Release uses the
production Hub and fails if its origin is missing or overridden. The bundled renderer
stays local, and Google approval opens in the system
browser. Native credentials remain in OS-protected storage, outside renderer messages;
the iOS account uses a separate device-only Keychain entry from Mac pairing.

## Run locally

Install workspace dependencies with `bun install` from the repository root. Then, from `packages/desktop`:

```sh
bun run build
bun run desktop
```

`build` creates the static Svelte renderer and Electron main/preload bundles. Rebuild after source changes before reopening the native app. `bun run dev` serves the browser preview on port 5799; without Electron's bridge, this preview is read-only and cannot open a local project.

### Package a Mac release

The release uses hardened runtime, bundle `dev.harness.desktop`, and Developer ID Application team `PAC8VHDW3G`. The release owner provisions `~/Library/Keychains/harness-signing.keychain-db` with the Harness signing identity through the approved private credential path, grants `/usr/bin/codesign` access to that private key, and configures the key's `apple-tool:,apple:,codesign:` partitions. Unlock the dedicated build keychain for the signing job.

Build and package from this directory:

```sh
bun run build
HARNESS_RELEASE_HUB_ORIGIN=https://dafuga-harness.pages.dev \
  HARNESS_MAC_SIGN_IDENTITY='<exact-certificate-SHA1>' bun run package:mac
bun run package:mac --verify dist/mac/Harness.app
```

The packager names the app's executable `Contents/MacOS/Harness`: Electron reports `app.isPackaged=false` for an executable named `electron`, which skips the packaged-only startup work such as the Tracker install below. It also removes group and other write access from every file in the bundle. `--verify` refuses an app with another executable name or with a group- or world-writable file, so bundles packaged before this rule do not pass it. Scripts that find the running app by process path must use `Harness.app/Contents/MacOS/Harness`. `test/package-mac-app.test.ts` assembles the app with the packager and launches it with a probe main process and no visible window.

The packager requires the public release Hub origin and compiles it directly into the signed main bundle. The fingerprint selects the certificate in the dedicated build keychain. For an existing approved build keychain, set `HARNESS_MAC_SIGN_KEYCHAIN` to its path after verifying that its specific private key permits unattended `codesign`. Bun can load those settings from the ignored `.env.local` file in this package. Packaging publishes the bundle to `dist/mac/Harness.app` after verification. For local development, use `bun run desktop`.

Before replacing `/Applications/Harness.app`, run `bun run package:mac --verify <candidate.app>` and keep the previous bundle for rollback. Quit Harness normally so it can finish active work before the replacement. Run the same verification against `/Applications/Harness.app` after installation. Public distribution additionally requires notarization.

The signed app uses its own `Harness Safe Storage` item and retains its `harness-desktop` profile. Explicit `--user-data-dir` profiles use separate signed items so a fresh test profile cannot preempt the migration of an existing profile. A profile without saved hosted session or remote host data starts directly with the new item. If the profile contains those encrypted files, the signed migration helper attempts to transfer the key between the two entries through Keychain Services with password prompts disabled. If access is denied, startup pauses and leaves both the old item and encrypted files intact.

For a profile that needs access to its legacy data and reports the migration error, quit Harness and explicitly launch the verified bundle with `open /Applications/Harness.app --args --harness-migrate-safe-storage`. If the old item requires authorization, macOS presents the prompt for `harness-desktop Safe Storage` before the main window opens, while the helper reads the old item. Successful transfer creates the new item under the current Developer ID requirement, so later launches use that item. Both items stay in Keychain for rollback.

Build, install and launch two distinct signed builds in sequence. For each cycle, check the macOS log from just before the build:

```sh
/usr/bin/log show --start '<YYYY-MM-DD HH:MM:SS>' --info --predicate \
  'process == "securityd" AND eventMessage CONTAINS[c] "displaying keychain prompt"'
```

Expect zero events for `/usr/bin/codesign`, `/Applications/Harness.app`, and `HarnessKeychainMigration` across each ordinary build, installation, and launch.

### Tracker inside the app

`Harness.app` carries the Tracker: the compiled Harness CLI at `Contents/Helpers/harness` (the same executable `harness tracker serve` runs, signed with the app's Developer ID and hardened runtime, with the entitlements in `scripts/mac-tracker-entitlements.plist` that Bun's JIT needs) and the `tracker` shim at `Contents/Resources/tracker-shim.sh`. `bun run package:mac --verify` refuses an app without them, with the wrong signature, or whose executable does not report a version.

Installing or replacing the app is the only step. Each packaged launch starts `startBundledTracker` in the background, which:

1. Copies the executable and shim to an immutable release at `~/.local/state/tracker/harness-releases/<id>/` (content-named, `SHA256SUMS`, `BUILD_COMMIT`), so the running service survives the app being replaced, and keeps the last three releases it staged.
2. Points `~/.local/libexec/harness/harness` and `~/.local/bin/tracker` at that release with atomic link swaps. A regular file at either path is never replaced; the install stops and reports it.
3. Repoints only the executable (`ProgramArguments[0]`) of the existing `local.harness.tracker` LaunchAgent, then waits for launchd to remove the old job before loading its replacement. The same wait applies when restoring the previous release. The `--config` path, role, environment, logs, SQLite journal, secrets and fence files are not touched. If there is no agent but `~/.config/harness/tracker.json` exists, it writes one for that file's role; with no configuration it installs the command line only.
4. Waits for `harness tracker ensure` to report ready. If the new release does not become ready in 30 seconds, it restores the previous executable, links and agent and reports `rolled-back`.

Each packaged install records its revision, outcome and any failure reason in `~/.local/state/harness/tracker-native/logs/tracker-install.log`.

A launch with its own `--user-data-dir` (tests, or a candidate run beside the installed app) skips all of this. A second launch with the same app changes and restarts nothing. Another app instance or an installer already running holds a lock, so two installs never interleave. A LaunchAgent whose command is not `tracker serve` is refused. Rollback of a bad app is the previous release directory plus `launchctl bootout`/`bootstrap` of the previous agent file; the previous app bundle remains the rollback source for the executable.

## Projects and shared collaboration

The top-left picker switches between saved local projects and shared GitHub projects. Local projects retain Plan/Change controls. Shared project actions follow membership: readers browse, commenters discuss, and writers can request agent work when a project executor is available. Launch with the dedicated `HARNESS_HUB_ORIGIN` to sign in with Google through your system browser. One-time device codes remain available for recovery. The main process stores the session through Electron safeStorage; credentials never enter the renderer.

Project URLs start with `/projects/{projectId}/harness/branch/{encodedBranch}/`, with an optional `/commit/{fullSha}/` before the entity category. Cached shared views display their saved time while offline and disable mutations. Access denial clears protected cached views; pending drafts stay distinct from acknowledged GitHub comments.

Provider registration and hosted publication remain separate setup steps. See [Harness Hub](../hub/README.md).

## Prepare the selected repository

Open project uses the native directory picker. Select a Git repository root with an existing commit and a checked-out local branch. Configure the intended author identity in that repository if needed:

```sh
git config --local user.name "Your Name"
git config --local user.email "you@example.com"
git lfs install --local
```

Git and Git LFS must be installed. PNG designs use LFS; historical image reads need the corresponding local LFS objects. The app does not fetch missing objects automatically or alter global Git identity. Planning writes create commits in the selected repository and preserve unrelated staged and unstaged work; conflicting changes to planning artifacts are refused.

Agent requests use an authenticated local CLI. Visual Plan uses Claude CLI with a signed-in subscription. Its screenshot renderer uses headless Playwright Chromium or installed Google Chrome. For the other agent requests, the composer shows the available providers, models, and reasoning effort.

Coding agents also need the Harness CLI for generators, development loops, and audits. For local development, run `bun run build` and `bun link` from the Harness repository root before starting Electron. This links the current checkout's CLI into Bun's executable directory; subprocesses include that directory even when Electron starts from Finder. A project can instead invoke its project-local CLI using `HARNESS_CLI_PATH` in its audit scripts. Without an available CLI, an agent must report the blocked checks.

## Design and implement

To add an entity, open its category and use **Work with agent** at the bottom right, offered where agents are allowed. Describe the page, shell, component, function, config or service to add; the agent proposes a plan for you to review, and a draft left without a request is linked as **Open the saved draft**. Plans remain separate from active unit manifests until real implementation exists.

The entity conversation opens on **Comment** where comments are permitted. **Plan** and **Change** are available at the checked-out branch tip of a local project with agents. Plan creates or revises a committed design. Pages, layouts, and components use Sonnet to author responsive HTML and CSS from the project's components and styles. The default is three design options, with a setting from 1 to 10. Each option is rendered headlessly at 390, 834, 1440, and 1920 pixels. Ask in Plan to add a width or state or to rerender the saved mockup with Haiku.

An image comment or a highlighted region binds its thread to the selected screenshot hash and version. A function's **Plan** holds committed behavior notes and cases.

**Approve version** records the current version and contract. For a mockup, it binds the source and the selected option's screenshots. Send **Change** separately to implement the approved source with those screenshots as references. A later version requires a new approval. The conversation shows progress, public agent text, cancellation, and errors. Test results supply verification separately.

For a user-reported bug, Plan and Change share the framework's coverage-first rules. The agent first explains why the existing standardized tests missed the bug, then strengthens those tests and their shared fixtures or assertions. Plan proposes this work read-only; approved Change proves the strengthened test fails before repair and passes unchanged afterward. Missing categories extend reusable scenario coverage. Commands, assertions, observed results and tested revisions remain the evidence; an agent reply alone proves no test result.

An entity opens on its **Overview** with its contract, relationships, measurements, and recorded runtime evidence. An open visual plan also appears there with the current and proposed mockups for the selected width and state. **Designs** holds the committed designs of a page, shell or component, and a function has **Plan** in its place; **Used In**, **Uses**, **Evidence** and **History** are sections of their own. Source filenames and contents are exposed only through **Details → Source**. Binary verification icons explain their evidence or missing evidence on hover, focus or tap; a Plan badge is independent of verification.

Change records preserve actual project source deltas and observed structured CLI operations on host files. Host operations include absolute paths and available before/after hashes. Shell writes outside the repository are not fully observable through these CLI APIs; this record is not a complete host filesystem audit.

## Revisions and files

Branch selection shows that branch's actual tip. Source, planning and agent writes happen only at the checked-out branch tip: other branches and explicit commit views, even of that tip, are read-only for them, and so is the `harness-evidence` branch. A human comment may still attach to a historical revision when the project's capabilities permit comments. That is no promise for the `harness-evidence` branch, nor for a project that is offline or no longer authorized.

Canonical routes preserve branch names with percent encoding:

- `/harness/branch/feat%2Factivity/pages`
- `/harness/branch/feat%2Factivity/commit/<full-sha>/pages/<encoded-entity-id>`

An entity's base route opens its Overview. `/designs` (`/plan` for a function) is the committed planning design, and `/used-in`, `/uses`, `/evidence`, `/history` and `/details` identify those views; the former `/relationships` address is still read. Historical data is read from the selected commit without substituting newer images.

Planning artifacts live under `src/<category>/<slug>/`, including `plan.json`, immutable `designs/v001/`, `designs/v002/` directories, approval records and entity threads. PNG bytes are stored through Git LFS. Versions preserve their exact hashes and creation commits; revision history is not an overwrite of the previous version.

Creating a plan in an existing Harness project atomically adds scoped artifact exclusions to its valid, clean `harness.units.json`. Source units remain indexed; design PNGs and thread data stay outside the active registry. Dirty or invalid registry configuration is rejected without changing it.

## Verification and remaining integration

```sh
bun run typecheck
bun run lint
bun run test:unit
bun run test:e2e ui-workspace.spec.ts ui-designs.spec.ts
bun run build && TAKE_SCREENSHOT=true bun run test:native
HARNESS_CLI_PATH=../../src/index.ts bun run check
```

`bun run test:e2e` runs every browser suite in headless Chromium against the web renderer and launches no Electron app; the root `check:desktop` runs only this. The Electron suites, `native-desktop.spec.ts` and `game-native.spec.ts`, run only through `bun run test:native`, against the built Electron bundles, and no normal check invokes them: a passing `test:e2e` says nothing about preload, IPC, sandboxing or native navigation.

The UI suites inject a deterministic bridge only into their test pages. The native suite launches its own Electron process/profile, stubs only the directory chooser, uses a disposable real Git/LFS repository and the public planning API, verifies native IPC, approval and history, and closes only that test-owned app. It checks sandboxing and blocked remote navigation/popups. It does not run coding or image-generation jobs. Actual CLI adapter smoke evidence is separate from these fixtures.

Outside a verification both commands start their own preview on `127.0.0.1:5796` and refuse a server that is already there; `HARNESS_DESKTOP_TEST_PORT=<port>` names another free port. Screenshots are opt-in with `TAKE_SCREENSHOT=true` and go to `test-results/`; do not commit generated visual evidence. The browser preview has no writable mock backend.

Recorded runtime evidence is read for local projects and for shared ones, and is shown in Overview and Evidence. A branch view shows what is recorded for its tip; an explicit commit is compared with its actual first parent. Evidence that is missing, invalid or incompatible is shown as that gap, and a connection that cannot read evidence says so. A passing test, a design approval, a readable PNG or agent completion does not stand in for recorded evidence.

These readers and views are exercised against fixtures. A final clean verification, the baseline review, manual and native acceptance, and any live hosted service are separate proof; this package claims neither a complete delivery nor a live hosted setup.

## iOS app on a simulator

The iOS shell under `ios/` (Capacitor 7, bundle `com.dafuga.harness`) loads this same renderer. The commands below run on a simulator of this Mac only. A build for a device needs a signing team and provisioning; none is named here and no such build is made.

Devices link only through Google sign-in to the same account, with no QR code, typed code or link. Each app signs in, creates its own key pair, publishes its public key to the account and trusts the account's other device keys; private keys never leave the device. The Mac app registers under the signed-in account, and a signed-in phone picks one of that account's online computers; the sealed request is approved on the Mac side by the account path, never by scanning or typing anything.

```sh
bun run ios:build:simulator --sync       # Debug; --release for Release; --sync rebuilds and copies the renderer first
bun run ios:check:vectors                # Swift reproduces the crypto vectors and reproduces the pairing envelope vectors
bun run ios:check:native                 # the app's real Swift logic in a driver, Debug and Release
bun run ios:check:limits                 # size limits of the Swift source, which harness audit cannot read
bun run ios:acceptance                   # TEST ONLY native acceptance, several minutes
bun run remote:fixture                   # TEST ONLY fixture computer on 127.0.0.1, until stopped
```

Every simulator product is signed ad hoc with the entitlements of `ios/App/Simulator.entitlements`, the app's identifier alone. Xcode would otherwise put a team of whatever account is signed in to it into the product; the build reads each product back and fails if it names a team, an account or a provisioning profile, if it allows plain http to this machine, or if it can be inspected. Without a signature the simulator's Keychain refuses to keep a pairing (`-34018`).

`--fixture` is TEST ONLY and Debug only; with `--release` it is refused before anything is built. It leaves the Debug product as built and makes a copy in `.cache/ios/fixture/` that may reach a relay on this machine and be read by WebKit's inspector. That copy accepts such a relay only when it is started with `-HarnessRemoteLoopback`; a Release product has no code that does. `bun run remote:fixture` starts a disposable computer to pair it with by hand.

The native acceptance needs nothing running. It removes the earlier products and builds them again from the working tree, starts a fixture computer of its own on free ports of `127.0.0.1` (the real relay Worker in workerd and the real host service over a synthetic project), and creates, erases and boots a simulator of its own named `Harness Native Acceptance`; no other simulator and no other fixture is touched. It then drives the app's real web view through WebKit's inspector (`appium-remote-debugger`): the signed-in home, the design image, lock state, saved copies while the computer is away, reconnect, revocation, the safe area and status bar of a scrolled page, and the refusal of a Release product in the page and in Swift. It exits with 1 when any assertion fails.

Its screenshots and `report.json` go to `work/mobile/ios-acceptance/`, which Git ignores. The report names the revision, a digest over each set of source files it was made from (renderer, native shell, fixture computer), the digest of the renderer that was built and is in every product, each product's executable and signature, and every assertion. A file of that source that changes while the run is going fails the run and is named, so run it in a tree nobody else is editing. It is automation by a tool: nothing the system draws is pressed, and it proves nothing about a deployed relay, a real computer, a physical phone or a build signed for a device. It prints no key.

The acceptance does not link a device yet: pairing is by Google sign-in only, so the phases that need a linked computer (approval, Keychain, relaunch, saved copies, reconnect, revocation) return once the fixture can stand in for a Google sign-in. The app has no camera scanner, no scan fixture build and no way to be handed a pairing code.

See the [feature specification](specification/features/planned/image-threads.md) and [UI/native loop evidence](../../specification/loops/harness-image-threads/desktop-ui-native-evidence.md).

## Environments and Cloudflare deployment

The top bar keeps the project/workbench, Branch and Commit selectors behind labelled icons. Environment remains visible: dev, stage, preprod or prod. It scopes the next Change request; the source branch and commit remain visible separately. Environment times are the last deployment verified by this desktop, while revision times come from Git. Deployment does not switch or push Git branches.

Projects without a configured deployment target keep local changes available and say **Local changes only**. A scoped Change requires a clean checkout of the configured source branch, verifies the source with `bun run check`, commits its changes, and queues the resulting commit through dev, stage and preprod up to the selected environment. The agent run returns once the chain is queued; each higher job waits for its own lower job to pass. Requests viewed in prod stop at preprod. **Deploy** opens one production promotion modal showing the verified preprod commit, current production commit and how many commits production is behind. Its single **Promote to production** button deploys that exact preprod commit from an isolated checkout, preserving the browsing revision and any local changes. Live status follows preparation, checks, build, upload and health verification. Each configured preceding environment must have a verified receipt for the same commit; production additionally requires forward-only history from its current commit. Expired, reused, changed-project, changed-source and changed-configuration plans are refused. A failed upload/health check does not advance the saved environment state; inspect Cloudflare before retrying because an upload may already have succeeded.

The top-right **Deployments** light shows the active count. Open it for active and recent jobs labelled by destination, then choose a job for its source commit, timestamps, current step, error or verified receipt. These details reuse the production modal’s progress components. Jobs stay visible when switching projects. Each job builds its captured commit in an isolated checkout: different destinations can run together, while the same provider target queues. Later edits or lower-environment deployments can continue; configuration or destination changes still stop a job. Failed jobs stop dependent jobs and never advance their receipts. Recent history is limited to 64 finished jobs and is kept for the lifetime of the desktop host.

The first plugin supports Cloudflare Workers with explicit named environments and Cloudflare Pages. It detects `wrangler.jsonc`, `wrangler.json` and `wrangler.toml`. Ambiguous mappings stay unavailable. Add `harness.deploy.json` in the selected project's root to state its source branch, account, environment aliases, dedicated credential variable names and HTTPS health endpoints:

```json
{
	"adapter": "cloudflare",
	"sourceBranch": "dev",
	"config": "wrangler.jsonc",
	"environments": {
		"dev": {
			"wranglerEnvironment": "development",
			"name": "my-app-dev",
			"accountId": "00000000000000000000000000000000",
			"tokenEnv": "HARNESS_MY_APP_DEV_CLOUDFLARE_API_TOKEN",
			"healthUrl": "https://dev.example.com/health"
		}
	}
}
```

Add stage, preprod and prod entries for configured targets. Worker mappings must match an explicit `env.<name>.name` in Wrangler and use distinct Worker identities. Pages mappings instead name a `branch` and the Pages project `name`; output comes from `pages_build_output_dir`. The adapter checks the live Pages production branch before upload. Provider credentials are read only in the host, passed only to the adapter subprocess and removed from agent/check subprocess environments. Set the dedicated variables in the desktop host's managed launch environment; do not put tokens in this JSON. A repository needs its normal `check` and `build` scripts and locally installed Wrangler. Receipts live in the Git common directory's `harness-deployments/receipts.json` and are shared across worktrees. Remote phones and hosted read-only projects cannot execute deployment operations.
