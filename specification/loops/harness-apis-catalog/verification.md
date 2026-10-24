# APIs catalog and page usage

## Delivered behavior

The selected project and revision list indexed HTTP endpoints as APIs, with routes, exported HTTP methods, contracts, source, history and consumers. Pages have an APIs tab showing recorded direct and transitive requests through components, services and layouts. Links and reload retain revision scope; earlier revisions do not show later endpoints. Local and shared-workspace catalog projections use the same category and relationship rules.

The source index resolves same-workspace rooted static `fetch` and known platform `fetch` calls to route endpoints. It handles route groups and basic dynamic segments, prefers literal routes, and is cycle safe. Ambiguous, external and computed requests remain explicit uncertainty or external references. This is source-derived usage, not complete runtime tracing. Empty pages say “No APIs are recorded for this page.”

`harness api get apis` reads endpoint manifests from the active registry, including endpoints omitted by an older server's visual catalog. Existing permission and selected-revision boundaries still apply. A manual read against the unchanged local server returned all 14 real Harness endpoints.

## Verification scope

Application code last changed at `5381cd1203858db72541de2a7412347d1955c145`. Commit `f1afc969327a1e1f915020006f8fdc4689e7e019` adds the three route pages to the existing component-preview matrix and its existing representative fixtures. Later handoff metadata does not change executable source.

All automated E2Es ran on `harbor-mbp-2`. Primary-Mac checks were unit/type/audit commands and manual in-app browser inspection. Synthetic browser fixtures render the actual shared UI; they are not deployed-project or physical-device evidence.

| Check                                                         | Recorded result                                                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Root source, routing, ownership and import-impact regressions | 112 passed at `ab96bfbd20df1ef1a234433f02d895847652d4ba`                                                                |
| Desktop catalog reads, search and routes                      | 17 passed; committed page → service → endpoint fixture includes cycles and revision isolation                           |
| Local/hosted API CLI, context and registry E2Es               | 23 passed at `f1afc969327a1e1f915020006f8fdc4689e7e019`                                                                 |
| Catalog → contract → consumer → page APIs browser flow        | 3 viewports passed; includes reload, historical and empty-state assertions                                              |
| APIs index, detail and history route previews                 | 9 passed at `f1afc969327a1e1f915020006f8fdc4689e7e019`; all saved images inspected                                      |
| Shared workspace and visual registry guards                   | 6 passed after registering the three new pages; original assertions preserved                                           |
| Root, Reports and desktop type checks                         | Passed; Reports includes application and preview configs                                                                |
| Harness audit and unit integrity                              | 0 audit findings; 1,772 units, 161 uncertainties, 0 integrity errors                                                    |
| Manual real-project preview                                   | 14 endpoints; page APIs tab shows `POST /api/report-screenshot-upload`; desktop/tablet/mobile have no document overflow |

Representative commands:

```sh
bun x vitest run test/services/unit-index.test.ts test/utils/scan-imports.test.ts test/utils/explorer-route.test.ts test/utils/explorer-legacy.test.ts test/explorer-shells.test.ts test/shared-search-impact.test.ts --maxWorkers=1 --no-file-parallelism
bun x vitest run test/api-cli.e2e.test.ts test/api-context.e2e.test.ts test/api-registry.e2e.test.ts --maxWorkers=1 --no-file-parallelism
HARNESS_VERIFY_REVISION=$(git rev-parse HEAD) TAKE_SCREENSHOT=1 HARNESS_EVIDENCE_DIR=/tmp/harness-apis-route-evidence-verified bun x playwright test --config src/configs/shellPlaywrightConfig.ts tests/e2e/explorer-shell-component-catalog.spec.ts --grep 'reports.page.harness-branch-branch-at-apis'
bun run check
```

## Preserved regression records

The same frozen UI assertions fail against unchanged historical application code and pass after implementation:

- Red: `224af21447faafcb9dae0604aba4bf3cb9e1048fadb8bba2faefbddd0e6282e0`, source `8a55ab7e4e4a73c8e64cb5556aea48eeca705c01`.
- Green: `bd8514665ff68147eadbbec4f56f3ad7e32c7168a9ae01cafb5aaa927d06df1c`, source `6839ae340b9065bb64b4820e240657977c5ff48e`.
- Independent UI capture: `67167a3183d21376df50cfb140fd7b68575f0b6742e53ac7a07d8045ce9cc475`, source `ab96bfbd20df1ef1a234433f02d895847652d4ba`: 424 measurements and 39 screenshots. All screenshots are retained as ordinary Git blobs and verified against their recorded hashes.

The earlier combined profiling capture `8f4ccf6837f0241eb6920b9a38eb2a87a5b3694bf1ebc638036d2182d40b92d4` failed when two CLI cases timed out under instrumentation. Ordinary CLI E2Es pass; this failed capture is retained and does not count as green CLI profiling proof. A separate manual CLI process read took 1.37 seconds and 196,444,160 bytes peak RSS, including startup and network activity; those are not isolated-helper measurements.

## Required gate still pending

`bun run check` at `5381cd1203858db72541de2a7412347d1955c145` passed formatting, types, lint, Rust checks and kernel build, then stopped with 1,202 unit tests passed, 3 failed and 25 skipped. One failure was the missing API route-preview registration, repaired in `f1afc969327a1e1f915020006f8fdc4689e7e019` and verified by the unchanged 6-case registry guard and all 9 route previews.

The other two failures were independently reproduced on clean main `bb0d5b323e7e93886c3e19f1e88b46af582bed8b`: `test/late-cleanup.test.ts` expected a late tool-start observation, and the design-option-storage case in `test/verification-observations.test.ts` timed out. Their assertions are preserved. The full gate has not passed; later full E2E, build/package and workspace stages remain unproven by that command.

Two broader Reports relationship-fixture cases also fail unchanged on clean main; baseline diagnostic record `9a0f768af32ceea83a53cfb2786cd90aa5815097fe2c9e410af3a6f7b3666597` preserves that result. Focused new API relationship cases pass. No unrelated fixture expectations were weakened.

The Project Reports run `ffb27570-1672-4185-a1e7-b7cf10fde2c9` remains active while the required gate is pending. PR #114 remains draft. No application deployment, package publication or production promotion is claimed.

## Prevention notes

Preview shell variants now share one mount list between the fixture and client, preventing padded nested shells from invalidating the existing fit assertion. The shared-search guard retains its alias-isolation checks in an HTTP-free graph slice, while the full graph keeps conservative unresolved-HTTP impact selection. These are local fixture and guard corrections; no global instruction changes were needed.
