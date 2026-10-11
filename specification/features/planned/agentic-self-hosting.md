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
- The size of what a unit emits is frozen for each execution target by itself, as
  `artifact-bytes:<target>` in the ledger, from the build of the verified snapshot and with the
  hash of every artifact. A process binary and a Wasm module never share a limit, several
  artifacts of one target are one sum, and a module has none. An output that is gone fails, one
  that could not be built at review is stated, and one a baseline does not cover needs a
  reviewed approval. Earlier records are not rewritten; a ledger line older than these limits
  covers no output, so the first verification after it asks for that approval.
- The console shows those sizes and limits from the index alone: a line for each target in the
  component panel at any revision, a table of emitted sizes in the growth view with the limit
  each commit was verified under, the baseline or approval that reviewed it, the reason and the
  way to the evidence, and each target's size on both sides of a comparison. The index holds
  the sizes per target, the limits of each revision and the reviews of every unit. For the
  repository's own history this reads: process 402048 bytes and Wasm 143132 bytes at the one
  measured commit, with no limit recorded, because no baseline has been established.
- A declared freeze is not shown as a limit. The panel says `frozen at` a number only where a
  reviewed limit is known for that revision, from the record's own finding or from the ledger
  of the revision; otherwise it says that a freeze is declared and no reviewed limit is
  recorded there. Until this was corrected the panel of the first real record read `frozen` for
  source bytes and dependencies although that record's findings are all `missing-baseline`. The
  record itself is unchanged.
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
- A record is accepted into history only if its schema, seal, every file and its source commit
  and tree check out. The sealed record states the outcome: a note is an index, and a note line
  that was written for another commit or that disagrees with its record is reported and unused.
- Records are only added. Separate runs of one commit, overlapping writers in one repository or
  in worktrees sharing one Git directory, and clones that diverged all keep every record; media
  writes, note updates and ref updates are safe to overlap.
- A record counts only with what it inherits. Its base record and the records behind referenced
  scenarios must be attached and intact to the root; a missing or damaged dependency, or a
  cycle, leaves it unproven. Attaching a record attaches its dependencies and the records the
  budget ledger cites.
- Reasons are kept in notes, with a record or for a committed range, and explain the change in
  every clone and worktree.
- Evidence and notes are not source: they are never impacted, explained or verified, and an
  evidence revision is refused as a code snapshot. Branch lists leave them out, while commits
  kept only by an archive ref stay in history marked as retained.
- The history index is built from Git alone and is deterministic. It lists every source commit,
  with its records or the gap, the registry graph stored at that revision, the comparison each
  record made, inherited evidence with the record and commit that produced it, reasons, unit
  growth and benchmark series. Series are separate per machine profile and per comparison
  context. Media is copied in by hash; anything missing is a stated gap.
- Legacy reports are imported as recorded and only for this repository: original dates and
  outcomes, a running run stays running, an unresolved revision stays unlinked, and the old
  store is only read.
- The local hook is opt-in per worktree and pre-push only. It keeps and runs an existing hook,
  verifies the pushed commit in a clean snapshot, attaches the record and blocks a failure.
- CI separates verification, which is read-only and runs the code, from publication, which is
  trusted, validates the record as data and never runs the verified commit. Actions are pinned
  to commit hashes. No workflow establishes or approves a budget, and a runner whose profile
  has no reviewed baseline fails the performance gate.

### E. `/harness` console and installer

- `/harness` is prebuilt from Git refs, notes, immutable manifests and resolved LFS artifacts, and
  needs no Git credentials, analytics database or R2 at runtime.
- Pages, JSON data and media are all behind host admin authorization, and client bundles embed no
  protected history. Harness itself accepts only the loopback local owner, decided from the
  connection rather than from Host or URL headers a client controls. The installer requires a
  host-supplied server-side admin policy.
- The console reuses the reports design and its gallery, player, transcript and export components.
- `/harness/analytics` is about the application the server is hosted for. It names the repository
  and shows, before its totals: how many registered agents are working now and on which
  components, the loop types the project uses, its recent commits with the reasons noted on
  them, and the files that changed with their components, committed and not committed apart.
  An agent is working only while its own heartbeat is fresh (`harness activity register`,
  `heartbeat`, `finish`); a stale loop, a running report or a mere process is not one, and where
  nobody registered the number is unknown, not zero. Everything is read on the server for this
  repository and its worktrees alone, behind the owner policy. The first view is short, with
  what is not committed near the top and the rest one control away; an open page reads again
  every 15 seconds and on request, and a reading it could not renew stops calling anybody
  working after a minute.
