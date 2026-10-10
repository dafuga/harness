# Feature: Agentic Self Hosting

## Overview

Harness hosts itself. Every service, page, component and shared function is a unit with a
stable identity and a contract. Changes are explained, their impact is computed from the base
and head graphs, affected scenarios are re-verified with fresh evidence, budgets are frozen, and
the results live in the same Git repository as notes and an evidence branch. A protected,
prebuilt `/harness` console replaces the standalone report experience in each host app.

No autonomous agent scheduler and no source sandbox are part of v1. The steady-state access rule
is component-scoped: declare the units being changed, then read only their implementations and
the public contracts of their dependencies.

## Public interfaces

- `ComponentManifest`, `ScenarioManifest` and `VerificationRecord` are versioned schemas, printed
  by `harness units schema <name>`.
- `harness generate unit <name>` scaffolds a generic unit and coexists with the Svelte
  `harness generate component <name>`.
- `harness units index|list|show|check|graph|retire|schema` maintains the registry in
  `specification/units`.
- `harness impact --base <ref> --head <ref>` reports direct and indirect, added and removed impact.
- `harness kernel parity|bench|default` proves runtime parity and records measured tradeoffs.
- `harness explain add|list|check` records the reason for every changed unit and function.
- `harness budget measure|check|establish|approve` enforces frozen baselines.
- `harness verify run|check` verifies an isolated exact source snapshot and gates on its record.
- `harness history sync|build|status` moves notes and evidence explicitly and prebuilds `/harness`.
- `harness hooks install` adds local hooks without overwriting existing hooks.
- `harness install sveltekit --admin-policy <module>` installs the protected `/harness` route.

- `@dafuga01/harness/contracts` and `@dafuga01/harness/runtime` are typed package entry points
  that never start the CLI.

The `generate unit`, `units`, `impact` and `kernel` commands and the package entry points exist
today; see Delivery status.

## Acceptance Criteria

### A. Contracts, registry, scaffolds and source graph

- A unit declares stable identity, one responsibility, owned source and symbols, an
  input/output/error contract, dependencies, runtime, scenarios and budgets; invalid manifests fail.
- `runtime.kind` and `runtime.entry` name the default execution target and `runtime.targets` lists
  every applicable target. The default must be listed and each runtime kind appears once. An
  alternative implementation in other source is a separate unit linked by a declared `contract`
  dependency.
- Responsibilities and contracts produced by the index are labelled `derived`; edited text must be
  labelled `declared`.
- The index covers existing Harness services, pages, components and shared functions, keeps
  identities stable across re-indexing and file moves, and never gives an identity to different
  source. Recreating retired source at its old path revives the identity. A new unit that reuses a
  retired name or exposes the same symbols records lineage to the retired identity, and that
  lineage cannot be removed by editing the manifest.
- Manifests cannot set a performance tolerance above 5%.
- The source graph resolves imports, re-exports, dynamic imports and Svelte scripts, including
  imports executed inside template substitutions; unresolved or non-literal references are
  recorded as uncertain instead of dropped.
- `VerificationRecord` carries explicit component versions (manifest, source, contract and runtime
  hashes, owned file hashes, exercised target) and measurement records (metric, unit of measure,
  workload, profile, method, tested revision, emitted artifact hashes, and either a value or an
  explicit unavailable reason). A record is assessable without a working tree.

### B. Runtimes, Rust kernel and measurement

- Module, Wasm, native JSON process and HTTP runtimes satisfy one typed contract, including
  errors, malformed output and timeouts. A unit's declared execution targets select real adapters,
  and an undeclared target is refused. Functions are never routed over the network implicitly.
- The manifest and record types and the runtime contract are importable, with declarations, from
  the packed package without starting the CLI.
- Impact is the reverse transitive closure over both base and head graphs. It covers removals,
  renames, shared functions, import and re-export changes, global config and test changes;
  uncertainty, including uncertain aliases, expands selection and is reported.
- The Rust kernel builds natively and as core Wasm from the pinned toolchain and matches the
  TypeScript reference on shared vectors and on randomized graphs.
- A request must be portable JSON: finite numbers, well-formed strings, plain objects and arrays,
  at most 64 levels deep. The reference, the Rust kernel and all four adapters refuse anything
  else as `invalid-json`, for structured requests and for request text alike.
- A result that arrives after its deadline is rejected as `runtime-timeout`, including when
  synchronous work blocked the thread. Module and Wasm targets cannot be interrupted; only
  process and HTTP targets are stopped at the deadline.
- A changed id that survives into head is covered only by a test or scenario in the head graph;
  base coverage counts only for a removed id.
