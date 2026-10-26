# Class audio proof

The same existing `TestArtifactService.capture` case fails at
`1bda783221347d299faf83d7851e30171869fc24` and passes at
`37096c026eafe524e73c927701f06207231c9f24` without changing its case count,
inputs, fixtures, expected results or command.

- Failing record: `77a3588bbfaac7940a01d3a83de30a9ca06cf102d9fd149d9e0543efe52c9f9a`.
- Passing record: `cfc1e6939d4a5a329709a2de44818522f5a6a5cf20d007fe21e134319fdd2049`.
- Audio SHA-256: `d62864e6ea737a2a02f3341d9c944f5d67dcc0c08be05a81fb0a1f0d5348a05b`.
- Both records retain 3,244 WAV bytes, the declared class/case/state and their own tested revision.
- Transcript: `[Generated 440 Hz tone; no spoken words.]` This is a deterministic fixture, not a live speech-provider result.

Original Git-note, evidence-manifest, record, log and WAV hashes were read back and
verified. macOS `afinfo` independently decoded mono 16 kHz Int16 PCM with a
0.100000-second duration; `afplay` completed successfully on the retained bytes.
The failed record remains failed. Neither record grants full project verification.

The reviewed patch passed root typechecking, full lint, registry validation,
audit and 32 existing method, CLI screenshot/history, generator, ownership and
readability cases on `harbor-mbp-2`. Explorer Examples playback and current-main
browser delivery remain pending; the shared preview currently serves another
checkout and older revision data. No screenshots or generated media were added
to the source branch.
