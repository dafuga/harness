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

- Scenario contracts enumerate states, viewports, tests and evidence requirements, and declare
  missing or inapplicable states with a reason.
- A source change reruns the relevant unit and integration tests and the affected downstream
  scenarios, and excludes unrelated tests. Changed tests and global config invalidate selection.
- Every tested revision produces fresh evidence for affected scenarios even when the bytes match
  earlier output. Unaffected scenarios may reference older evidence marked with its tested revision.
- Screenshots wait for fonts, images, canvas and async state. Ordinary browser suites capture only
  when `TAKE_SCREENSHOT` is set; `harness verify` requests its required captures explicitly.
- Failure evidence stays failure. Audio evidence carries fixture or actual-capture provenance.
- Size and complexity baselines are frozen. Performance tolerates 5% against a matching workload,
  hardware and runtime profile. Missing or incompatible measurements never pass.
- Verification runs tests and unit calls in separate processes, so its time limits are hard
  limits; an in-process deadline only rejects a late result.
- Only measurements inside a verification record of a clean, exact revision can establish or
  satisfy a baseline. Calibration files and measurements without a tested revision are rejected.
- Budget increases, and any change to the 5% tolerance policy, need a recorded reviewer approval.
  New units need an explicitly established baseline. A unit with lineage inherits the frozen
  baseline of its predecessors, and identities present at the base revision must still exist at
  the head revision, so retirement and recreation cannot reset a budget.
- Verification fails when a changed unit or function lacks a reason covering its behavior change
  and its simplification and performance attempts, including attempts that did not improve.
  Removed, retired and recreated units need reasons like any other change.

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

### F. Self-hosting and packaging

- The Harness repository carries its own registry, scenarios, baselines and synthetic fixtures.
- The console end-to-end suite runs against a fixed isolated test history.
- The packed installation ships the console and the Wasm kernel and still serves legacy reports.

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

Stages A and B are implemented. Stage A: unit schemas, the unit generator, the `units` commands,
the source graph and the self-host registry for both workspaces. Stage B: the runtime contract
with module, Wasm, process and HTTP adapters, the TypeScript reference and Rust impact kernel
with native and Wasm builds, `harness impact`, `harness kernel`, the Rust audit adapter and the
typed package entry points. The `VerificationRecord` schema and validator exist, but nothing
produces records yet. Stages C to F are not started. Stage evidence is recorded in the
`agentic-self-hosting` loop.

The one recorded benchmark is calibration from an uncommitted tree: it names no tested revision
and is not verification evidence. On that machine profile the TypeScript reference is the
fastest runtime for warm calls at every workload size and for cold calls at 100 and 1,000 nodes,
so it is the default there. At 10,000 nodes the native process is faster for a cold call (16.7 ms
against 19.7 ms) and slower warm (10.4 ms against 7.3 ms). Consecutive runs on the same machine
differed by roughly 15 to 20 percent. Module memory and HTTP memory are reported as unavailable.

Known gaps in what is delivered:

- Module and Wasm calls cannot be interrupted. Their deadline rejects a late result but the
  thread stays occupied until the call returns; hard limits need a process target.
- The native binary is not shipped in the package, and no CI workflow builds the kernel yet;
  that belongs to stage D.
- The registry still records every pre-existing responsibility and contract as derived, six
  references as uncertain (five runtime path lookups and the module loader), and four plugin
  packaging files as unclassified.
