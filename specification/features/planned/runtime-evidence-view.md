# Feature: Runtime Evidence View

## Overview

The shared viewer of the desktop app, the hosted page and the phone shows what verification recorded from running software beside what was planned. An entity opens on an Overview with its contract, size and performance, its relationships and its recorded runtime evidence. Designs keep a section of their own, with their image threads. A design is never shown as a runtime capture, and a runtime capture is never open to comment.

Evidence is read through the two optional bridge reads `evidence` and `artifact`. The viewer takes no address or path from an answer: bytes are asked for by the binding the answer gave, hashed again in the page, and shown from an object URL that is revoked when it is no longer shown.

## Acceptance Criteria

- Function catalog cards show only the name, a description capped at 80 characters including any ellipsis, and a compact open icon. Contracts, usage, verification and test results remain on the function page.
- Visual pages, components and shells have a States tab. It shows every declared state as a screenshot, including error and empty states, with a viewport selector. Headless entities retain recorded input/output Tests or Evidence.
- Each state shows one current capture at a branch tip or its before/after pair at a selected commit. Missing, rejected, inherited and inapplicable states stay explicit. Detailed verification remains in a disclosure; it never replaces the gallery.
- Used In and Uses have separate sections. Each section has an address; legacy visual Tests/Evidence addresses open States. Details opens only at its own address. Source stays under Details, then Source.
- At a branch tip one current screenshot is shown for the picked scenario, state and viewport. At a named commit, also when it is the tip, the commit stands beside its first parent.
- A side that is missing, rejected, inherited or not recorded alike says so in the words of the record. An inherited capture names the commit it was made at and is not said to be captured at the tip.
- A function or a service shows its recorded steps, input, output, assertions and trace. A change of behaviour is stated only after both results were read and checked; damaged or refused bytes leave it unknown.
- A clip is one at a branch tip and a pair at a commit; a side or a declaration without a clip says so.
- Component runtime screenshots sit between entity identity and its tabs on every component screen, including History and Details. Overview does not duplicate this preview. Functions never gain screenshot headers.
- Component evidence is read on every tab; other entities read it on Overview, Evidence and History. An answer for an entity or a scope that is no longer shown is dropped.
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

## Persistent Component Header Verification

- Opus 5.5 implemented the shared component preview above tabs in both renderers. History and Details retain it; Overview has no duplicate.
- Failing test commit: `116739e51cceeb56e9fe849804f248dec4d3c97f`. Passing implementation: `2d8bf583f04326c53d325395f1ed23b7103a1354`.
- Harness regression records: red `dfdaa19e0af6e48592ed7a9a9a98a2d9cce435d6652bba1579f6a81bbbdbafba`; green `1c26838bf84f8d835b9f277a83e12460fe6ad7938e88483a887fe690bd569836`. All 1,257 frozen inputs match.
- Later maintenance reuses a test screenshot label, updates import-graph expectations and normalizes JSON quoting. Product source remains identical to the passing implementation.
- Reports formatting, types, lint, 569 unit tests and all builds pass. Browser checks: 62 explorer cases and five shared-workspace screenshot cases pass. The 13 shared-import tests and registry validation also pass.
- Browser inspection confirms the real historical navbar capture persists on Used In, History and Details. Activity List has no recorded capture at the selected current revision; its missing-evidence message stays explicit above tabs.
- Full Reports verification remains blocked by existing file-length violations in `entity-preview-marks.spec.ts`, `Harness.types.ts` and `EntityTests.svelte`. Existing Desktop lint debt remains in `ios-simulator-build.test.ts`. Native Electron testing is paused; the root aggregate check includes paused native work. The loop's final verification step remains pending.
- Fresh browser images and task logs stay under `/tmp`; no captures are committed.

## Host Files

Agent host-file changes, tracked as metadata only:

- Claude project memory `~/.claude/projects/-Users-danielfugere-projects-harness/memory/harness-shared-checkout-gotchas.md`: UI owner `7f0b5b97-5297-4f84-88b7-4cd142055979` added three working notes. Before SHA256 `24df8ccf0c271b9759405d14c29f412d9b31bcb162540cc26b08aedd1882f0f2`; after SHA256 `446e1e4f4f174352b92515cab0188714e97f81fbcd1b75812d5a87de47b8aecb`, 7047 bytes. Contents remain private.
- The same file, for the script integration: three more notes by the same owner. Before SHA256 `446e1e4f4f174352b92515cab0188714e97f81fbcd1b75812d5a87de47b8aecb`; after SHA256 `46fc8d96618a71744fc98272b36899db8d860b3592ee96890ad2e1f77af05a2c`, 7933 bytes. Contents remain private.
- The same file, for the audio policy repair: two notes changed or added. Before SHA256 `46fc8d96618a71744fc98272b36899db8d860b3592ee96890ad2e1f77af05a2c`; after SHA256 `4fb14ee826d6806a9d1afcaf40026163fe745aca1e34cf69a3335163f08d63c0`, 8388 bytes. Contents remain private.
- Task-owned and outside the repository: isolated exports with their own installed dependencies under `/tmp/harness-fresh-checkout.*` and `/tmp/harness-audio-export.*`, and logs under `/tmp/harness-fresh-*.log` and `/tmp/harness-audio-*.log`. No other host file was changed.

## Supported Visual States

- Pages, components and shells expose States; functions, services and configs keep their recorded input/output tests. Legacy visual Tests/Evidence links remain usable.
- One shared gallery lists every declared state, including explicit missing and inapplicable coverage. Viewport selection keeps the selected revision; branch tips show current captures and named commits show both sides.
- Activity List declares six states at three viewports: collapsed, expanded, short, empty, ordered and caller-supplied error content. The component has no internal network-error API; its row snippet renders the error fixture.
- Capture provenance and verification diagnostics stay in disclosures. The persistent component preview remains above every tab.
- Regression: failing test commit `51f5137c`, record `b325dd70`; passing source `af13ab15`, record `530afede`. The same command and all 1,262 frozen inputs match.
- Reports checks pass: formatting, types, lint, 570 unit tests, builds and audit. Root types, lint and 847 unit tests pass; 25 live-provider cases remain skipped by their existing configuration.
- Shared-workspace browser acceptance passes 11 cases. Electron and simulator testing remain paused. The full root aggregate includes native work, so the loop's aggregate verification step remains pending.
- The shared preview fixture keeps one asset route per page across navigation; pending lazy images cannot fall through a route teardown. Browser error assertions remain enabled.
- Runtime captures use the existing clean-snapshot runner, build identities, artifact hashing, Git notes and LFS evidence branch. A scoped capture explicitly marks other scenarios unverified and never claims whole-repository verification passed.

## Compact Function Catalog

- Function cards contain only a name, a description capped at 80 Unicode characters and a 36px open icon. Longer descriptions end with an ellipsis; contracts stay on the entity page.
- Clean-snapshot regression: failing tests at `dfee79a6`, passing fix at `fa315247`. Red `d57ca4ac` and green `f6f408b2` use identical frozen inputs and commands.
- Reports formatting, types, lint, unit tests, builds and audit pass. Three browser cases prove desktop, tablet and phone layouts, revision navigation and access to the Contract tab. Native testing remains paused.
