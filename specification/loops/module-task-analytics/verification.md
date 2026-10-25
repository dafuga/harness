# APIs, committed module tasks and completion analytics

The CLI reads local and hosted Harness resources, contracts and hash-verified recorded screenshots through the server API. The APIs catalog and page APIs tab retain revision-bound direct/transitive usage and explicit uncertainty. Harness retains task execution, submission and review history in the existing Git task queue and reconciles it into the existing analytics store. Reconciliation uses stable event identities and is idempotent. Prompts, wanted-contract contents and review feedback are excluded from analytics.

```sh
harness task schema
harness task feature feature-id --help
harness task add --input @task.json
harness task worker --help
harness task review TASK --attempt CLAIM_TOKEN --verdict accepted
harness task review TASK --attempt CLAIM_TOKEN --verdict incomplete --feedback 'Repair needed'
harness analytics tasks --project /path/to/project --json
harness analytics models --project /path/to/project --json
```

Tasks require a committed feature goal/TLDR, module goal and wanted contract before pickup. Prompts begin with the reusable feature context. Explicit model/intelligence choices are preserved. Auto chooses Haiku 5.5 at medium; only a structured Claude quota rejection triggers Luna 6 at max. An authentication or permission failure remains a failure.

## Completion and attribution

Successful execution enters review. An accepted review completes the submission. An incomplete review requires feedback, commits the submitted source as the repair base and requeues the same wanted contract. Reviews are bound to the active claim; duplicate and stale reviews fail.

Every provider execution is retained, including a failed Claude execution before fallback. Analytics groups requested and reported model identity separately with provider and intelligence. It reports executions, submissions, accepted reviews, incomplete reviews, execution failures, input/output/cache tokens and API-equivalent cost. Unknown data stays null.

Bounce rate is incomplete reviews divided by accepted plus incomplete reviews. A task with no reviews has a null rate. Execution errors are counted separately.

## Price provenance

