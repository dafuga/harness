# Harness desktop

A local Electron workspace for browsing Pages, Components, Functions, Configs and Services, reviewing committed designs, and sending entity-specific Plan or Change requests to installed agent CLIs.

## Run locally

Install workspace dependencies with `bun install` from the repository root. Then, from `packages/desktop`:

```sh
bun run build
bun run desktop
```

`build` creates the static Svelte renderer and Electron main/preload bundles. Rebuild after source changes before reopening the native app. `bun run dev` serves the browser preview on port 5796; without Electron's bridge, this preview is read-only and cannot open a local project.

On macOS, after a successful build:

```sh
bun run package:mac
open dist/mac/Harness.app
```

The packaging script creates a local, ad-hoc-signed app. It does not notarize, publish, or install a production release.

## Prepare the selected repository

Open Project uses the native directory picker. Select a Git repository root with an existing commit and a checked-out local branch. Configure the intended author identity in that repository if needed:

```sh
git config --local user.name "Your Name"
git config --local user.email "you@example.com"
git lfs install --local
```

Git and Git LFS must be installed. PNG designs use LFS; historical image reads need the corresponding local LFS objects. The app does not fetch missing objects automatically or alter global Git identity. Planning writes create commits in the selected repository and preserve unrelated staged and unstaged work; conflicting changes to planning artifacts are refused.

Codex CLI and/or Claude CLI must be installed and authenticated locally to run agent requests. The composer displays discovered availability, models and effort choices. An unavailable provider remains disabled with its reason.

## Design and implement

Use New page/component/function/config/service to create a title and goal. A draft can receive its first Plan request before it has an image. Plans remain separate from active unit manifests until real implementation exists.

Within the entity conversation, choose **Plan** or **Change**, the CLI provider, its reported model, and an available reasoning effort. These controls stay inside the message input. Plan creates or revises a design; visual image generation uses the signed-in Codex GPT Image capability. The selected CLI/model receives the planning request. A highlighted rectangle or whole-image comment binds its thread to that exact image hash and version. Numbered pins, image versions and history belong to the selected entity. Headless designs can contain committed behavior notes instead of an image.

**Approve version** records approval for the current exact design and contract. It neither starts code changes nor verifies running behavior. Send a separate Change message to implement an approved version. A later design version needs its own approval. Run status, public agent text, failures and cancellation appear in the conversation; a finished agent run is not a passing test result.

Ordinary views show design, contract, relationships and entity history. Source filenames and contents are exposed only through **Details → Source**. Binary verification icons explain their evidence or missing evidence on hover, focus or tap; a Plan badge is independent of verification.

Change records preserve actual project source deltas and observed structured CLI operations on host files. Host operations include absolute paths and available before/after hashes. Shell writes outside the repository are not fully observable through these CLI APIs; this record is not a complete host filesystem audit.

## Revisions and files

Branch selection shows that branch's actual tip. Only the checked-out branch tip is writable. Other branches, explicit commit views and the `harness-evidence` branch are read-only.

Canonical routes preserve branch names with percent encoding:

- `/harness/branch/feat%2Factivity/pages`
- `/harness/branch/feat%2Factivity/commit/<full-sha>/pages/<encoded-entity-id>`

Entity base routes open the design; `/details` and `/history` identify those views. Historical data is read from the selected commit without substituting newer images.

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

Screenshots are opt-in with `TAKE_SCREENSHOT=true` and go to `test-results/`; do not commit generated visual evidence. The browser preview has no writable mock backend.

The separate core explorer task still owns verification-index and runtime-screenshot integration. Until that integration supplies complete evidence for the selected entity/revision, the desktop must show unavailable or unverified states. Design approval, a readable PNG and agent completion cannot fill that gap.

See the [feature specification](specification/features/planned/image-threads.md) and [UI/native loop evidence](../../specification/loops/harness-image-threads/desktop-ui-native-evidence.md).