- `harness history build` records the same committed activity beside the index, from Git alone.
  An installed console shows it in its Activity view without Git or a database and says that
  live activity is not part of a recorded history.
- Every choice on the website is one shared select component: the report filters, the comparison
  and audio uploaders, the gallery, the replay, the provider picker, and the branch, commit, base,
  comparison and growth choices of the console. It is a labelled native select with one caret,
  one size and one disabled look, so the keyboard, a phone's own picker and a form behave as the
  browser makes them. No other file writes a select field, and a test says so.
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
- Each branch, commit and view of the console has its own path, as do the selected unit, the base
  of a comparison and the record of a history view. Reloads, direct links and back and forward
  keep the page; a branch name keeps its slashes; a commit on no branch gets no branch; the root
  and the earlier query addresses redirect; and a path that names nothing in the history says so.
  The own viewer and an installed host behave alike, and every such address passes the policy.
- The index states for every commit what it changed against its first parent, computed from the
  source of both commits as `harness impact` computes it. A history without any record shows its
  real impact, and the missing verification as a gap beside it.
- Every surface under `/harness` is limited on the server to the hosting application: the report
  list, pages, JSON, screenshots, audio, video, exports and uploads, analytics and agent CPU. The
  application is the repository a checkout was cloned from, known by its remote address or its
  own Git store; worktrees and clones are the same application, two applications from one
  template are not, and what cannot be attributed belongs to none. A foreign report is answered
  like a missing one and cannot be changed; shared stores are left intact.
- A report recorded as running keeps that outcome when it stops updating; its liveness is shown
  beside it, not instead of it.
- An install may change files the host owns when that is asked for. A file that holds other
  content, host-written or edited since an earlier install, stops the install before anything is
  written; `--update` replaces it and `--keep` leaves it. What a replacement displaces is saved in
  the project, `harness.console.json` records the path, reason and the identity of both sides,
  and `harness console restore` puts it back. The change is visible in the host's Git diff, unit
  registry, impact and reasons.
- Every capture shows the build and revision it names, its standing and the verification attempt
  it belongs to; a rejected, inherited or unvalidated capture is never presented as tested at the
  selected commit, in the gallery, the viewer, the audio card or an export.
- A capture is tied to compiled files: evidence may name a declared build, whose identity is
  computed in the snapshot, and a capture from any other build is rejected even when it carries
  the current revision.
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

Stage E repaired both with the assertions as written. The gameplay replay now follows the
gallery instead of preceding it, which is what pushed the gallery down. The picker spec was
being run against the reports server, where no picker exists; it now runs under its own
configuration, which builds the panel and starts the picker preview it was written for.

## Future Enhancements

- An autonomous agent scheduler and a source sandbox that enforce component-scoped access.
- Retrofitting other host apps and non-Node SvelteKit adapters.
- Function-level contracts derived from the TypeScript type checker.

## Delivery status

Stages A to F are implemented. Stage A: unit schemas, the unit generator, the `units`
commands, the source graph and the self-host registry. Stage B: the runtime contract and
adapters, the reference and Rust kernels, `harness impact`, `harness kernel` and the typed
package entries. Stage C: scenario contracts and their coverage rules, the evidence protocol
with media and build-stamp validation, verification of clean snapshots under process isolation,
reasons, frozen budgets with a reviewed ledger, and `harness scenarios`, `explain`, `budget` and
`verify`. Stage D: records, evidence and reasons kept in Git (`harness history attach`,
`reasons`, `status`, `fetch`, `push`, `sync`), the deterministic history index
(`harness history build`), the legacy report import, the opt-in pre-push hook
(`harness hooks`), the two CI workflows and the `@dafuga01/harness/history` package entry.
Stage E: the protected `/harness` console over the history index, with the map, comparison,
history, growth and earlier-report views built on the report gallery, viewer, player and export;
the owner policy and the redirects of the former routes; per-capture provenance; build identity
(`harness verify identity`, `builds` in `harness.verify.json`); the browser capture helper and
the console scenario; the edge runtime entry (`@dafuga01/harness/edge`, `/console`,
`/console-ui`, `/kernel.wasm`); and the SvelteKit installer (`harness console install` and
`restore`). Stage F: exact comparison of any two commits from one stored side per source tree;
each recorded state before and after a change, with the source of both sides; position keys
for every list of the console; a private bucket as the store of an installed console
(`--bucket`, `harness console objects`), measured against the size a Worker script may have;
a build stamp for servers that cannot read their own files (`harness verify stamp`,
`<base>/data/build.json`); `harness console uninstall`; per-file check commands and recorded
tool versions in `harness.verify.json`; dependencies of the self-run installed from the
committed lock file; reasons counted step by step along the history; the reports scenario
beside the console scenario, and evidence from the kernel and package checks; the isolation of
tests from the verification that runs them; a directory and ports of its own for every browser
run, so that two runs at once never share seeded fixtures; and measurements that say when they
are unavailable or partial, with baselines that record a metric nobody could measure instead
of freezing a zero; and a lifecycle for started processes: `harness report stop`, a packed smoke
test that ends its own server, and checks that cannot pass while a descendant runs on. Stage evidence is recorded in the
`agentic-self-hosting` loop.

