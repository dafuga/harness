# Feature: Runtime Evidence Captures

The runtime evidence viewer must produce required Harness evidence from the compiled renderer, in addition to its existing browser assertions. The viewer's orders history, hashes, records and audio remain explicitly synthetic fixtures; the outer screenshot build identity and verification revision belong to the actual tested renderer.

## Acceptance Criteria

- A dedicated runtime-evidence-ui scenario requires desktop, tablet and mobile captures for current and explicit-commit views, inherited/missing states, behavior comparison, and audio presentation.
- Existing screen, behavior, state and review assertions remain intact, including positive old-host and phone evidence-gap tests.
- Captures wait for fonts and decoded nonzero images, use the rendered build stamp, require a verification revision, and reject unknown state or viewport combinations.
- The audio artifact is the actual fixture WAV loaded by the player, explicitly marked fixture with a truthful silence transcript; the UI's invented transcript is not claimed as audible speech.
- Ordinary opt-in screenshots are local smoke evidence only. Clean-snapshot Harness verification supplies the real outer revision and validates its compiled build hash before sealing.
- Missing required captures and missing provenance fail focused regression checks and the normal scenario gate.
