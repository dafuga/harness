# Harness game engine

A deterministic TypeScript runtime for independently authored mechanics and checkpoint graphs. Browser renderers provide simple 2D Canvas or 3D Three.js scenes; A provider adapter can transform their appearance while the engine retains control of game outcomes. Live AI is currently disabled pending a credential-safe transport.

`createRun(seed)` creates state. `stepGame(run, input, view, mechanics?)` advances one 1/60-second tick. Custom mechanics return disjoint state patches from a shared read-only snapshot; conflicting writes fail explicitly. Checkpoints test the resulting snapshot, then apply actions in stable ID order. They fire once per run unless repeatable.

`game.json` contains views and independent mechanics contracts. Each view owns visual direction and checkpoint nodes: stable IDs, positions, prerequisites, structured conditions/actions and AI guidance. Save through the desktop bridge to enforce project identity, current-branch writes and optimistic concurrency. Git retains historical versions. Graph descriptions are specifications, not executable code.

The starter includes key, door and garden/vault branch checkpoints. Movement, key acquisition, collision and outcomes remain identical with or without AI video. `draw2d` and `create3d` implement the basic visuals. Custom mechanics are authored in TypeScript and passed to `stepGame`; editing their contract does not itself generate implementation code.

## AI preview

Live AI preview is disabled in this build. Decart SDK 0.2.12 puts its short-lived credential in the WebSocket URL, contrary to project credential rules. Both the desktop service and browser connector fail closed before reading credentials, minting tokens or capturing a stream. A compliant transport and a dedicated project credential are required before enabling live rendering. No provider request has been made.

The prepared host adapter reads only `HARNESS_GAME_DECART_API_KEY` from the game's ignored, untracked `.env.local`. No ambient or other-project credential is borrowed; remote and hosted projects cannot mint tokens.

Published Decart rates checked October 20, 2026: Lucy Restyle 2 $0.01/second, Lucy 2.5 $0.02/second, Lucy 2.5 fast $0.04/second. Each active stream incurs its own cost. Rates: https://docs.platform.decart.ai/getting-started/pricing

The tested adapter and lifecycle infrastructure enforce a maximum 60-second duration, provider-enforced token constraints, no automatic reconnect, and cleanup on hidden document, error or unmount. One token lease per project prevents overlapping starts; because a token may start a session until expiry, a stopped preview can remain leased briefly. Token expiry alone does not end an existing stream.

Live AI geometry preservation, visual consistency and responsiveness require a real provider test. Unit tests mock transport and do not prove model quality. HUD controls stay outside generated video. Simple rendering remains available when AI is unavailable.

## Verification

`bun run check` runs format, types, lint, tests, build and Harness audit. Set `HARNESS_CLI_PATH=../../src/index.ts` when checking from this repository. Root verification includes this package and temporary-workspace CLI coverage for both dimensions.
