# Feature: Game Projects

## Overview

Create Harness apps or games while retaining app pages. Game views separate UI and visual direction from deterministic mechanics. Interactive checkpoint graphs describe executable conditions and consequences and give coding agents implementation guidance. Both 2D and 3D simple scenes can feed an opt-in AI video renderer.

## Acceptance Criteria

- CLI and desktop project creation support App or Game, with 2D/3D selection for games; existing app/library behavior remains compatible.
- Game views, mechanics contracts, graph positions, conditions, actions and guidance persist in versioned game.json with optimistic concurrency and historical reads.
- Graph editing supports selection, node creation/deletion, dependency connections, dragging, structured condition/action editing and execution traces.
- Editor-only changes preserve the current run across Preview, Checkpoints and Mechanics; only explicit Reset or loading another document clears progress. Both dimension scenarios enforce this lifecycle contract in normal browser verification.
- Independent mechanics read a shared tick snapshot and produce disjoint patches. Checkpoints apply in stable order without cascading within a tick; one-shot nodes do not fire twice.
- The key-door example runs in both dimensions and branches to garden or vault according to player choice.
- Live AI rendering uses the canvas scene only, with HUD outside the stream; no camera/microphone access.
- AI preview defaults off, discloses rates, supports Restyle 2 and Lucy 2.5 standard/fast, and caps sessions at 60 seconds. Server-side token limits and client lifecycle cleanup enforce the cap; no automatic retries.
- Permanent Decart credentials remain in the game project's ignored .env.local. Local-only operations reject other project identities and historical writes.
- Automated regressions, standalone generated-game checks, manual browser flows and fresh inspected screenshots prove the feature. Live provider quality is reported separately and remains unproven without a compliant transport and dedicated credential.
- Merge into main only after current-main integration, complete verification and native game authoring acceptance pass. No separate application release is requested.

## Future Enhancements

- Multiplayer synchronization, native mobile acceptance, advanced physics and measured provider comparisons beyond the initial Decart models.

## Process Prevention Retro

- Incident evidence: the integration edit that initialized a newly loaded document also added `createRun()` to the common edit function, clearing preview progress when authoring metadata changed. The strengthened standard scenario observed zero completed checkpoints instead of three.
- Process failure: the original scenario stopped after reaching the outcome; it did not cross authoring tabs and return to the same run. Isolated mechanics/editing checks did not exercise their shared lifecycle.
- Durable control: both existing dimension scenarios now play, edit checkpoint metadata, inspect completed graph state and return to preview. Any game editor lifecycle change triggers this normal browser gate through the existing root check. This checks state ownership across subsystem boundaries rather than one input string.
- Recommendation: retain this cross-tab state contract in the shared game acceptance scenarios. It adds seconds, requires no new workflow and catches resets from future editor changes.

## Current delivery boundary

Local game creation, authoring and deterministic play are implemented. Live AI acceptance remains pending. Decart SDK 0.2.12 sends its temporary credential in a WebSocket URL; the default browser connector and host service therefore fail closed. Adapter and lifecycle tests prove caps and cleanup with injected transport, not a working public provider connection. No paid provider call or quality/latency measurement has been performed.

Creation controls render only when the local bridge advertises gameCreate. The unchanged shared-project connection scenario guards older bridges against added address/name fields; it failed before this capability gate and passes after repair.

## Verification result

Root `bun run check` was exercised through formatting, types, lint, Rust, root units/E2E, builds and packaging/stress. Its audit size finding was repaired; root audit and registry check pass. All package checks pass after targeted compatibility repairs. Desktop's full unit run had 827 passes and three snapshot compatibility failures; all three pass unchanged after restoring legacy app metadata. Its full browser run had 179 passes, two creation-form compatibility failures (both pass unchanged after capability gating), and a native Electron 120-second timeout. A pairing-expiry retry had one timing failure, then all five remote-host scenarios passed. Engine check has 13 passing tests; eight game browser scenarios and both standalone generated dimensions pass. Native Electron acceptance and live provider quality remain unproven; no mobile device deployment or production deployment was performed.