The versioned rate card is `standard-global-2026-10-25`. Exact known model rates come from the [OpenAI pricing reference](https://developers.openai.com/api/docs/pricing) and [Claude pricing reference](https://platform.claude.com/docs/en/about-claude/pricing). CLI-reported API-equivalent estimates retain a separate basis. Neither source establishes subscription charges or authoritative invoices.

Canonical input tokens include cached tokens. Claude reports cache reads/writes separately from raw input; Codex includes cached input in its input total. Missing counters, cache durations and per-request context tiers remain explicit unknown values or price ranges. Unknown model prices are unavailable. See the [provider cost-accounting boundary](https://code.claude.com/docs/en/agent-sdk/cost-tracking).

## Regression proof and verification

The frozen application/test source is `f13d6d15e189a9195833dc49f063ab1b74737d57`. The independent standard hosted `xvfb-run -a bun run check` passed in job `121084549517`, completing at `2026-10-25T06:52:47Z` on Ubuntu with pinned Bun 1.2.18. This complete command passed formatting, types, lint, Rust native/Wasm, tests, builds, package compatibility, every workspace and audits. Linux declared 62 root and 20 Desktop platform skips; the Mac counts below are separate. No test or assertion was changed during qualification.

On `harbor-mbp-2`, the first clean complete `bun run check` failed in the concurrent report-run package test: its longer nested run did not seed history within the existing 180-second bound, with empty child diagnostics. Formatting, root types/lint, Rust/native/Wasm, kernel build, all 1,311 root unit tests (25 declared skips), all 285 CLI cases, build and the first package group (28 passed, three declared scale skips) passed before that failure. The original command remains failed.

The entire normal package command was repeated unchanged, followed by every normal downstream root-check stage, with the same 1 CPU / 2048 MiB reservation and clean source. That continuation exited zero: package groups 28 + 5, Reports 770, Planning 56, Desktop 973 units (three declared iOS skips) + 232 browser cases (one declared skip), Collaboration 45, Hub 479 units + 28 browser cases, Remote 135, Relay 159 and Game 27. All associated format/type/lint/build/audit and registry stages passed. The cause of the earlier seeding failure remains unproven; no assertion, timeout or resource policy changed. Before the aggregate, the complete normal browser preflight also passed serially: Desktop 232 with one declared skip; Hub 28. The generated-checkpoint case skipped by the ordinary Desktop run is exercised separately by the CLI integration fixture.

| Guard                                       | Failing historical source                  | Passing record at the frozen source                                |
| ------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Task usage, model and review analytics      | `f42de13b0ce45ce7b8be49e2358cf5f43f7bc7ab` | `fbccc86ebe26cbd4674d7f62cf8793c68f7a4162aac6ddbf9cd4daaccad1f66d` |
| Real cold profiler initialization           | `f42de13b0ce45ce7b8be49e2358cf5f43f7bc7ab` | `b866486af728cf6ada50c28855714c450fa1e0e616fa58b7d714ddf62a61a6db` |
| Packed SDK diagnostic in Bun and Node       | `6ef37ef27d5699a92f54ba09de8c9aa9b41ed370` | `d1edca72faf5250f81282198d78ebdbe64181fa33495bc02277d0b06968676c3` |
| Pages-first and dedicated preview choices   | `6f2453ae8ee79b5d2327228cc5ea50087368b735` | `6f4257ce1af02d4deec750eccd176fb3c077860730e4232c3d45529c793c9cd8` |
| Compact navigation and hosted account focus | `9b6971bc8869e49b8e635e06da6a9a6b2df770d3` | `8b861c9fac39c0195fad3211dfab9995a04fcd9c646c542fafe272bc0e3d5144` |

Each current pair freezes all 1,819 tracked test/configuration files and the exact command/runtime. Earlier failures and intermediate captures remain retained. The cold profiler, registered one-file scenario admission, balanced nested-section reading, typed Hub responses, installed-interpreter probes and SDK lazy-compiler repair retain their original assertions.

The CI-only local API fixture failed because a nested Git commit inherited no author. The shared recorded-evidence fixture now sets its generic repo-local author before any nested writer. The existing Console API matrix deliberately supplies empty local author fields: diagnostic `39a44202e7d04b938aa98ca8c95eed450d2cf02fb5a4d4c01548fcaec8f103b9` fails before repair; `1c50ad523380fe39ce1083cfbe8649ce873af1be9ae57d8a51b09e6ee6f0b1f6` passes all three API cases after repair. Independent consumer capture `339ae88a43e1c24734e3226c7804aa8e3cc223e4d214caf7408631758bc95cdc` passes all 18 Desktop cases. These are fixture diagnostics, distinct from product red-green proof; no global Git identity changes.

The earlier P4 aggregate passed 1,311 units, all 285 CLI cases, build/package stages, Reports 770 and Desktop 973 units, then stopped at Desktop browsers: six stale category inventories and three intercepted Models clicks. A first phone reservation violated the existing 184px header bound; that bound is preserved and also asserted in the fit matrix. A fixture measurement was then scoped to the banner owning Catalog categories, avoiding the search dialog's separate banner. Two existing game cases failed during a concurrent P8 browser run; their code, assertions and timeouts remain unchanged, and the complete serial current Desktop run passes both. Their underlying cause is unproven. The earlier idle `history attach` stall, unchanged passing retry, and full clean 285-case CLI repeat remain retained. No failed or interrupted aggregate is represented as a full pass.

Independent pre-seal capture `1accd6287d96255a7c65a201fd145769384fbfed37ded490aaa861db38c34ee8` at the frozen source retains 804 latency/RSS observations across all 23 API transport, controller, IPC and HTTP-source units. Navigation capture `876de1e0426e206ddb63d6cbeb28169a1658c8394ee814482450a521143bff00` retains 14 observations and five unique registered screenshots, all decoded and inspected. Its 54 unique cases execute 78 times because the 24-case fit matrix also runs separately for raw diagnostic screenshots. Compiled build `ac6948e332cec940f5949db073441053bc06447a4dc0ab383bbc7451c102d7fa` remained stamped and unchanged through that capture. Two earlier requests passed their 54 cases but used the raw-helper `true` flag, which disables canonical recording; the empty-capture guard rejected them. The corrected registered phases retain `TAKE_SCREENSHOT=1`. No application, assertion or timeout changed.

The canonical module-task scenario is exercised one registered target at a time. Independent capture records retain actual source bytes, lines, complexity, dependency counts, timing, process/worker RSS and the built CLI artifact. Type-only units have no executable runtime. Shared worker/process memory and bundle size are not isolated per-unit costs or approved performance budgets.

Responsive API flows cover catalog, contract, page usage, history and empty states. The three API routes and Agents panel use dedicated component-catalog captures at desktop, tablet and mobile sizes. Shared navigation also retains its standard registered search captures and the complete local/hosted layout matrix. Captures must be decoded, hash checked and inspected. Before handoff, the shared-preview readback must select the actual merged main source and revision data.

The final bookkeeping commit changes only documentation and loop state. Sealed captures run after that commit; their IDs and inspection receipts are retained in the delivery report, without further source changes. Receipts require identical application/test bytes from the frozen source to bookkeeping, then an identical whole tree from bookkeeping to the landed squash before reusing sealed pixels. Captures retain their own source and compiled-build identities. Screenshots are outside feature/main source commits; normal Harness evidence storage retains the declared capture receipts.

## Prevention and scope

The API insertion initially put APIs ahead of Pages. The existing ordered category matrix now includes every category, and the normal Pages-screen matrix projects every dedicated visual capture through its actual registered preview choice. Both run in standard Reports verification. The existing project Harness skill now requires the affected category, navigation, route, registry and preview-choice matrices before the root aggregate, including the Desktop category-fit/workspace-layout matrices and the hosted account controls, plus workspace type/audit admission before freezing tests. Every consumer preflight must finish before the aggregate starts. The trigger is any collection, destination or preview-policy change; an early-stopped root run cannot qualify downstream workspaces. Historical snapshots reject the original ordering and stale preview declaration before the repaired snapshot passes.

Tablet tabs reserve the existing control widths before wrapping. Phone controls use the existing top row; the hosted account row retains room for focus rings. The ordinary tests keep the 184px local phone-header limit, the three-pixel focus clearance, every overflow assertion and all twelve declared widths.

Architecture checks cache immutable source-import reads while preserving every assertion and the five-second limit. Workspace test fixtures are split by responsibility to meet existing file/function limits. Neither resource policy nor performance limits were relaxed.

The hosted native full-verifier job `121084549420` at this frozen source failed before execution: resource admission timed out after about 31 minutes, no verification record was produced, and artifact upload consequently failed. This is not a billing failure or native/performance-budget proof. The independent standard Full check has its own result.

Automated provider responses are synthetic. Earlier native probes on the test laptop found Claude logged out and Codex refresh credentials rejected; saved sessions were preserved. Paid-model completion, account-specific model access and a real quota fallback remain unproven. Provider installation discovery is not live execution evidence. No package publication, application deployment or physical-device verification is claimed.

The consolidated Project Reports run is `92efc4cd-d42a-46bd-afd0-a307cafb568c`. It is the selected delivery record for prior failures, final command results, captured pixels and subsequent merge/publication receipts.