What stage F does not yet do:

- No commit of Harness has a passing record of its own, and no baseline is established. The
  first real verification of a Harness commit exists and failed: record
  `b141c19fec6c324b9316000b5af7b61b08ae83ec8f0fd94962afd133ccb71e36` of commit
  `1d5f793674f84d014a8d351d4ddb1e013cfbe0fa`. Of its 290 checks 289 passed and
  `test/reports-concurrent-runs.e2e.test.ts` failed; all five scenarios passed, with 63
  screenshots and two audio captures; the snapshot, registry, ledger and reasons gates passed;
  and the budgets gate failed because none of the 539 units had a baseline. The record is kept
  and attached as failed, and nothing relabels it. What it failed on is repaired after that
  commit (a browser run starts no development server), and three gaps it and its history
  exposed are closed after it as well: emitted sizes are frozen for each execution target, a
  clone holds the branches it has only from its remote, and a record with hundreds of failures
  reads as a summary by cause. None of that has a record yet. A baseline can only come from a
  clean record whose other gates passed, signed by a reviewer: that is the integrator's step,
  and it has not been taken.
- Historical milestone, before the first real run: a scratch clone outside the repository held
  the stage F tree as one local commit.
  Its first complete verification, of an earlier tree, ran 263 checks and passed the snapshot,
  registry and ledger gates and the console and boundary scenarios; it failed two tests and two
  scenarios without evidence, all repaired since, and the reasons and budgets gates, for which
  the clone then held neither reasons nor baselines. Two later runs of the repaired tree were
  stopped before they finished, after 78 and 65 checks with none failed, and left no record.
  No staging record passes every gate, and none of them is a record of the source branch.
- Decision points are counted in TypeScript, JavaScript and Svelte only. The Rust kernel and
  three Python scripts of the reports package therefore have no complexity value: their records
  say so, and a baseline for them records complexity as unmeasured. Nothing here parses Rust.
- The dependency count covers the units a unit depends on and the outside modules its read
  files refer to. For the Rust kernel that is its one declared unit dependency, marked partial:
  the crates its `Cargo.toml` declares are not counted. Transitive dependencies are never counted.
- A check that leaves a process running fails, and the process is stopped. Processes are
  followed by their parent links, looked at every 200 ms: one that detaches from a parent which
  exits before the next look is not seen. `harness report stop` ends only a server the report
  store recorded when it started it; servers started before the record existed are not known to it.
- Opt-in screenshot output of three older specs (`TAKE_SCREENSHOT=true`) still goes to fixed
  directories under `/tmp`. They are files a developer asked for, not fixtures any run reads.
- One checkout has one build at a time. A browser run serves a private, checked copy of the
  finished build from every server it starts, the application under test included, and starts
  no development server, so neither a rebuild nor the start of another run reaches its pages:
  a development server keeps what it generates in the checkout and reloads its pages when
  another one starts there, which failed one test of two concurrent runs in the first real
  verification of this stage. A development server started by hand is still reloaded by a
  build in its checkout. Two builds or
  two full checks in one checkout still write the same `dist`, `target` and build directories,
  both exit 0 and nothing reports the conflict. A verification snapshot has its own.
- A bucket-backed console was exercised with Wrangler's local simulation of a bucket and
  workerd. Nothing was deployed, and no real bucket was written.
- The stamp identifies what the build of the host emits. Packages that the deployment tool
  bundles afterwards are not part of it: the console reports the package by name and version.
- An export from a bucket reads one object per media file of the record, which counts against
  the subrequests a Worker may make; a record with more media than that limit cannot be
  exported from a Worker on that plan.
- The scale run added the media of twelve verification records as random bytes of realistic
  size. They are transport load, not captures.
- Stored sides make the index larger: 4.3 MB for the 59 source trees of this repository beside
  4.9 MB of revision detail. They are not yet deduplicated between neighbouring commits.
- Stepping through reasons reads every commit on the first-parent path once: about 10 s for
  the 44 commits of this repository from an empty start. Histories of more than 200 commits
  on that path are judged directly, as before.
