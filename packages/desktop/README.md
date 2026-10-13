# Harness desktop

A local Electron workspace for browsing Pages, Components, Functions, Configs and Services, reviewing committed designs, and sending entity-specific Plan or Change requests to installed agent CLIs.

## Run locally

Install workspace dependencies with `bun install` from the repository root. Then, from `packages/desktop`:

```sh
bun run build
bun run desktop
```

`build` creates the static Svelte renderer and Electron main/preload bundles. Rebuild after source changes before reopening the native app. `bun run dev` serves the browser preview on port 5799; without Electron's bridge, this preview is read-only and cannot open a local project.

On macOS, after a successful build:

```sh
bun run package:mac
open dist/mac/Harness.app
```

The packaging script creates a local, ad-hoc-signed app. It does not notarize, publish, or install a production release.

## Projects and shared collaboration

The top-left picker switches between saved local projects and shared GitHub projects. Local projects retain Plan/Change controls; shared projects support human comments only. Launch with the dedicated `HARNESS_HUB_ORIGIN` to connect through a browser sign-in and one-time desktop code. The main process stores the session through Electron safeStorage; credentials never enter the renderer.

Project URLs start with `/projects/{projectId}/harness/branch/{encodedBranch}/`, with an optional `/commit/{fullSha}/` before the entity category. Cached shared views display their saved time while offline and disable mutations. Access denial clears protected cached views; pending drafts stay distinct from acknowledged GitHub comments.

Provider registration and hosted publication remain separate setup steps. See [Harness Hub](../hub/README.md).

## Prepare the selected repository

Open Project uses the native directory picker. Select a Git repository root with an existing commit and a checked-out local branch. Configure the intended author identity in that repository if needed:

```sh
git config --local user.name "Your Name"
git config --local user.email "you@example.com"
git lfs install --local
```

Git and Git LFS must be installed. PNG designs use LFS; historical image reads need the corresponding local LFS objects. The app does not fetch missing objects automatically or alter global Git identity. Planning writes create commits in the selected repository and preserve unrelated staged and unstaged work; conflicting changes to planning artifacts are refused.

Codex CLI and/or Claude CLI must be installed and authenticated locally to run agent requests. For Plan and Change the composer displays discovered availability, models and effort choices. An unavailable provider remains disabled with its reason.

Coding agents also need the Harness CLI for generators, development loops, and audits. For local development, run `bun run build` and `bun link` from the Harness repository root before starting Electron. This links the current checkout's CLI into Bun's executable directory; subprocesses include that directory even when Electron starts from Finder. A project can instead invoke its project-local CLI using `HARNESS_CLI_PATH` in its audit scripts. Without an available CLI, an agent must report the blocked checks.

## Design and implement

Use New page/component/function/config/service to create a title and goal. A draft can receive its first Plan request before it has an image. Plans remain separate from active unit manifests until real implementation exists.

The entity conversation opens on **Comment** wherever comments are permitted; a person writes it for people and it never starts an agent. **Plan** and **Change** are offered only in a local project with agents, at the checked-out branch tip. Choosing either shows the CLI provider, its reported model and an available reasoning effort inside the message input. Plan creates or revises the committed design; visual image generation uses the signed-in Codex GPT Image capability. The selected CLI/model receives the planning request. A highlighted rectangle or whole-image comment binds its thread to that exact image hash and version. Numbered pins, image versions and history belong to the selected entity. Headless designs can contain committed behavior notes instead of an image.

**Approve version** records approval for the current exact design and contract. It neither starts code changes nor verifies running behavior. Send a separate Change message to implement it: Change needs the exact current version to be the approved one, so a later design version needs its own approval. Run status, public agent text, failures and cancellation appear in the conversation; a finished agent run is not a passing test result.

An entity opens on its **Overview**: contract, size and performance, relationships, and the runtime evidence recorded for the shown revision where there is any. **Designs** holds the committed planning design; **Relationships**, **Evidence** and **History** are sections of their own. Source filenames and contents are exposed only through **Details → Source**. Binary verification icons explain their evidence or missing evidence on hover, focus or tap; a Plan badge is independent of verification.

Change records preserve actual project source deltas and observed structured CLI operations on host files. Host operations include absolute paths and available before/after hashes. Shell writes outside the repository are not fully observable through these CLI APIs; this record is not a complete host filesystem audit.

## Revisions and files

Branch selection shows that branch's actual tip. Source, planning and agent writes happen only at the checked-out branch tip: other branches and explicit commit views, even of that tip, are read-only for them, and so is the `harness-evidence` branch. A human comment may still attach to a historical revision when the project's capabilities permit comments. That is no promise for the `harness-evidence` branch, nor for a project that is offline or no longer authorized.

Canonical routes preserve branch names with percent encoding:

- `/harness/branch/feat%2Factivity/pages`
- `/harness/branch/feat%2Factivity/commit/<full-sha>/pages/<encoded-entity-id>`

An entity's base route opens its Overview. `/designs` is the committed planning design, and `/relationships`, `/evidence`, `/history` and `/details` identify those views. Historical data is read from the selected commit without substituting newer images.