- Benchmarks include serialization and invocation cost, and report memory only where it is
  attributable. The default runtime is chosen from recorded measurements.
- A benchmark run is calibration: it is labelled unverified, a run from an uncommitted tree names
  no tested revision, and it carries the hashes of the artifacts and sources it measured.
- Harness audit covers Rust sources, and guidance documents the Rust and Wasm build.

### C. Scenarios, verification, budgets and reasons

- Scenario contracts enumerate states, viewports, tests and evidence requirements. A state is
  required, missing or inapplicable. A missing state is preserved with its reason in a failed
  record: a scenario with one cannot pass. An inapplicable state needs a substantive reason, and
  lacking a fixture is not one. Every required state needs required evidence.
- A source change reruns the relevant unit and integration tests and the affected downstream
  scenarios, and excludes unrelated tests. Changed tests and global config invalidate selection.
- Every tested revision produces fresh evidence for affected scenarios even when the bytes match
  earlier output. Unaffected scenarios may reference older evidence marked with its tested
  revision, but only from a record that passed.
- A record is a statement about the whole revision, not about a range. The comparison base only
  narrows what reruns when a passing, intact record proves it; otherwise the nearest proven
  ancestor is used, or nothing. Tests, scenarios, reasons, budgets, the ledger and the registry
  are all judged from that proven revision, so an explicit base, an empty follow-up commit or an
  unverified parent cannot leave an unverified change out. The record states the base it used
  and, when it differs, the base that was requested. Nothing changed since a proven revision is
  the one case that inherits everything.
- Evidence is real media. A screenshot must decode as PNG at the viewport size, or at least as
  tall when declared full-page. Audio must be playable WAV whose duration matches what the check
  declared, with a transcript and its fixture or actual-capture provenance. Corrupt, truncated,
  mistyped or wrongly sized media is refused.
- A capture of running software names the build it came from; a stamp for another revision, or
  none, is refused. Ordinary suites capture only when `TAKE_SCREENSHOT` is set; `harness verify`
  requests its required captures explicitly. Waiting for fonts, images, canvas and async state is
  the browser runner's part of this protocol and arrives with stage E.
- Failure evidence stays failure, and a failed or incomplete record is stored, never presented
  as a pass.
- Verification runs on a clean export of one exact commit and tree. `harness verify check`
  rejects a record for another commit or tree, changed component versions and evidence that no
  longer matches its hash.
- The export stays that exact commit throughout the checks and their captures. It is compared
  with the commit after setup and after every check. A tracked file that is changed, removed or
  renamed fails, and so does any file that appears and is not covered by a declared output:
  new source, a new test, new configuration, anywhere in the tree. A change that a later check
  undoes is still a failure. The failed record is kept and names each path.
- Generated files are allowed only where the repository declares them: `outputs` in
  `harness.verify.json` lists build output, caches and reports. A declaration that covers a
  tracked file is refused and nothing runs, so source paths cannot be excluded this way.
- Checks run in separate process groups under hard limits and are killed with their children. An
  in-process deadline only rejects a late result.
- Size, complexity and dependency baselines are frozen. Performance tolerates 5% against a
  matching workload, execution target and machine profile. Missing or incompatible measurements
  never pass.
- A workload name does not make two measurements comparable. A performance baseline freezes its
  unit of measure, its method and a comparison context: the hash of the complete canonical
  request, the measured boundary, the protocol and the sampling. A measurement is compared only
  when unit, method, context, execution target and machine profile are all identical. Any
  difference is incompatible, missing or invalid metadata on either side is incomplete, and
  neither is ever reported as a pass or as an improvement. Units are never converted.
- Harness's own benchmarks derive the context from the request they actually send and the
  sampling they actually use. Any other benchmark capture must state an explicit, valid context;
  one without it cannot be compared or become a baseline, and a malformed one fails its
  scenario. A changed definition needs a reviewed approval, and the append-only ledger keeps
  the earlier definition and value, including those of other machine profiles.
- Only measurements inside a verification record of a clean, exact revision whose other gates
  passed can establish or satisfy a baseline. Calibration files, dirty runs and failed records
  are rejected.
- Budget increases, and any change to the 5% tolerance policy, need a recorded reviewer approval
  with a reason and the limits before and after. The reviewer is not the author of the change.
  The ledger is append-only, and each new line must cite a record that exists.
- New units need an explicitly established baseline. A unit with lineage inherits the frozen
  baseline of its predecessors, and identities present at the base revision must still exist at
  the head revision, so retirement and recreation cannot reset a budget.
