# Sol-7 visual review repairs

The 16 review items are recorded in `/tmp/codex-sol/note-7-fixes.md`.

The previous component catalog proved presence, decoding and basic state preparation. It did not reject placeholder commit identities/config strings, distinguish the named summary and verification states, measure mobile cell word wrapping or clipped history columns, inspect source-link affordance or nested focus indicators, align assertion rows with observations, or require an observable tooltip scroller.

Shared fixture repairs use realistic synthetic identities and readable authored steps. Existing expectations follow those values; independently constructed protocol edge cases retain their own inputs. Fixture corrections retain diagnostic before/after captures and do not manufacture product failures.

The unchanged standard catalog matrix is strengthened after its capture checkpoint. Product red/green covers summary rendering, mobile measurements/history, source links, navbar focus, assertion layout, console error presentation and long tooltip scrolling. Default behavior, registered identities and existing case counts remain stable.

The unchanged 48-case regression passes at 2394090329 against committed red e7bf6deb62. A later fixture-only correction binds long history notes to the displayed entity and asserts its disclosure. Fresh full-state recordings/API fetches and normal qualification follow; inherited broad-check failures keep full verification pending.

Inspection of the frozen tablet capture at fc77cca883 exposed a remaining History gap: geometry checks ran only on mobile and compared cells with the browser instead of their clipping frame. The existing catalog now checks all History cells against that frame at every viewport. The next matched red/green pair covers the existing History states without adding cases.

Tablet red at 7b35fdff9c retains three failures and 18 passes in record ee5172960e6d1a3e6b6b32b6fe06ce66ecf4a33a97387442c8dad91337d5f9b8. Product-only 77d9caf150 extends the existing labeled rows to widths through 800px. All 21 unchanged cases pass in green record 250cd9d039a5fee8ebde83265c9225dd86e69f7938c324a3155b7b6a49f34452, with identical tests, inputs, command, assertion and environment profile. Both records retain all three viewport images for every History state.

Inspection at 5d9974699a exposed a Source affordance gap: checking computed underline styling did not prove its pixels escaped the filename's overflow clip. The same linked-state cases now require space for the underline inside the clipping box, at every viewport. The parent component can reserve that room without changing the shared SourceFileList.

Source red at 03a6fcc1ba retains three viewport failures in record 9b214dccc47d69c9825b224d877cb817a08f90c8524a8d034f22567df9afdbf0. Product-only 653367e223 reserves token-based padding inside the filename clip. All three unchanged cases pass in green record 71e369efc2ab6c3ce74c835b1ae878f1df83903997a98077e80479181014fbbd, with identical tests, inputs, command, assertion and environment profile.

Verdict inspection at f38642205e found a capture-environment gap: Playwright's headless Chromium default hides scrollbars. A reserved gutter and successful End key did not prove a painted thumb. The existing long-tooltip cases now inspect original screenshot pixels inside the gutter, excluding the border. Record this environment correction as independent capture proof; a runner-configuration change is not a matched product red/green pair.

Independent capture 53900ea86bde6245f3682979fac54b3ecc8edf393b646b2e612eadf50228b28b at 2bfe0e13d2 rejects all three empty scrollbar gutters. Config correction 645e43fca1 removes only Chromium’s scrollbar-hiding launch default. Capture 646304835e6d3a5cedd6aba0d48b419445c0442432dd9e2060431fc46c97b3d0 passes all three painted-thumb checks. These are capture records, not a matched red/green pair.

## Prevention at fixture admission

Sections passed all 36 cases before the launch correction at 2bfe0e13d2 (capture 2ebcf1d8a7fa37fcce7e2b85054277caa3145a5583ea3a8a83eac6a427c38d81), but 11 cases at 30fd13470c failed image readiness and unexpected 404 checks. The catalog bundled one illustrated dataset, while the media router rendered another inside a Playwright worker. That worker inherits configured launch defaults; the separate bundler does not. Correction 645e43fca1 exposed this duplicate-sealing boundary.

The process gap was testing the corrected long-tooltip state without immediately admitting the complete shared dataset. The existing catalog admission case now checks all byte hashes and capture bindings before any image is recorded, and proves that corrupted or missing bytes are rejected. Vite publishes the same sealed dataset used by the bundle; the router reads those bytes without launching another browser. This applies to every catalog state and future shared fixture or launch-setting change, rather than to one failed image hash. The cost is one JSON sidecar and a single cached integrity read.

After changing shared fixture data, its transport or browser launch settings, run the complete assigned catalog matrix in the existing capture phase before expensive per-entity recording. Keep fixture correction captures separate from matched product red/green proof. Missing images and unexpected browser errors remain failures.
