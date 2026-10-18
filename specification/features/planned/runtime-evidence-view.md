# Feature: Runtime Evidence View

## Overview

The shared viewer of the desktop app, the hosted page and the phone shows what verification recorded from running software beside what was planned. An entity opens on an Overview with its contract, size and performance, its relationships and its recorded runtime evidence. Designs keep a section of their own, with their image threads. A design is never shown as a runtime capture, and a runtime capture is never open to comment.

Evidence is read through the two optional bridge reads `evidence` and `artifact`. The viewer takes no address or path from an answer: bytes are asked for by the binding the answer gave, hashed again in the page, and shown from an object URL that is revoked when it is no longer shown.

## Acceptance Criteria

- Sections are Overview, Designs, Relationships, Evidence and History. Each but the overview has an address. The address decides the section also when the entity stays the same, and Details is open only at its own address. Source stays under Details, then Source.
- At a branch tip one current screenshot is shown for the picked scenario, state and viewport. At a named commit, also when it is the tip, the commit stands beside its first parent.
- A side that is missing, rejected, inherited or not recorded alike says so in the words of the record. An inherited capture names the commit it was made at and is not said to be captured at the tip.
- A function or a service shows its recorded steps, input, output, assertions and trace. A change of behaviour is stated only after both results were read and checked; damaged or refused bytes leave it unknown.
- A clip is one at a branch tip and a pair at a commit; a side or a declaration without a clip says so.
- Evidence is read only on Overview and Evidence. An answer for an entity or a scope that is no longer shown is dropped.
- A connection without the reads, a planned entity, a failed read and a saved copy each say what they are.
- The mark beside the name of an entity is the verdict of the reports explorer over the record that was read; otherwise it is unknown and says why.
- An incremental record may have no fresh tests. Its validated inherited checks count for the unchanged units they cover and keep their original tested revision. Missing, failed, stale, unrelated or invalid proof never grants a passing mark.
- An entity is named in words; the address a page is served at is shown as a fact. A commit of the history is a link only when the shown branch lists it.
- Proof: `packages/desktop/tests/e2e/ui-evidence-*.spec.ts` over a synthetic sealed history, the unit tests of the new units, and the hosted workspace spec of the hub.

## Known Limits

- Current bridges offer both reads. Older or capability-limited connections retain an explicit gap. Transport tests and synthetic compiled browser checks do not establish native simulator or live hosted acceptance.
- The desktop and the hub read sources of other packages through vite. Their `dev`, `build` and `test:unit` scripts, and the desktop `build:mobile`, `remote:fixture` and `ios:acceptance`, run `sync:shared` first: reports for the desktop, the desktop and reports for the hub. Type checks, lint and test discovery need no sync. This was shown by running each entry point in an isolated fresh export, before and after; no test asserts the script text.
- The README and the headers of the two scripts start the fixture and the acceptance through `bun run remote:fixture` and `bun run ios:acceptance`. A direct `bunx vite-node scripts/…` bypasses the sync.
- The compiled renderer plays a recorded clip: its policy allows media from the app and from a blob, and keeps its limits on scripts, frames, objects, the base address and connections. `packages/desktop/test/renderer-policy.test.ts` guards those directives; the audio case of `ui-evidence-behavior.spec.ts`, run with `HARNESS_VERIFY=1` against a fresh build, is the regression.
- The hub sends no media restriction and the phone shell sets no policy of its own; neither was changed. The Electron window itself was not driven here: its policy comes from the same function, which the compiled main bundle was checked to carry.
- The verdict beside the name needs `evidence.after.detail` to hold the unit and the whole judging record. Where an answer does not, the mark stays unknown.
- Root's manual browser and native checks, and captures of the new states for a scenario, are not part of this unit of work.

## Host Files

Agent host-file changes, tracked as metadata only:

- Claude project memory `~/.claude/projects/-Users-danielfugere-projects-harness/memory/harness-shared-checkout-gotchas.md`: UI owner `7f0b5b97-5297-4f84-88b7-4cd142055979` added three working notes. Before SHA256 `24df8ccf0c271b9759405d14c29f412d9b31bcb162540cc26b08aedd1882f0f2`; after SHA256 `446e1e4f4f174352b92515cab0188714e97f81fbcd1b75812d5a87de47b8aecb`, 7047 bytes. Contents remain private.
- The same file, for the script integration: three more notes by the same owner. Before SHA256 `446e1e4f4f174352b92515cab0188714e97f81fbcd1b75812d5a87de47b8aecb`; after SHA256 `46fc8d96618a71744fc98272b36899db8d860b3592ee96890ad2e1f77af05a2c`, 7933 bytes. Contents remain private.
- The same file, for the audio policy repair: two notes changed or added. Before SHA256 `46fc8d96618a71744fc98272b36899db8d860b3592ee96890ad2e1f77af05a2c`; after SHA256 `4fb14ee826d6806a9d1afcaf40026163fe745aca1e34cf69a3335163f08d63c0`, 8388 bytes. Contents remain private.
- Task-owned and outside the repository: isolated exports with their own installed dependencies under `/tmp/harness-fresh-checkout.*` and `/tmp/harness-audio-export.*`, and logs under `/tmp/harness-fresh-*.log` and `/tmp/harness-audio-*.log`. No other host file was changed.