- Verification fails when a changed unit or function lacks a reason covering its behavior change
  and its simplification and performance attempts, including attempts that did not improve.
  Removed, retired and recreated units need reasons like any other change. A reason is bound to
  the content it explains and goes stale when that content changes again. Reasons are required
  from the nearest proven revision, and a change made over several commits is explained by the
  reasons of every step in order.
- Records and reasons are drafts outside the source tree until stage D stores them in Git. No
  tracked file records the hash of the commit that contains it.

#### The invocation-boundary gate

In stage B a correctness-preserving repair ran request validation twice at the invocation
boundary and doubled module latency at 10,000 nodes, and nothing failed, because correctness
checks passed and no check compared the whole boundary with a frozen figure. The control that
closes this is part of verification, not a separate workflow:

- Trigger: a change reaches a unit that declares a performance budget, directly or through any
  dependency. The benchmark scenario covering that unit is then affected and reruns.
- Gate: the benchmark measures the whole public invocation, including validation, serialization
  and adapter overhead, and the result is compared with the frozen baseline for the same
  workload, execution target and machine profile. More than 5% worse fails; equal or within
  tolerance passes; a baseline from another profile is incompatible; no measurement is a failure.
- A timing of an inner function, or a calibration from an uncommitted tree, cannot satisfy it.
  Neither can a measurement of another request, another sampling or another unit under the same
  workload name: the comparison context must match the frozen baseline exactly.
- The gate cannot be skipped by choosing a range. Verification judges from the nearest proven
  revision, so a slowdown that failed once still fails on a later empty commit or another base.
- Every changed unit carries a performance rationale, including changes to boundary validation,
  with the tradeoff and any attempt that did not help.
- Noise is answered with more comparable samples. The tolerance stays at 5%.

For Harness the boundary is `service.unit-runtime`, covered by the `invocation-boundary` scenario
and measured by `harness kernel bench --boundary`. The loop for this feature runs
`harness verify check` as an evaluator of its verify step.

### D. Git notes, evidence history, hooks and CI

- `refs/notes/harness` holds structured reasons and verification references with exact commit,
  tree, profile, scenario identities and hashes. Source commits are never rewritten.
- Immutable manifests and media live on the `harness-evidence` branch of the same repository,
  media through Git LFS. Notes name the evidence commit and the original file hashes.
- Measurements of a commit are recorded after it exists, through notes and the evidence branch.
  No tracked source file records the hash of the commit that contains it.
- Recorded hashes do not keep commits alive. Verified commits stay reachable through explicit
  archive refs that are synchronized with notes and evidence, so history survives branch deletion
  and rewrites. A passing verification is never copied to a rewritten commit.
- Sync fetches and pushes notes, evidence and archive refs explicitly, preserves concurrent
  records and never force-pushes. Generated commit messages use `feat:`, `fix:`, `chore:` or
  `cleanup:`.
- Commit evidence is kept indefinitely; the 30-day cleanup still governs legacy report media only.
- Verification blocks missing required evidence, wrong revisions, stale server builds and exceeded
  budgets, and skips updates that touch only notes or evidence.
- Hooks are added without overwriting existing hooks and compose with hooks shared across
  worktrees. The CI publish stage never runs pull request code with write credentials.
- A fresh clone recovers notes, evidence and media. Missing notes, missing LFS objects, rewritten
  commits, malformed records and tampered artifacts are reported as such.

### E. `/harness` console and installer

- `/harness` is prebuilt from Git refs, notes, immutable manifests and resolved LFS artifacts, and
  needs no Git credentials, analytics database or R2 at runtime.
- Pages, JSON data and media are all behind host admin authorization, and client bundles embed no
  protected history. Harness itself accepts only the loopback local owner, decided from the
  connection rather than from Host or URL headers a client controls. The installer requires a
  host-supplied server-side admin policy.
- The console reuses the reports design and its gallery, player, transcript and export components.
- It shows a searchable interactive component graph, unit contract, runtime, dependency, consumer,
  test and budget details, the pull request impact graph, branch and commit ancestry navigation,
  recorded historical graph, notes, metrics, page-state screenshots and audio, and growth timelines
  explaining when and why each unit grew.
- Historical mode shows recorded tested states only and reports missing legacy evidence as missing.
- Former report and analytics routes redirect into `/harness`. Embedded views show only the host
  repository, while CLI, data and export compatibility and cross-project statistics are preserved.
- The legacy store is read-only for the importer. It takes only this repository's reports, keeps a
  null revision as unlinked, and exposes no global analytics.