## Gameplay checkpoint images

Each checkpoint can store optional image direction and GPT Image metadata. Desktop generation is explicit, one image per click, uses the selected view and checkpoint conditions/consequences, and persists immutable project-local PNG assets. Saved images reload in current and historical editor views; history cannot generate. Stale selection or prompt responses cannot attach to another checkpoint. The generated game route shows references for completed checkpoints. OpenAI authentication stays in the selected game's ignored .env.local and backend Authorization header. Mocked API tests prove transport, storage and authoring; a built-in GPT Image sample demonstrates intended art. Live project API verification requires a dedicated project key.

Checkpoint-image verification: the engine package check passes with 17 tests; host/credential/local transport checks pass with 19 tests; root integration/impact checks pass with 23 tests; 11 browser scenarios pass, including a real generated game loading its saved checkpoint PNG. Both generated dimensions pass standalone checks. Desktop types, lint, build and audit and remote package check pass. Root full check reached 826 passing unit tests but failed three timing-sensitive assertions; their unchanged files passed all ten tests in an isolated retry. A separate native browser attempt to open the generated-game port was blocked by the browser client; Playwright verified that runtime. The built-in GPT Image sample is real; the app's provider response is mocked and live project API access is unproven without a dedicated game credential.

The final root E2E run passed all 232 tests across 70 files. Work remains local to feat/game-projects; no application release or production deployment was attempted.

## Native startup and checkpoint browsing

The native main bundle previously included Decart's browser worker code through createDecartClient and failed CommonJS parsing at import.meta. The server now calls only the token HTTP endpoint with header authentication; live video remains disabled. The normal native build checks both CommonJS bundles with Node before reporting success. The old bundle fails the same guard in an isolated temporary file, while repaired bundles parse and open the native app. This fixes a regression introduced by the game-provider import. Earlier verification treated the native timeout as an environment boundary and did not inspect its startup stage; build-time parsing now makes this failure class immediate. Checkpoint images appear before rule fields so their artwork and graph are visible together.

Native follow-up proof: five game-host tests pass and the actual Harness desktop app opens the committed harness-checkpoint-test-game project with all four generated images. Ten affected browser scenarios pass unchanged after the stable rebuild; the standalone-server scenario was not requested in that run. The broader native planning/Git-LFS image scenario still fails at its expected design-image assertion, outside game checkpoint images. Full root check is not green: it also scanned the disposable .cache/checkpoint-proof dependency test sources and reported unrelated dependency and timing failures. These failures remain recorded; native startup, CommonJS guard and checkpoint browsing are independently verified.

## Current-main integration acceptance

Native game acceptance creates real 2D/3D Git projects through the creation form, edits views and independent mechanics, adds checkpoint prerequisites/conditions/actions, generates an image through the real host boundary with only the external provider controlled, saves, reloads, plays, preserves progress across tabs, reads historical image bytes and returns to app navigation. Disposable fixture projects and profiles are removed. A live GPT Image account request remains separately labelled because no game-owned API key is configured.

The game service lifecycle fixture performs multiple Git snapshots, historical reads and stale-write refusals; its bounded allowance matches the 20-second integration fixtures instead of the default 5-second unit budget. No behavior assertion was removed. Root discovery now excludes ignored generated-project caches and nested dependencies, proven by unchanged real-runner root and inherited-workspace fixtures.

Full desktop verification also exposed older canonical fixture functions without the pure/shared callable metadata now required by main's helper catalog. The shared project fixture and named-reference fixture declare that eligibility; production catalog filtering and all existing behavior assertions remain intact.

Mobile graph fitting allows zoom to 0.1 for both initial layout and the explicit Fit View control. Native authoring scenarios require the key checkpoint fully visible after adding a dependent node, before clicking it, in both dimensions and every standard viewport.