Planning artifacts live under `src/<category>/<slug>/`, including `plan.json`, immutable `designs/v001/`, `designs/v002/` directories, approval records and entity threads. PNG bytes are stored through Git LFS. Versions preserve their exact hashes and creation commits; revision history is not an overwrite of the previous version.

Creating a plan in an existing Harness project atomically adds scoped artifact exclusions to its valid, clean `harness.units.json`. Source units remain indexed; design PNGs and thread data stay outside the active registry. Dirty or invalid registry configuration is rejected without changing it.

## Verification and remaining integration

```sh
bun run typecheck
bun run lint
bun run test:unit
bunx playwright test ui-workspace.spec.ts ui-designs.spec.ts
TAKE_SCREENSHOT=true bunx playwright test native-desktop.spec.ts
HARNESS_CLI_PATH=../../src/index.ts bun run check
```

The UI suites inject a deterministic bridge only into their test pages. The native suite launches its own Electron process/profile, stubs only the directory chooser, uses a disposable real Git/LFS repository and the public planning API, verifies native IPC, approval and history, and closes only that test-owned app. It checks sandboxing and blocked remote navigation/popups. It does not run coding or image-generation jobs. Actual CLI adapter smoke evidence is separate from these fixtures.

Outside a verification the browser suites start their own preview on `127.0.0.1:5796` and refuse a server that is already there; `HARNESS_DESKTOP_TEST_PORT=<port>` names another free port. Screenshots are opt-in with `TAKE_SCREENSHOT=true` and go to `test-results/`; do not commit generated visual evidence. The browser preview has no writable mock backend.

Recorded runtime evidence is read for local projects and for shared ones, and is shown in Overview and Evidence. A branch view shows what is recorded for its tip; an explicit commit is compared with its actual first parent. Evidence that is missing, invalid or incompatible is shown as that gap, and a connection that cannot read evidence says so. A passing test, a design approval, a readable PNG or agent completion does not stand in for recorded evidence.

These readers and views are exercised against fixtures. A final clean verification, the baseline review, manual and native acceptance, and any live hosted service are separate proof; this package claims neither a complete delivery nor a live hosted setup.

## iOS app on a simulator

The iOS shell under `ios/` (Capacitor 7, bundle `com.dafuga.harness`) loads this same renderer. The commands below run on a simulator of this Mac only. A build for a device needs a signing team and provisioning; none is named here and no such build is made.

```sh
bun run ios:build:simulator --sync       # Debug; --release for Release; --sync rebuilds and copies the renderer first
bun run ios:check:vectors                # Swift reproduces the crypto vectors of the protocol
bun run ios:check:native                 # the app's real Swift logic in a driver, Debug and Release
bun run ios:check:limits                 # size limits of the Swift source, which harness audit cannot read
bun run ios:acceptance                   # TEST ONLY native acceptance, several minutes
bun run remote:fixture                   # TEST ONLY fixture computer on 127.0.0.1, until stopped
```

Every simulator product is signed ad hoc with the entitlements of `ios/App/Simulator.entitlements`, the app's identifier alone. Xcode would otherwise put a team of whatever account is signed in to it into the product; the build reads each product back and fails if it names a team, an account or a provisioning profile, if it allows plain http to this machine, or if it can be inspected. Without a signature the simulator's Keychain refuses to keep a pairing (`-34018`).

`--fixture` is TEST ONLY and Debug only; with `--release` it is refused before anything is built. It leaves the Debug product as built and makes a copy in `.cache/ios/fixture/` that may reach a relay on this machine and be read by WebKit's inspector. That copy accepts such a relay only when it is started with `-HarnessRemoteLoopback`; a Release product has no code that does. `bun run remote:fixture` starts a disposable computer to pair it with by hand.

The native acceptance needs nothing running. It removes the earlier products and builds them again from the working tree, starts a fixture computer of its own on free ports of `127.0.0.1` (the real relay Worker in workerd and the real host service over a synthetic project), and creates, erases and boots a simulator of its own named `Harness Native Acceptance`; no other simulator and no other fixture is touched. It then drives the app's real web view through WebKit's inspector (`appium-remote-debugger`): pairing, Keychain, relaunch, the design image, lock state, saved copies while the computer is away, reconnect, revocation, the safe area and status bar of a scrolled page, and the refusal of a Release product in the page and in Swift. It exits with 1 when any assertion fails.

Its screenshots and `report.json` go to `work/mobile/ios-acceptance/`, which Git ignores. The report names the revision, a digest over each set of source files it was made from (renderer, native shell, fixture computer), the digest of the renderer that was built and is in every product, each product's executable and signature, and every assertion. A file of that source that changes while the run is going fails the run and is named, so run it in a tree nobody else is editing. It is automation by a tool: nothing the system draws is pressed, so the "Open in Harness" prompt of a pairing link is not covered, and it proves nothing about a deployed relay, a real computer, a physical phone or a build signed for a device. It prints no pairing code and no key.

See the [feature specification](specification/features/planned/image-threads.md) and [UI/native loop evidence](../../specification/loops/harness-image-threads/desktop-ui-native-evidence.md).