- The views are legible at 1440, 920 and 390 pixels.
- The installer is proven on the stack host apps normally use: SvelteKit with
  `adapter-cloudflare`, where the deployed backend is TypeScript on Workers and Bun only builds
  and tests. The installed fixture builds there, and unauthorized requests for its pages, JSON
  and media are refused by server-side loading; no protected history or media is shipped as a
  static asset or inside a client bundle.

### F. Self-hosting and packaging

- The Harness repository carries its own registry, scenarios, baselines and synthetic fixtures.
- The console end-to-end suite runs against a fixed isolated test history.
- The packed installation ships the console and the Wasm kernel and still serves legacy reports.
- The typed runtime contract and executor are the same on every host. Module, HTTP and Wasm
  execution through the public package entries are proven in a local Workers runtime, using
  precompiled Wasm modules that the host injects instead of filesystem or process access.
  Native-process execution belongs to Node and Bun hosts and is not advertised inside Workers.
  The package is so far proven under Bun and Node only. No backend replatforming and no retrofit
  of a real website is part of this work.

## Known baseline failures

The reports browser suite is not part of `bun run check`. On untouched `6cf10dd` it has three
failures, recorded by independent verification and not introduced by this work:

- `tests/e2e/project-reports.spec.ts:50` places the gallery too far below the report header at
  1104 pixels (1387.9 against a limit of 750) and at 390 pixels (1445.9 against a limit of 1100).
- `tests/e2e/provider-picker.spec.ts:4` finds no combobox named exactly `Provider`.

Their assertions stay as written. Stage E reuses this frontend, so it must reconcile the
responsive report layout and diagnose the picker configuration before the suite is required to
pass. Until then they are reported as failing, never as passing.

## Future Enhancements

- An autonomous agent scheduler and a source sandbox that enforce component-scoped access.
- Retrofitting other host apps and non-Node SvelteKit adapters.
- Function-level contracts derived from the TypeScript type checker.

## Delivery status

Stages A, B and C are implemented. Stage A: unit schemas, the unit generator, the `units`
commands, the source graph and the self-host registry. Stage B: the runtime contract and
adapters, the reference and Rust kernels, `harness impact`, `harness kernel` and the typed
package entries. Stage C: scenario contracts and their coverage rules, the evidence protocol
with media and build-stamp validation, verification of clean snapshots under process isolation,
reasons, frozen budgets with a reviewed ledger, and `harness scenarios`, `explain`, `budget` and
`verify`. Stages D to F are not started. Stage evidence is recorded in the
`agentic-self-hosting` loop.

What stage C does not yet do:

- Trust is one step deep and local: a base is proven when its latest stored record passes and is
  intact. Records are not signed, and a fresh clone has none until stage D stores them in Git,
  so its first verification covers the whole revision.
- A benchmark capture written by an arbitrary script declares its own comparison context.
  Harness validates and compares it exactly but cannot prove what the script ran; only
  `harness budget bench` and `harness kernel bench --boundary` derive it from what they send.
- The first verification of a repository, or of a commit with no proven ancestor, needs a
  reason for every unit as added. A unit explained that way and then edited before any record
  passes must be explained unit-wide again.
- Checks inherit the environment of the command that started verification, and verification
  disables analytics recording for every check. Harness's own analytics tests assume it is
  enabled and its output declaration is untested: both belong to the self-host run in stage F.
- A capture's build stamp is still whatever the check states. Tying it to a real served build
  whose identity derives from the source, tree and compiled artifacts arrives with stages E
  and F; until then a stale build relabelled with the current revision would not be noticed.
- Records, evidence and reasons are local drafts in `.cache/harness`. Notes, the evidence
  branch, sync, hooks and CI belong to stage D, and until then a ledger line can only be checked
  against records present in the same checkout.
- No browser runner captures screenshots or audio yet. The verifier accepts only PNG and WAV and
  validates them; readiness for fonts, images, canvas and async state arrives with stage E.
- Harness has not verified one of its own commits. Its configuration, boundary scenario and
  budgets are declared, but no unit has a baseline: they can only come from a clean record of a
  committed revision, which stage F establishes.
- The reviewer rule compares a name with the commit author; it is a recorded control, not an
  authentication.
- Verification runs on POSIX systems; checks are started through `sh`.

The one recorded benchmark is calibration from an uncommitted tree: it names no tested revision
and is not verification evidence. Module memory and HTTP memory are reported as unavailable.

Known gaps carried from earlier stages:

- Module and Wasm calls cannot be interrupted. Their deadline rejects a late result but the
  thread stays occupied until the call returns; hard limits need a process target.
- The native binary is not shipped in the package, and no CI workflow builds the kernel yet.
- The registry records every stage A responsibility and contract as derived, six references as
  uncertain, and four plugin packaging files as unclassified.