- The analytics state of the reports scenario shows the live CPU panel as unavailable, so that
  no sample of the machine that ran it enters the evidence. The panel with values is covered
  by the browser suite with a synthetic sample.
- The benchmark evidence of the kernel build comes from a quick run and carries no comparison
  context: it is recorded and not judged by a budget. The invocation boundary remains the
  measured budget.

Resolved in stage F, listed under earlier stages below as they stood then: aligned base and
head media; the first real run of the console scenario under `harness verify`; a protected
store for a hosted history; build identity on Workers; exact comparison of commits further
apart; `analytics-dashboard.spec.ts:25` and the environment isolation behind it; and
unit-wide reasons for units edited before any record passed.

What stage E does not yet do:

- Compare shows impact, measurements and coverage of two revisions, but not their screenshots or
  audio side by side. Aligned base and head media belong to stage F.
- Historical milestone: at the end of stage E no commit of Harness had been verified, so the
  console had no record of its own to show and the console scenario had not run under
  `harness verify`. Its browser captures were validated against the scenario contract and the
  real build identity in the suite, with a placeholder in place of a verified revision. The
  first real run came in stage F and failed; see there.
- The map was exercised in the suite on a generated registry of 488 units, which describes no
  real source. The repository's own 456 units were inspected by hand on a read-only index.
- A host bundles its history into its server. That suits a small index; a Worker script has a
  size limit, and the installer only warns above 5 MiB. A host with more media has to supply its
  own protected `ConsoleData`, for example over a bucket binding, and none ships yet.
- A server on Workers cannot read its own files, so it reports no build identity. Build
  identity is implemented for servers that can: Harness's own and the fixtures.
- The console document carries its script and style inline. A host with a strict content
  security policy has to allow that for the console route.
- The indexed impact is each commit against its first parent. Two commits further apart are
  compared in the browser from stored unit versions and dependencies, which cannot know about
  unresolved references or changes outside any unit; the view says so. Indexing both trees of
  every commit makes `harness history build` take about two seconds more per commit here.
- Site ownership needs the recording directory to exist still: a report made in a checkout that
  was deleted since belongs to no site and is not shown. The Git-backed history already holds
  the reviewed reports of this repository and does not depend on that.
- The CPU panel attributes agents by their working directory. The Codex and Harness totals
  remain totals of the machine and are labelled as such.
- `--update` and `--keep` decide about every conflicting file of an install at once.
- A hosted console shows the earlier reports that were imported into Git. Loop and Jev
  analytics stay in Harness's own server, under `/harness/analytics`.
- The moved report pages took new unit identities with their routes; the former routes keep
  theirs as redirects. No baseline existed for either.
- `analytics-dashboard.spec.ts:25` passes here once its report link expects the new route. Its
  failure in the cancelled self dry-run, and the environment isolation behind it, are stage F.

What stage D does not yet do:

- Nothing has been attached, imported, synchronised or installed in the Harness repository
  itself. Those are deliberate steps on a clean commit; the acceptance here ran on synthetic
  repositories and a local bare remote.
- Records are still unsigned. A record published from CI was produced by a job that ran the
  code under test; the trusted job validates its integrity, not its honesty.
- The CI workflows have not run on a hosted runner. On one, the machine profile differs from
  run to run, so performance budgets fail there until a stable runner has reviewed baselines.
- The hook is a local aid. `git push --no-verify`, other worktrees that did not opt in, and
  hooks managed by another tool are outside it.
- Lineage validation hashes every file of every record a record inherits from, each time; and
  a record's proven base is indexed twice per verification. Neither is cached.

What stage C left open and still is:

- A benchmark capture written by an arbitrary script declares its own comparison context.
  Harness validates and compares it exactly but cannot prove what the script ran; only
  `harness budget bench` and `harness kernel bench --boundary` derive it from what they send.
- The first verification of a repository, or of a commit with no proven ancestor, needs a
  reason for every unit as added. A unit explained that way and then edited before any record
  passes must be explained unit-wide again.
- Checks inherit the environment of the command that started verification, and verification
  disables analytics recording for every check. Harness's own analytics tests assume it is
  enabled and its output declaration is untested: both belong to the self-host run in stage F.
- A project that declares no build keeps the earlier rule: its captures are tied to a revision
  only, and a stale build relabelled with that revision would not be noticed there.
- Historical milestone: at the end of this stage Harness had not verified one of its own
  commits. Its configuration, boundary scenario and budgets were declared, but no unit had a
  baseline. The first real run came in stage F and failed, so there is still no baseline: one
  can only come from a clean record of a committed revision whose other gates passed.
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
