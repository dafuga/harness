# Desktop UI and native acceptance evidence

This records the bounded renderer/native work in `packages/desktop`. It does not complete the broader image-thread loop or claim the separate core verification integration is delivered.

## Renderer regression and focused checks

The previous root route rendered only “Welcome to desktop”. A faithful temporary replay of that route failed the unchanged browser-gate test because Open Project was absent. The implemented route was restored immediately, and the same test passed. `/tmp/harness-ui-red.txt` records the failure; `/tmp/harness-ui-before.png` was inspected and visibly shows the original placeholder. These temporary paths are session evidence, not durable repository artifacts.

Verified commands from `packages/desktop`:

```sh
bunx eslint src/components src/routes src/lib/stores test/stores
bunx playwright test ui-workspace.spec.ts ui-designs.spec.ts
bunx vitest run test/stores/workspace.test.ts
```

The scoped lint check passed; six UI acceptance tests and two store tests passed. The UI tests use an injected fixture bridge, never a writable browser runtime. Actual href assertions verify `feat%2Factivity` is not double-encoded and historical links retain branch and full commit SHA. UI coverage includes initial designless Plan, current approval gates, headless notes, exact image threads, pointer/keyboard regions, public streaming/cancellation, source disclosure and mobile overflow/drawer behavior.

Stable each-block keys and SvelteKit `resolve('/harness/[...path]', ...)` links preserve these identities. No lint or accessibility rule was disabled to make the renderer pass.

## Real native window acceptance

```sh
TAKE_SCREENSHOT=true bunx playwright test native-desktop.spec.ts
```

The recorded isolated run used an equivalent temporary Playwright configuration without a web server and passed one native test in 10.3 seconds. The suite launches the built Electron main/preload/renderer, with its own temporary user-data profile and Git/LFS repository. Only the native directory chooser is stubbed. It exercises:

- UI Open Project and draft creation, then checks displayed branch/commit/tip against Git.
- A committed PNG created through the planning public API and an exact-byte read through the real preload/IPC bridge.
- UI approval, the resulting real Git approval record, and a clean fixture worktree.
- Historical UI controls and native write rejection at the selected earlier commit.
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and unavailable renderer `require`.
- A real attempted remote navigation whose event was prevented, plus denied popup creation.

The suite closes only its test-owned Electron app and deletes its disposable profile/repository. Existing native windows and the port-5796 dev server are preserved. No coding or image-generation job is invoked by this suite; actual provider/model discovery can run through the real app.

## Visual evidence and boundaries

With `TAKE_SCREENSHOT=true`, ready screenshots are written under `packages/desktop/test-results/`. Image/font readiness is awaited, and captures are inspected. The final `native-approved.png` visibly contains the committed image, current branch tip and approved version; `native-history.png` shows the same recorded image with historical/read-only controls. UI captures include `ui-design.png`, `ui-catalog.png` and `ui-mobile.png`. Test reruns can replace these files. They are not committed.

Actual CLI execution evidence and final package-wide typecheck/lint/audit/build results belong to the primary runtime task. The separate core task still owns verification-index and runtime-screenshot integration. Approval and agent completion are not proof of runtime correctness. Keep the broader loop's verification step pending until its required checks are recorded.

## Final integration acceptance

The completed renderer has nine browser cases, three workspace-store cases and one actual Electron case. Added red-green regressions preserve explicit current-tip commit URLs and refresh committed entity history after failed or cancelled runs. Desktop integration and boundary suites contain 30 passing tests; planning contains 15 tests, including real indexing of all five draft categories without registering their artifacts as active units.

The compiled renderer and native suites generated 13 actual PNG captures with build stamps, declared dimensions and explicit fixture labels. Local protocol trials used an unverified zero revision; those captures do not claim commit verification. Clean source-bound capture runs must replace the placeholder with the exact tested source revision.

The primary separately exercised a real signed-in Codex Plan → GPT Image → committed LFS version → exact approval → explicit Change flow in a disposable repository. The 1,347,406-byte PNG matched its recorded SHA256; Plan and approval left source untouched; Change modified the assigned source and persisted its approved target and delta. Both CLI completions remained `verified: false`. Actual Claude execution remains quota-blocked; no provider success was inferred from authentication.
