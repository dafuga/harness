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
- Work remains committed on feat/game-projects, unmerged and undeployed.

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
