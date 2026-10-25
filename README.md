# Harness

Harness is an opinionated CLI for humans and coding agents. It gives projects a Rails-like
structure for TypeScript: small files, focused classes, small functions, generators, specs,
and loop driven development that agents can query before making a change.

Game projects retain app pages and add independent mechanics and executable checkpoint graphs. See [the game engine guide](packages/game/README.md) for authoring, AI preview costs and verification.

## Commands

```bash
bun run dev -- new lib my-lib
bun run dev -- new app my-app
bun run dev -- new game my-game --dimension 3d
bun run dev -- generate model Post title:string body:text --adapter sqlite
bun run dev -- generate mailer Welcome
bun run dev -- generate resource Article
bun run dev -- info scaffolds
bun run dev -- info model
bun run dev -- info model --json
bun run dev -- loop search feature
bun run dev -- loop create checkout-flow --from feature --goal "Customers can check out"
bun run dev -- loop next checkout-flow
bun run dev -- loop evaluate checkout-flow
bun run dev -- audit .
bun run dev -- audit . --coverage
bun run dev -- audit . --profile app
bun run dev -- audit . --profile dapp
bun run dev -- generate unit PriceQuote
bun run dev -- units index --write
bun run dev -- units check
bun run dev -- units show service.analytics
bun run dev -- impact
bun run dev -- kernel parity
bun run dev -- explain list
bun run dev -- verify run
bun run check
```

The Explorer’s APIs catalog lists HTTP endpoints and method exports at the selected project revision. Each page has an APIs tab for source-recorded usage through its components and services. API cards open contracts and consumer links in the same revision. Computed or external requests are not presented as confirmed same-app endpoint dependencies.

## Committed module data

Run validation after committing source. Resource reads in an opted-in project require complete,
committed module metadata; validation and repair remain available when reads are blocked.
Missing screenshots and measurement observations are reported as evidence gaps and do not block reads.
Enable this admission policy with `harness.validation.json` containing `{"schemaVersion":1}`.

```bash
harness validate --write
harness validate --module page.checkout --json
harness validate --type pages --json
harness validate --type component --refresh --json
harness validate --history --all --write --json
harness history sync origin
harness validate --sync origin --write
harness api --branch main get validation
harness api --branch main get used-apis page.checkout
harness api --branch main get relations page.checkout
```

`--module` (or a positional stable ID) selects one module. `--type` accepts a kind or catalog
category. Reports list each missing field, its repair action, whether it is metadata or evidence,
and whether the result was cached and committed. Exit status 1 means metadata is incomplete or
has not been committed. Cached reports are bound to the exact source and review inputs;
`--refresh` rechecks source and evidence. Page API usage, including transitive dependencies,
is committed with the module relationships, so callers need no source-search script.

`--history` checks the selected commit's ancestors; `--history --all` includes source branches and
retained source commits. Facts and gap reports live on `refs/harness/module-data`, with immutable
snapshots and source ancestry. History sync exchanges this ref alongside notes and evidence;
source SHAs are preserved. Missing historical observations stay missing.

Repair current declarations in source and commit them. For historical authoring, use
`harness validate --commit SOURCE_SHA --review review.json --write`. A review names `unit`,
`reason`, and `metadata` containing authored responsibility, contracts, helper examples, config
controls, preview or owned module runtime declarations. Historical batches must also name the
exact `commit` on each review. Reviews bind to that source tree and its owned blob hashes;
they cannot replace dependencies, source ownership, budgets or observations. Set `metadata.preview`
to `null` to withdraw an obsolete optional preview declaration. A review replaces
that module's earlier review, so retain any fields that still apply.

A review may also declare wanted scenario evidence for a scenario covering that module:

```json
{
	"unit": "service.agent-activity",
	"reason": "Require the lifecycle assertions from the existing integration test.",
	"metadata": {},
	"scenarios": [
		{
			"id": "agent-activity",
			"evidence": [
				{
					"id": "lifecycle-assertions",
					"kind": "assertions",
					"states": ["lifecycle"],
					"viewports": [],
					"required": true
				}
			]
		}
	]
}
```

This changes the wanted contract, retaining the scenario's original states and test targets.
It supplies no execution evidence. Unknown scenarios, uncovered modules and invalid state or
viewport references are rejected before a review is committed. Sync preserves every immutable
snapshot while advancing repaired lookup paths; conflicting producer output or concurrent
incompatible reviews is rejected for explicit repair.

## API access from the CLI

`harness api` calls the same HTTP APIs as the app. It works from any directory;
the selected server owns the project data, permissions and agent execution. API reads return active endpoint registry records, including contracts, independently of visual catalog admission.
The default server is the managed local preview at `http://127.0.0.1:5690`.
Use `--url` or `HARNESS_API_URL` for another server. Select hosted projects with
`--project` or `HARNESS_API_PROJECT`; use `--mode hosted` to list hosted projects
on a loopback test server before selecting one.

```bash
harness api resources
harness api get entities --branch main
harness api get units --branch main
harness api get pages
harness api get apis
harness api contracts get page.checkout
harness api contracts get entry.program
harness api get source page.checkout --query path=src/routes/checkout/+page.svelte
harness api get history page.checkout --query page=1
harness api screenshot page.checkout --viewport desktop --state loaded --output checkout.png
harness api agents providers
harness api agents start --input @run.json --request-id 8775318f-d765-4e78-9d40-6cb92e1f6b11
harness api agents events RUN_ID --after 0
harness api agents cancel RUN_ID
```

Hosted requests read their bearer token from `HARNESS_API_TOKEN`, or the
project-specific variable named by `--token-env`. Supply it through the project's
secret environment. Local connections create and reuse an owner-only session
under `~/.codex/harness/api`, scoped to the exact server origin. `harness api
connect` explicitly reconnects after a local server restart. Credentials are
never placed in URLs or printed by connection commands. Reconnecting does not
recover a run owned by the previous server process.

JSON is the default output. `--select revision.commit` selects one JSON field;
`--output file.json` writes a new file. Binary responses require `--output`,
and `--output -` streams their exact bytes. Request bodies accept inline JSON,
`@file.json`, or piped stdin with `--input -`. Repeat `--query name=value` to
preserve multiple query values. Existing files are preserved.

```bash
harness api --url https://harness.example --project PROJECT_ID get entities
harness api get /api/projects
harness api request POST /api/projects --input @project.json
harness api contracts define --input @plan.json
harness api call openThread --input @thread.json
```

A contract definition is a saved plan: `plan.json` contains `category`, `title`,
`goal`, and `contract` with `inputs`, `outputs`, and `errors`. Input/output fields
have `name`, `type`, and optional `description`. Agent input uses the app's run
request, including the exact provider/model and the applicable entity, thread,
mode and approval. Defining a contract creates a plan; implementation and design
approval keep their existing gates. Hosted writes additionally require writer
access and a bound executor. Historical commits remain read-only.

`get entities` reads the app's catalog. `get units` reads every registered kind,
including private backend entries, commands, adapters, policies and workflows;
`get registry` also returns the pinned commit. `contracts get ID` keeps the
catalog's current planning contract when one exists, and reads the registered
contract for backend units outside that catalog. `get contracts` lists all
registered contracts.

Screenshot downloads retrieve recorded verification captures and check their
SHA-256 before saving. `--scenario`, `--state`, `--viewport` and `--side` select
the exact capture; the result retains its revision, timestamp and focused or
inherited provenance. Missing captures require the page's standard capture
scenario. This command does not start a new browser capture or agent run.

`request METHOD /api/path` and `get /api/path` cover every endpoint the server
exposes, including future resources. Named resources are conveniences; the server
can reject unavailable operations. Local-only `activity` and `build` expose the
console's process activity and build identity. Redirects and off-origin request
paths are refused, and mutations are never retried automatically. Save and reuse
the printed request id if an agent start's response is lost.

## Project Families

- `app` scaffolds a SvelteKit-shaped application inspired by Daniel's `app-template`.
- `dapp` audits SvelteKit dApps with Antelope or Harbor smart-contract folders.
- `lib` scaffolds a Bun TypeScript package.

## Local SQLite models and queries

`harness history build --out .cache/history` also writes a rebuildable
`.cache/history/catalog.sqlite`. Its eight tables have explicit models: metadata,
branches, revisions, entity versions, revision membership, dependencies,
verification records and scenarios. Unchanged entity snapshots are stored once.
The query index records the same commits and evidence gaps as the portable JSON;
rebuild it after changes to Git history. It is separate from analytics and user data.

```ts
import { Database } from 'bun:sqlite';
import { CatalogRepository } from '@dafuga01/harness/catalog';

const db = new Database('.cache/history/catalog.sqlite', { readonly: true });
const catalog = new CatalogRepository(db, false);
const models = catalog.entities({ kind: 'model', limit: 100 });
const uses = catalog.dependencies('service.posts');
const usedIn = catalog.consumers('model.post');
const history = catalog.history('model.post');
db.close();
```

Reads default to `main` when present, otherwise the first branch by name. Pass a
full `commit` in the query options or relationship method to select a revision.
`entities` supports `kind`, literal substring `search`, `limit` (1–10,000) and `offset`.
`records` and `scenarios` return their recorded summaries at the selected commit.
Direct SQL joins are available through `catalog.adapter.query(sql, bindings)`.

Other projects can use the same adapter with their own models in Harness 0.1.4.
The generator adds Harness as a runtime dependency and preserves explicit local
package specifiers. For an unreleased checkout, install its packed tarball with
`bun add ./harness.tgz`. Generate a model, apply its SQL migration, and register
the model's definition:

```sh
harness generate model Post title:string published:boolean metadata:json --adapter sqlite
```

```ts
import { Database } from 'bun:sqlite';
import { createSqliteAdapter } from '@dafuga01/harness/sqlite';
import { Post } from './src/models/Post';

const db = new Database('app.sqlite');
const adapter = createSqliteAdapter(db, [Post.definition]);
adapter.assertModels(); // Checks every application table and its declared columns.
const post = await Post.create(adapter, {
	title: 'Local data',
	published: true,
	metadata: { tags: ['sqlite'] }
});
const found = await Post.find(adapter, post.id);
db.close();
```

The driver is injected: Node's `DatabaseSync` from `node:sqlite` works too on
Node 22.13 or later. The adapter binds values, maps camelCase properties to SQL
columns, round trips JSON/booleans, and supports string or numeric primary keys.
`createTables()` creates missing tables from explicit definitions; it does not
migrate existing schemas. Transactions accept synchronous callbacks and support
nested savepoints. Database lifetime and runtime-specific journal settings belong
to the caller. Importing the package does not open a database or start the CLI.

## Harness Rules

- One file should have one reason to change.
- Prefer small functions and tiny classes over broad modules.
- Generate a feature spec before implementation work.
- Keep persistence behind adapters.
- Give agents static, explicit instructions through `harness info`.
- Use inherited `harness loop` templates to drive, evaluate, and trace non-trivial work.
- Use `harness info scaffolds --json` to inspect what each scaffold should contain.
- Use `harness audit --coverage` to inspect which ecosystem adapters covered the project.
- Generated projects use `bun run check` to run format checks, project checks, tests, build, and Harness audit.
- Configure audit and generated lint thresholds with `harness.audit.json`.

## Units and the registry

A unit is one responsibility with a stable identity, owned source and a contract. Manifests
live in `specification/units`, one canonical JSON file per unit, and are checked by
`bun run check` through `harness units check`.

```bash
harness generate unit PriceQuote                 # any scaffold kind, plus its manifest
harness generate unit Billing --kind service --responsibility "Charges an invoice once."
harness generate component StatusBadge           # unchanged Svelte component scaffold
harness units index --write                      # reconcile manifests with source
harness units check                              # fail on invalid, inconsistent or stale manifests
harness units list --kind service
harness units show service.billing               # contract, version hashes, consumers, tests
harness units graph --json                       # files, units, scenarios and uncertain references
harness units retire function.slugify --reason "Inlined into titles"
harness units schema ComponentManifest           # also ScenarioManifest, VerificationRecord
```

- `harness.units.json` names the workspaces, test folders, global files and ignored paths.
- An identity never changes. Moving source keeps it, and recreating retired source at its old
  path revives it. A new unit that reuses a retired name or exposes the same symbols records
  `lineage.predecessors`, so baselines and history cannot be shed by retiring and recreating.
- `runtime.kind` and `runtime.entry` name the default execution target. `runtime.targets` lists
  every applicable target (`module`, `wasm`, `process`, `http`), includes the default, and names
  each runtime once. An alternative implementation in other source is a separate unit linked by
  a declared `contract` dependency.
- Responsibilities and contracts produced by the index are labelled `derived`. Set
  `responsibilityOrigin` or `contract.origin` to `declared` once a person has written them.
- Imports, re-exports, literal dynamic imports, `require`, `new URL(..., import.meta.url)`,
  Svelte scripts and CSS imports become graph edges. Computed or unresolved references are
  reported as uncertain instead of being dropped.
- Manifests cap performance tolerance at 5%. A looser tolerance needs a recorded reviewer
  approval, which is not something a manifest edit can grant.
- `VerificationRecord` carries explicit component versions (manifest, source, contract and
  runtime hashes) and measurement records with method, workload, profile and tested revision,
  or an explicit reason a value is unavailable.

## Impact

`harness impact` reports what a change affects by walking the dependency graph backwards from
every changed file, over both the base and the head revision.

```bash
harness impact                                   # working tree against HEAD
harness impact --base origin/main --head HEAD --json
harness impact --runtime wasm                    # default, module, wasm, process or http
```

- The report lists changed files, direct and indirect units, added and removed units, selected and
  excluded tests, and affected scenarios.
- Edges come from imports and re-exports, declared `process`, `http`, `wasm` and `contract`
  dependencies, unit ownership and scenario contracts.
- A removed file or dropped dependency still reaches its dependents through the base graph. A
  changed test selects itself and the scenarios it proves. A changed manifest reruns the tests of
  the unit it describes.
- A changed file that still exists needs a test or scenario in the head graph; coverage in the
  base graph counts only for a file that was removed.
- Global configuration, unclassified files and source files no test depends on select every test.
  A file with a computed or unresolved reference is selected whenever anything changes. Each
  widening is listed under `uncertain` with its reason.

## Runtimes and the impact kernel

Every execution target implements one contract: a `RuntimeRequest` in, and
`{ ok: true, output }` or `{ ok: false, error: { code, message } }` out.

| Target    | A unit declares                   | Transport                                          |
| --------- | --------------------------------- | -------------------------------------------------- |
| `module`  | a file and a `handler` export     | in-process call                                    |
| `wasm`    | a core Wasm file                  | Harness JSON ABI (`harness_alloc`/`invoke`/`free`) |
| `process` | a command                         | JSON on stdin and stdout, or one line per request  |
| `http`    | the URL of an already served unit | one JSON `POST` per request                        |

Transport failures are returned, not thrown: `runtime-unavailable`, `runtime-failed`,
`runtime-timeout` and `invalid-response`. A request must be portable JSON: finite numbers,
well-formed strings, plain objects and arrays, at most 64 levels deep. Every runtime refuses
anything else as `invalid-json`, whether it arrives as an object or as text. A result that arrives
after `timeoutMs` is rejected as `runtime-timeout`. Process and HTTP targets are stopped at the
deadline; module and Wasm targets run on the calling thread and cannot be interrupted, so a call
that overruns still occupies the thread until it returns. Use a process target when a hard limit
is required. Only declared targets are used. Functions stay plain
functions; declare a `process` or `http` target only for a unit that is deployed that way.
`harness kernel serve` binds to loopback and has no authentication of its own.

The impact kernel has a TypeScript reference (`src/utils/impactKernel.ts`) and a Rust
implementation (`crates/impact-kernel`) built for the native host and for
`wasm32-unknown-unknown` with the toolchain pinned in `rust-toolchain.toml`. The two commands
below select that toolchain through rustup, whatever `cargo` is first on `PATH`; without rustup
or the pinned toolchain they fail and say what is missing.

```bash
bun run build:kernel            # native process and core Wasm into target/kernel
bun run check:kernel            # cargo fmt --check, clippy -D warnings, cargo test
harness kernel parity           # built kernels against the reference
harness kernel bench --write    # measure this machine and record the run
harness kernel default          # the runtime those measurements select
harness kernel serve --port 0   # serve the kernel over loopback HTTP
```

The default runtime is the lowest measured cold end-to-end latency on the representative
workload for the current machine profile; within 5% the simpler runtime wins. Without a
measurement for the profile, the reference module is used and the choice is reported as
unmeasured. Benchmarks time serialization, invocation and parsing on identical workloads, and
report memory only where it can be attributed. Runs are stored per profile in
`specification/measurements/impact-kernel`. A run is calibration: it is labelled
`verified: false`, a run from an uncommitted tree names no tested revision, and neither can
serve as verification evidence or a budget baseline. The package ships the Wasm module; the native binary
is built locally.

## Typed package API

The package exports typed, side-effect-free entry points; none of them starts the CLI.

```ts
import { componentManifestSchema, type VerificationRecord } from '@dafuga01/harness/contracts';
import { UnitRuntimeService, type UnitRuntime } from '@dafuga01/harness/runtime';
```

`@dafuga01/harness/contracts` holds the manifest and record schemas, types and validators.
`@dafuga01/harness/runtime` holds the runtime contract, the four adapters, `UnitRuntimeService`,
`RuntimeServerService` and the reference kernel. The package root re-exports both. Declarations
need `moduleResolution` set to `bundler`, `node16` or `nodenext`.

## Scenarios, verification, reasons and budgets

```bash
harness scenarios list|show <id>|check     # states, viewports, checks and required evidence
harness explain list|add|check             # a reason for every changed function or unit
harness verify run [--commit <rev>]        # verify an exact commit in a clean snapshot
harness verify check [--commit <rev>]      # does a stored record prove this commit?
harness budget status|history|measure      # frozen limits and how they were set
harness budget establish|approve           # a reviewer freezes or changes limits
harness budget bench <unit> --workload <file>
```

**Scenarios.** A contract in `specification/scenarios` names the units it proves, their states,
viewports, checks and evidence. A state is `required`, `missing` or `inapplicable`. A missing
state can occur but is unproven, so the scenario cannot pass; an inapplicable state cannot occur,
and lacking a fixture is not an applicability reason. Screenshots are PNG and must decode to the
viewport size; audio is WAV, must be playable, and carries a transcript and its provenance. A
capture of running software carries a build stamp naming the verified commit. Checks capture
only when `TAKE_SCREENSHOT=1`; `harness verify` always sets it.

**Verification.** `harness verify run` exports the commit with `git archive` into a clean
directory outside every repository, so uncommitted work is never included and nothing a check
writes reaches the source. Impact over the base and head graphs selects the test files and
scenarios. Each check runs in its own process group under a hard limit and is killed with its
children. Affected scenarios are captured afresh for every commit, even when the bytes are
identical; an unaffected scenario keeps the evidence of the commit that last tested it and names
that commit. The gates are snapshot, registry, ledger, tests, scenarios, reasons and budgets.
A record is a statement about the whole commit, so the base only narrows what reruns when a
passing, intact record proves it. Otherwise the nearest proven ancestor is used, or nothing, and
everything since then is checked: `--base`, an empty commit or an unverified parent cannot
leave a change out. The record names the base it used and the one that was asked for.
The record is written whether it passes or fails, to `.cache/harness/verifications`, with its
evidence and logs. `harness verify check` rejects a record for another commit or tree, changed
component versions and tampered evidence. `harness.verify.json` configures setup commands, shared
paths, outputs, runners and time limits. A test file that needs a command of its own, such as another configuration of its runner, is
listed under `checks` with its path and command. `tools` names the tools the checks depend on:
each command runs in the snapshot after setup, the first line it prints is recorded beside the
version of Harness itself, and a tool that reports nothing fails the verification before any
check runs. Harness verifies itself with dependencies installed from the committed lock file
(`bun install --frozen-lockfile` as its first setup command) instead of sharing the checkout's.

The snapshot has to remain the exact commit while checks run and capture. It is compared with
the commit after setup and after every check: a tracked file that changes or disappears fails,
and so does any file that appears outside a declared output, wherever it is and even if a later
check removes it again. `outputs` in `harness.verify.json` names the build output, caches and
reports that may be written (`"dist/"`, `"target/"`); an output that covers a tracked file is
refused, so source cannot be declared away.

**Reasons.** Every changed function, and every added, removed or unindexed unit, needs a reason:
the behaviour change, what was tried to simplify it, and what was tried for performance, each
with an outcome of `improved`, `not-improved` or `not-applicable`. A reason is bound to the
content it explains and goes stale when the code changes again. Verification asks for reasons
from the nearest proven revision; a change made over several commits is explained by the
reasons of each step. That holds for units too: one that was explained when it was added and
changed since is explained by both, as long as every step along the first-parent history is
explained in full. A step without a reason is not covered by the steps around it.

**Budgets.** Source bytes, complexity and dependencies are frozen. Performance may be at most 5%
worse than the baseline for the same workload, execution target and machine profile. A missing
measurement, a missing baseline or a baseline from another profile never passes. A workload
name is only a label: a baseline freezes the unit of measure, the method and a comparison
context (the hash of the complete request, the measured boundary, the protocol and the
sampling), and a measurement is compared only when all of them are identical. Any difference is
`incompatible`, missing metadata is `incomplete`, and a new definition needs a reviewed
approval while the ledger keeps the earlier one. `harness budget bench` derives the context
from the request it sends; other benchmark captures must state a valid one. Limits come
only from a record of a clean commit whose other gates passed; calibration files and failed
records are refused. A reviewer who is not the author establishes or approves them, with a
reason and the values before and after, in the append-only ledger
`specification/budgets/ledger.ndjson`. A unit recreated from retired source inherits the retired
limits, and an identity can be retired but not deleted.

**Emitted sizes.** What a unit is built into is frozen beside its source, once for every
execution target: the ledger holds `artifact-bytes:process` and `artifact-bytes:wasm` as
separate limits, so a Wasm module cannot grow by what a process binary lost. The number is the
size measured from the build of the verified snapshot, with the hash of every artifact; several
artifacts declared for one target are one size, their sum, and an artifact that was not built
leaves that size without a value instead of a smaller one. It is judged whenever the unit is,
also when only something it is built from changed. A module emits nothing: its record says so,
and it has no limit and no zero. An output that had a size at its baseline and is no longer
built fails. One that could not be built when the limits were reviewed is written into the
baseline with the reason, and needs a reviewed limit once it is built. A baseline that does not
cover an output at all, because the unit did not emit it then or the ledger line is older than
these limits, is not treated as a limit of zero or of anything: the output fails until
`harness budget approve` records its size, and the approval keeps the limits before and after.
Records written before emitted sizes were judged are not rewritten and keep their outcome.

The console shows the same, read from the history index alone. The index keeps the emitted
size of every target at each measured commit, the limits the ledger of each revision freezes,
and every baseline and approval with the limits before and after at the commit it measured. A
component's panel lists `emitted size (process (native))` and `emitted size (Wasm)` as separate
lines beside its source limits, each with its bytes and its own limit at that revision: `no
limit is recorded at this revision` before any review, the reason when an output was not
built, and one line saying so for a unit that emits nothing. The growth view has a table of
emitted sizes with a column for each target: the size and its change at every commit, the limit
that commit was verified under, the review that set or changed it, the recorded reason, and
the way to the evidence before and after. The comparison lists each target's size on both
sides. Only sizes measured from the build of the snapshot are shown as that series; what a
benchmark reports about its own run stays with the timings.

**A declared freeze is not a limit.** Every manifest declares size and complexity `frozen`;
that is a policy. A limit is a number a reviewer froze. The panel says `frozen at <number>` for
source bytes, complexity and dependencies only where one is known for that revision: the
baseline the record itself judged the value against, or else the limit in the ledger of that
revision, which the index states per unit. Where neither exists, as in the first record of a
repository, the line reads `freeze declared; no reviewed limit is recorded at this revision`.
A later baseline is never shown at an earlier revision, a metric that cannot be measured keeps
`not frozen` with its reason, and a value that exceeded its reviewed limit says what it grew
from and to. Records are not changed by any of this.

**What is and is not measured.** Decision points are counted in TypeScript, JavaScript and
Svelte. Stylesheets, markup without a script and data files have none to count, and their zero
is a count. A unit with code in any other language, such as Rust or Python, has no complete
complexity: `harness budget measure` and every record give no value and the reason when nothing
in the unit is counted, and otherwise the points of its counted files with a `partial` note of
what they leave out. A file Harness does not read has no size either. The dependency count is
scoped the same way: it is the units a unit depends on plus the distinct outside modules its
files refer to, as far as references are read, which is in TypeScript, JavaScript, Svelte and
stylesheets. Code in another language, packages that a manifest such as `Cargo.toml` declares
and references that could not be resolved are not in the number, and the number carries a
`partial` note saying so; when nothing of a unit is read and nothing is known there is no
number, and transitive dependencies are never counted. When a reviewer
establishes a baseline, a frozen metric without a value is written into the ledger as
`unmeasured`, with the reason, instead of a number; later records state it as `unavailable` and
do not judge it, and `harness budget status` lists it. A number that existed at the baseline
cannot become unavailable, and a metric that becomes measurable needs a reviewed limit before
it passes. The console shows such a metric as unavailable and not frozen, with the reason, in
the component panel and in the growth table.

**A check leaves nothing running.** A verification follows the processes each check starts by
their parent links, also when one puts itself in another group or session, as a daemon does.
One that is still running after the check has ended, and after two seconds for it to end by
itself, is stopped, and the check has failed with `left N processes running after it ended`,
whatever its exit code was. Only processes seen while their parent was alive are followed, a
look is taken every 200 ms, and a process is signalled only when its id and start time are the
ones that were seen.

**Browser runs do not share fixtures.** Every run of the reports browser suite seeds a
directory of its own under the system temporary directory and listens on free ports, so two
runs at once, from one checkout or from two verification snapshots, cannot read or remove each
other's history, report store, sites or analytics; the run removes its directory when it ends.
`HARNESS_E2E_ROOT` names a directory instead, which is then kept and whose running servers may
be reused; `HARNESS_CONSOLE_E2E_HOME`, `HARNESS_ANALYTICS_HOME` and the port variables still
place those parts explicitly. A seed script started by hand needs `HARNESS_E2E_ROOT`: there is
no shared default.

**One build at a time per checkout.** A built report server loads its files as they are asked
for, and every build of the reports package replaces them under new names. A server started
from `packages/reports/build` therefore answers a page it has not loaded yet with a server
error as soon as that directory is rebuilt: a refused console page then reads 500 instead of 403. A browser run does not serve that directory. It copies the finished build once into
`.cache/reports-e2e/<run>/build`, checks that the copy and the directory still have the
identity the directory had when the copy began, and starts its servers from the copy; a
directory that holds no build, or one that another build is changing at that moment, stops the
run with that reason. The copy is removed with the run. Every server of a run is started from
that copy, the application under test included, and a run starts no development server: one
keeps what it generates in `packages/reports/.svelte-kit`, writes all of it again each time it
starts, and every other development server of the checkout then tells its open pages to load
again, which undoes whatever a test had opened on them. A development server you start
yourself in a checkout is still reloaded by a build there. Builds themselves are not isolated:
`bun run build` and `bun run check` write `dist`, `target` and `packages/reports/build` of the
checkout, two of them at once both exit 0 and leave whatever was written last, and nothing
reports the conflict. Run one build or full check per checkout at a time, and use another
worktree or a verification snapshot for a second: a snapshot is its own directory with its own
build, so `harness verify run` is not affected by anything built elsewhere.

**The boundary gate.** When a change reaches a unit with a performance budget, directly or
through a dependency, that unit's benchmark scenario reruns and the whole invocation boundary is
compared with the frozen baseline: validation, serialization, the adapter and the call. A
slowdown beyond 5% fails even when every correctness test passes. Noise is answered with more
comparable samples, never a wider tolerance. For Harness this is the `invocation-boundary`
scenario on `service.unit-runtime`, measured by `harness kernel bench --boundary`.

Typed contracts for all of this ship in `@dafuga01/harness/verification`, including
`recordCapture` for checks that write evidence.

## History in Git, hooks and CI

```bash
harness history attach [--commit <rev>] [--record <id>]   # store a record and its evidence in Git
harness history reasons [--base <rev>] [--commit <rev>]   # keep a range's reasons in notes
harness history status [--commit <rev>]                   # what Git alone proves about a commit
harness history fetch|push|sync [remote]                  # exchange records; never forced
harness history build --out <dir> [--strict]              # portable, deterministic history index
harness history import-reports --from <store>             # legacy reports, as recorded
harness hooks install|uninstall|status                    # opt-in pre-push gate
```

**Where things live.** A source commit is never changed. Its record, manifest and files are
added to the `harness-evidence` branch of the same repository, under
`records/<commit>/<record>/`; screenshots and audio are Git LFS objects named by the sha256 of
their original bytes. A note on the commit in `refs/notes/harness` holds one JSON line per
record (id, outcome, source commit and tree, evidence commit, path and manifest hash) and one
per reason. `refs/harness/source/<sha>` keeps a tested commit reachable when its branch is
deleted or rewritten. `.cache/harness` is a cache that is rebuilt from these refs.

**What is accepted.** A record is attached only if its seal, its files and its commit and tree
check out; a failed record is attached as failed. Records are only ever added: separate runs of
one commit, writers in one repository or in worktrees that share it, and clones that diverged
are all kept, and `sync` merges and never forces. The sealed record states the outcome, so a
note copied to a rewritten commit, or edited to say `passed`, proves nothing. A record also
counts only together with what it inherits: its base record and the records behind referenced
scenarios must be attached and intact.

**Not source.** Evidence and notes are never verified, impacted or explained as code, and they
start neither the hook nor CI.

**The index.** `harness history build` reads source branches, archived commits, the registry
stored at each revision, notes, manifests and media, and writes `index.json`, one
`revisions/<commit>.json` per commit and `media/<sha256>.<ext>`. The same refs always give the
same bytes, in any clone, without SQLite or R2. A commit without evidence is listed as a gap;
missing or damaged notes, manifests and media are reported and never replaced by current data.
Timings taken on another machine profile, or under another request, unit, method or sampling,
are separate series.

**Platforms.** The Explorer's Platforms section lists Web, iOS, Android and Desktop (Electron).
Each detail page shows the deployment configuration recorded in `harness.platforms.json` at
the selected commit, including runtime, settings, build/package commands, release requirements
and configuration source links. Shells continue to describe UI frames. A missing or invalid
manifest is explicit; settings from a later revision are never shown in its place.

The manifest has `schemaVersion: 1` and a `platforms` array. Each entry has an `id` (`web`,
`ios`, `android` or `desktop`), `runtime`, `summary`, `status` (`configured`, `setup-required`
or `not-configured`), `configuration` rows (`name`, `value`, optional `description`), `commands`
(`name`, `command`), `requirements` strings and repository-relative `sources` paths. Each ID
appears once. Unconfigured targets declare no commands. Commands are displayed as a reference
and never executed by this page. Record public identifiers and credential variable names;
keep credential values in the environment's secret store. Update the declaration alongside
the configuration files it describes. The root manifest documents this repository's actual
targets and explicitly records that Android has not been configured.

**Branches in the index.** A source branch is a local branch or a branch the repository has
from a remote, so a normal clone, which has one local branch, still holds the history of all
of them. A local branch keeps its name and its own tip, always. A branch that exists only as a
remote-tracking ref is listed under its plain name, `main` and not `origin/main`, when every
remote that has it agrees on its tip: the index then reads the same in the clone as where it
was pushed from. A remote tip that differs from the local branch of that name, or from another
remote's, is listed beside it as `<remote>:<branch>`, for example `origin:main`. A colon cannot
occur in the name of a Git branch, so that name can never be a local branch's, not even one
called `origin/main`, and a local branch that is behind is never shown at the remote's tip. A
remote tip equal to the local one adds nothing. The evidence branch, notes, archived source,
tags and a remote's symbolic `HEAD` are never listed as branches, on either side.

**Legacy reports.** `import-reports` only reads the old store. It imports the runs of this
repository with their original dates, outcome and revision: a run that was still running stays
`running`, and one whose revision is not a commit here stays unlinked.

**The hook.** `harness hooks install` adds a pre-push hook for the current worktree. It keeps
an existing hook and runs it first, verifies each pushed branch tip in a clean snapshot when no
passing record proves it, attaches the record and blocks the push if it failed. It is a local
aid: `git push --no-verify` skips it, and other worktrees are unaffected until they opt in.
The same command adds a commit-msg hook that measures a commit message. Each stage is opted
into on its own, so a worktree that asked an earlier Harness for pushes only is never handed a
stage that was offered later; run `harness hooks install` there again to adopt it.

**CI.** `.github/workflows/harness-verify.yml` runs the full check and verifies the exact
commit with read-only access and no secrets. `harness-evidence.yml` runs trusted code from the
default branch, validates the uploaded record as data and publishes it; it never runs the
commit that was verified. A runner whose machine profile has no reviewed baseline fails the
performance gate; CI never establishes or approves one.

## The console, its installer and the edge runtime

```sh
harness console install --host <dir> --policy <module> [--data <index>]   # embed the console in a SvelteKit app
harness console install ... --update | --keep                             # decide about files that hold other content
harness console install ... --bucket <binding> [--prefix <path>]          # read history from a private bucket, bundle nothing
harness console objects --data <index> [--prefix <path>] --json           # what that bucket must hold, as key and file pairs
harness console restore <path> --host <dir>                               # put back what an install replaced
harness console uninstall --host <dir> [--update | --keep]                # remove the console, put back what it replaced
harness verify identity <directory>                                       # identity of a compiled build
harness verify stamp <directory>                                          # write that identity into a build that must carry it
```

**The console.** `/harness` shows the repository's own history as `harness history build`
wrote it: a searchable component map with each unit's contract, owned interface,
dependencies, consumers, execution targets, budgets and scenarios; a base-and-head
comparison with directly changed, indirectly affected, added and removed units, affected
scenarios, reasons and measurements; the recorded verification of a commit with its
screenshots, audio and transcripts; growth and timings per component; and the reports made
before records were kept in Git. A map of hundreds of units is a block rather than a strip:
searching or choosing a unit brings it into view at a readable size, the arrow keys move
between units, and the list beside the map is the text alternative. Nothing is embedded in
the page: the index, a revision's detail and each media file are fetched when looked at.

**Addresses.** Each branch, commit and view has its own path, and so does what is selected
on it:

```text
/harness/branch/<branch>/commit/<sha>/map[/unit/<unit>]
/harness/branch/<branch>/commit/<sha>/compare/<base sha>[/unit/<unit>]
/harness/branch/<branch>/commit/<sha>/history[/record/<record>]
/harness/branch/<branch>/commit/<sha>/growth[/unit/<unit>]
/harness/commit/<sha>/<view>            # a tested commit that no branch reaches any more
```

A branch name keeps its slashes and every part is encoded. Reloading, direct links and the
browser's back and forward buttons stay on the page. `/harness` leads to the newest commit of
the main branch, and the earlier `?view=&commit=&base=&unit=` form redirects to the page it
named. A path whose commit is not in the history, or not on the branch it names, says so and
links back; nothing is shown in its place. All of these addresses pass the same policy as the
data behind them.

**Impact without records.** For every commit the index holds what it changed against its
first parent, computed when the index is built from the source of both commits exactly as
`harness impact` does: directly changed, indirectly affected, added and removed units,
affected scenarios, unresolved references and whether the change put everything in scope.
A commit nobody verified therefore still shows its real impact, next to the statement that
it has no record. Two commits that are not parent and child are compared from the unit
versions and dependencies stored at both, and the view says what that cannot know.

Every capture states what it itself names: the build and revision that produced it, whether
it is fresh, inherited, rejected or from a record that could not be validated, and the
verification attempt it belongs to. A rejected or inherited capture is never shown as tested
at the selected commit, in the gallery, the viewer, the audio card or a portable export.

**Who may see it.** Harness's own server has one owner. It serves only when started with
`HARNESS_OWNER_MODE=loopback`, bound to a loopback address, and only to a peer that connects
from loopback. `Host` and forwarding headers are never authorization, and owner mode is
refused behind an address header. Without owner mode every page, API, data, media and export
request is answered `403`. `harness report serve` and `bun run dev:reports` start it that
way. The former `/`, `/reports/<id>` and `/analytics` routes redirect to `/harness/reports`,
`/harness/reports/<id>` and `/harness/analytics`.

**One site, its own content.** Everything under `/harness` is about the application the
server is hosted for, and that is decided on the server. The site is fixed when the server
starts, from where it was started or from `HARNESS_SITE_ROOT`. A report, an analytics event
or an agent process belongs to it only when its directory is a checkout of the same
repository: the repository it was cloned from, named by its remote address in any spelling,
or its own Git store when it has no remote. Worktrees, renamed checkouts and local, fresh or
shallow clones are the same application; two applications started from one template are not,
because shared history decides nothing. A directory that is missing, is no repository or has
an unclear origin belongs to no site.

The report list, a report page, its JSON, its screenshots, audio, video and exports, and
every upload go through that one check. A report of another application is answered `404`
like one that does not exist, whatever project a query names, and nothing can be added to
it. Analytics count the site's own events only and ignore a `project` parameter; the CPU
panel keeps the machine total and lists only agents working in a checkout of the site. The
shared stores themselves are not changed, and the `harness report` commands still record and
finalize reports for whichever project they are run in.

A report that was recorded as running and then went quiet keeps the outcome that was
recorded. The hub shows it as running and says beside it since when it has had no update.

**Installing it in an application.** The host supplies the policy; Harness adds no login,
session or credential:

```ts
// src/lib/server/harnessPolicy.ts — the host's own rule, on the server only
import type { ConsoleRequest } from '@dafuga01/harness/console';

export function harnessPolicy(event: ConsoleRequest): boolean {
	return (event.locals as App.Locals).user?.role === 'admin';
}
```

`harness console install` then writes one server-only module and four endpoints under
`/harness` (the console document, its data, its media and its exports). Each of them asks
the policy first and answers `403` unless it returns exactly `true`; a policy that throws
denies. The bundled history lives under `$lib/server`, so it is in the server bundle only:
not in `static/`, not in the client bundle and under no public path. The generated code uses
web platform APIs alone and runs on Cloudflare Workers under `adapter-cloudflare`; a static
build of the same project, which drops server routes, is unaffected.

**Changing files the host owns.** An install never loses content silently, and it never
refuses for good. When a file it would write already holds other content, because the host
wrote it or because someone edited it after an earlier install, the install stops before
writing anything and names the files. Run it again with `--update` to replace them or with
`--keep` to leave them as the host's own version. A replaced or removed file is first saved
under `.harness/console/replaced/<sha256>`, and `harness.console.json` records the path, the
reason and the hash of both sides. `harness console restore <path>` puts the saved contents
back and records that as well. The files are ordinary changes of the host project: they are
in its Git diff, its unit registry and impact see them, and they need a reason like any other
change.

**Units on Workers.** `@dafuga01/harness/edge` is the runtime contract for platforms
without a file system or child processes. `HandlerRuntimeAdapter` runs a function in the
same isolate, `WasmModuleRuntimeAdapter` runs a core Wasm module the platform precompiled
(the kernel ships as `@dafuga01/harness/kernel.wasm`), `HttpRuntimeAdapter` calls a unit
served elsewhere and `runtimeFetch` serves one from a fetch handler with the wire contract
of the Node server. Workers do not compile Wasm from bytes at run time, so the module is
handed in. A native process target is not exported there; it stays in
`@dafuga01/harness/runtime` for Bun and Node.

**Build identity.** A capture of running software names the build that served it. Declare
compiled output in `harness.verify.json` (`"builds": [{ "id": "site", "directory":
"build" }]`) and name it in the scenario's evidence (`"build": "site"`): the identity is then
computed in the verification snapshot from the path and content of every compiled file, and a
capture counts only if the server that produced it reported exactly that identity. A server
reports the identity of the files it was started from, read once at start. An old bundle
relabelled with the current revision is rejected.

A server that cannot read its own files, such as a Worker, carries its identity instead. The
installed console module holds an empty stamp slot; after the last build step
`harness verify stamp <directory>` writes the identity of the emitted files into it, and the
slot does not count towards that identity, so `harness verify identity` returns the same value
before and after. The console then answers `<base>/data/build.json`, behind the policy like
everything else, with the stamp, the package name and version, and the host revision its build
was given in `VITE_HARNESS_HOST_REVISION`. The three are separate facts and may differ. For a
SvelteKit host stamp `.svelte-kit`: the Pages directory inside it holds only the client files
and an entry that imports the server output beside it. Files changed after stamping are
reported as carrying the stamp of other files.

**History in a private bucket.** A history bundled into the server counts against the size a
Worker script may have, 3 MiB compressed on the free plan and 10 MiB on a paid one, and the
installer reports the compressed size of what it bundles. Harness's own index of 65 commits is
2.3 MiB compressed before any recorded screenshot; with the media of twelve verification
records it is 64 MiB. `--bucket <binding>` keeps the history out of the host instead: the
generated module opens the bucket bound under that name from the admitted request and bundles
nothing, and the deployed Worker stays near 0.3 MiB compressed. Upload the index directory
with its paths unchanged; `harness console objects --data <index> --prefix <path> --json`
prints the list in the form `wrangler r2 bulk put <bucket> --filename <list>` takes. A binding
has no public address, so the guarded handlers are the only way to the objects. An export reads
one object per media file of the record, which counts against the subrequests a Worker may make.

**Removing the console.** `harness console uninstall --host <dir>` deletes the files an
install wrote and nobody changed, with the directories they leave empty, and puts back what
the install replaced. A generated file the host edited stops it until you choose `--update`,
which removes it after saving and recording its content, or `--keep`. When nothing of the host
was ever changed the record file is removed too; otherwise it stays as the record. Installing
again writes the same files, and installing over an unchanged install changes nothing.

## Jev Clean Code review

Harness can review files against a language-aware rubric inspired by Robert C. Martin's
_Clean Code_. The eleven principles cover names, responsibility, functions, abstraction,
duplication, side effects, errors, comments, boundaries, testability, and asynchronous behavior.
Review is disabled by default; ordinary audits make no API calls.

```bash
# Preview exactly which files would be reviewed, without credentials or API calls.
bun run dev -- audit . --clean-code --dry-run --json
# Supply HARNESS_JEV_API_KEY through your project-owned environment, then review.
bun run dev -- audit . --clean-code --json
# Enforce confident violations after assessing advisory results.
bun run dev -- audit . --clean-code --gate
bun run dev -- info clean-code
```

Use a dedicated project credential. Keys belong in the environment, never in audit
configuration. `cleanCode.apiKeyEnv` can select another project-specific variable. Enabling
review sends selected source and bounded local context to the official TypeSafe API.

Add this optional section to `harness.audit.json` to enable review in normal audits and
existing loop evaluators. Newly generated projects include it with `mode: "off"`.

```json
{
	"cleanCode": {
		"mode": "advisory",
		"model": "jev-1.13.0",
		"minConfidence": 0.85,
		"apiKeyEnv": "HARNESS_JEV_API_KEY",
		"exclude": ["src/legacy/", "**/*.generated.ts"]
	}
}
```

Files are reviewed sequentially, including tests, across JS/TS, Svelte, Python, C/C++, SQL,
and shell regardless of the static audit profile. Git ignored files, artifact directories,
symlinks, sensitive paths, and configured exclusions are omitted. Exclusion patterns accept
exact paths, directory prefixes ending in `/`, and `*`, `**`, and `?`. Coverage reports
selected, excluded, and unsupported paths explicitly.

Each request includes the whole target, up to four direct imports and two matching tests,
local conventions, and static findings. State is limited to 24,000 UTF-8 bytes; oversized
targets are incomplete rather than truncated. Related files over 6,000 bytes are omitted;
conventions are bounded excerpts marked as partial. Reports identify omitted context.

Jev supplies typed choices, confidence, and probabilities. Harness supplies predefined
guidance and, when localization is confident, exact excerpts from 40-line source spans.
Low confidence and insufficient context produce `needs-review`, which does not block the
gate. Confidence is model output, not an established probability of correctness. A clean
result applies only to the selected files and supplied context.

Validated judgments are cached locally under `.cache/harness/clean-code`, keyed by source,
supplied context, rubric, model, and settings. `--refresh` bypasses caching; moving model
aliases bypass it automatically. Input changes during review discard the affected judgments.
JSON includes hashes, model/rubric versions, assessments, coverage, and API token usage.
Cached file usage is historical; report totals count new validated responses in this run.

Exit codes are `0` for non-blocking completion, `1` for static failures or confident semantic
violations in gate mode, and `2` for incomplete requested reviews. `--dry-run` previews
coverage and returns `0` without enforcing findings. Requests have a 10-second timeout,
up to two transient retries, and a 30-second total deadline. Authentication errors are not
retried, and provider response bodies are excluded from error messages.

The normal suite tests integration with synthetic API responses. To run the separate live
naming calibration corpus with a dedicated key, use
`HARNESS_JEV_LIVE_TEST=true bunx vitest run test/clean-code-live.test.ts`.
It records confidence, usage, latency, and expected/actual labels across the supported
languages. This small corpus is an initial probe; live accuracy across the whole rubric
must be established before relying on the gate broadly.

## JEV response checking

Check whether an LLM answer follows a user request, including task fulfillment,
completeness, explicit constraints, and relevance. This assesses supplied text;
it does not independently verify external actions or factual claims.

```bash
harness response-check --request request.txt --response answer.txt --dry-run --json
# Supply a project-owned HARNESS_JEV_API_KEY, then assess the answer.
harness response-check --request request.txt --response answer.txt --json
harness response-check --request request.txt --response answer.txt \
  --context context.txt --criteria criteria.json --gate --json
harness info response-check
```

Request and response are UTF-8 files. Optional context supplies prior conversation
or reference material. Optional criteria are a JSON array, for example:

```json
[{ "id": "two-colors", "description": "Include exactly two colors." }]
```

IDs must be unique and nonempty; descriptions must be nonempty. Custom criteria
supplement the four standard checks. The combined serialized input must fit within
24,000 UTF-8 bytes; oversized inputs are rejected without truncation. An empty
request is invalid; an empty answer deterministically fails task fulfillment.

The command defaults to `jev-1.13.0`, confidence threshold `0.85`, and the
project-owned `HARNESS_JEV_API_KEY`. Override with `--model`, `--min-confidence`,
or `--api-key-env`. Explicit invocation sends input to the official TypeSafe API;
normal audits remain unchanged. Dry runs need no credentials and make no calls.
Judgments are not cached. The existing JEV request deadlines and retry limits apply.

JSON includes each check's verdict, confidence, probabilities and fixed guidance,
aggregate status, rubric/model identity, input hashes and token usage. It omits
raw request, answer and context. JEV supplies typed judgments, not explanations;
fixed guidance is not a model-generated diagnosis. Model confidence is not
calibrated correctness. Caller-defined criterion IDs appear in output, so keep
secrets out of IDs.

Advisory assessments exit `0`, including violations or uncertainty. With `--gate`,
only confident success on **every** check exits `0`; violations and uncertainty
exit `1`. Input, credential, and provider failures exit `2` with `incomplete`.
Dry runs exit `0` after successful validation. Unlike the Clean Code gate,
response-check gates block uncertainty.

Existing loop templates can use this command without changing their schema:

```json
{
	"id": "answer-follows-request",
	"title": "Answer follows the user request",
	"command": "harness response-check --request request.txt --response answer.txt --gate --json",
	"step": "verify"
}
```

Place it in the template's `evaluators` array. Paths resolve relative to the loop's
project root. Keep private prompt files outside version control as appropriate.

Normal tests use synthetic provider responses and prove integration only. Run the
separate live instruction-following corpus with a dedicated Harness key:

```bash
HARNESS_JEV_RESPONSE_LIVE_TEST=true bunx vitest run test/response-check-live.test.ts
```

The corpus records expected/actual verdicts, confidence, model, usage and latency
for compliant answers, omissions, formatting/language constraints, irrelevant
content, custom criteria, prior context, missing references and injection attempts.
Live accuracy remains unverified until this corpus is run; it is an initial probe,
not a broad accuracy guarantee.

## Analytics and media reports

Harness includes the existing Project Reports website and CLI. Run `harness report serve`
for the report gallery and open `/analytics` for loop usage, model attribution, Jev first-try rates, filters and live CPU usage. The installed package includes the
server and portable viewer: serving and finalization do not rebuild source code.
`harness report serve` leaves its server running for you, and the report store records which
process it started on which port. `harness report stop [--port <port>]` ends exactly that
process and waits until it is gone: a process is signalled only when its id and start time are
the recorded ones, never because it listens on a port, so a server of another store, or one
this store did not start, is left alone.
Existing `PROJECT_REPORTS_HOME` manifests and media remain compatible.

Project Reports is maintained in this repository at `packages/reports`, a Bun workspace.
The website, media CLI, tests, exports, and presentation skill live there; the separate
Project Reports checkout is no longer needed for development or installed report commands.
From the Harness repository root:

```sh
bun run report serve
bun run dev:reports
bun run test:reports
bun run check:reports
```

`bun run check` verifies both Harness and reporting. See
[the reporting guide](packages/reports/README.md) for the CLI and configuration.

```sh
harness analytics import --root /Users/danielfugere/projects
harness analytics summary
harness analytics loops --project /path/to/project --json
harness analytics jev --since 2026-10-01 --json
harness analytics models
harness analytics tasks --project /path/to/project --json
harness analytics cpu --json
harness analytics events --loop delivery --json
harness analytics export --project /path/to/project --output analytics.html
harness loop create delivery --from feature --goal 'Ship the feature' --agent-model gpt-6.1-sol
harness response-check --request request.txt --response answer.txt --loop delivery --step implement
harness audit . --clean-code --loop delivery --step implement --agent-model claude-opus-5-5
```

Module task analytics group executions, submissions, accepted reviews, token usage
and API-equivalent cost by model and intelligence. Missing provider usage and
unverified prices remain unknown; saved price provenance distinguishes CLI reports
from standard API estimates and ranges. These are not subscription invoices.

Review a submitted claim with `harness task review TASK --attempt CLAIM_TOKEN
--verdict accepted`, or use `--verdict incomplete --feedback 'Repair needed'`.
An incomplete review commits the submitted work as the next attempt's repair base.
Bounce rate is incomplete reviews divided by all accepted and incomplete reviews;
execution failures count separately. Stale or duplicate reviews are refused.

For standalone checks, use `--task <stable-id>` instead of `--loop`/`--step`.
Revisions keep their task identity; new tasks use new IDs. `--agent-model` overrides
`HARNESS_AGENT_MODEL` and a loop's stored default. Jev's evaluator model is separate.
Optional `--report <run-id>` links assessments to a report. Loop evaluators inherit
their loop, step and author model automatically.

First-try statistics count the first substantive response or clean-code assessment
of each linked task, separately by check type. Uncertainty and violations are
non-passes. Dry runs, incomplete/API failures, cached-only checks, unlinked checks,
and identical repeated inputs/settings are excluded and shown separately. Advisory
exit zero does not imply a semantic pass. Missing models are `unknown`; imports do
not guess historical Jev judgments from free-form evidence.

Analytics are stored locally in `~/.codex/harness/analytics.sqlite`. Set
`HARNESS_ANALYTICS_HOME` to override that directory or `HARNESS_ANALYTICS_DISABLED=1`
to disable recording. Media retention does not delete analytics. Snapshot export is
explicit and contains the selected metadata, including project paths; ordinary
report publication does not expose analytics.

The live CPU section refreshes every five seconds and samples a one-second interval.
It shows whole-machine CPU, disjoint Codex app/Harness/local-agent totals, and safe
agent names and PIDs. Machine percentages cover all logical cores; core percentages
use 100% for one core. Shared Codex app-server CPU cannot be attributed to individual
chats, and remote model inference CPU is not measured. Process arguments are never returned or stored. Live CPU samples are not
automatically saved or published. The CPU API is
localhost-only; unsupported platforms or failed samples show unavailable.

Use the existing report operations under `harness report`: `begin`, `record`,
`import`, `finalize`, `serve`, `publish`, `cleanup`, and `sync-storage`.
Configure project-owned R2 settings through environment variables or an explicit
`PROJECT_REPORTS_CONFIG_FILE`; use `PROJECT_REPORTS_CLOUDFLARE_CONFIG_HOME` for the
report publisher's isolated Wrangler configuration. Never put credentials in the
package. Python with reportlab is needed for PDF export; ZIP uses Python's standard
library. Replay video encoding uses ffmpeg. See `harness info report` and the
reporting workspace README for media and retention details.

Optional `~/.codex/harness/report-settings.json` stores only configuration references:

```json
{
	"configFile": "/absolute/path/to/reports.env",
	"cloudflareConfigHome": "/absolute/path/to/reports-wrangler"
}
```

Explicit environment variables override these references. `HARNESS_REPORTS_SETTINGS_FILE`
selects another settings file. The migration preserves the existing Project Reports
configuration references without copying credentials into Harness or its package.
Git worktrees share their primary checkout's project identity, so copied loop traces
do not inflate usage counts.

## Bug and Regression Loops

- First explain why existing tests missed a reported bug. Identify the responsible standardized test or scenario and the missing inputs, lifecycle, fixture or assertion.
- Strengthen that existing test and its shared coverage in Harness's normal format. If a category is missing, extend reusable standardized coverage; do not add a one-off bug-specific test.
- Prove the strengthened test fails before repairing the product, then prove the same unchanged test passes afterward. New `bug-fix`, `fix`, and `regression-prevention` loops enforce step order, including coverage diagnosis before repair; existing loop records keep their history.
- Use `harness loop create <name> --from bug-fix --goal <text>` for bug repairs: reproduce with a failing test before implementation, then repeat repair and the same unchanged test until it passes.
- Use `--from regression-prevention` for regressions requiring durable prevention: identify the root cause, propose the repair and guard, implement both, and include the guard in normal project verification.
- Prove the guard rejects reintroducing the original failure in an isolated fixture or temporary workspace; restore the repair and prove the guard passes.
- Record failing and passing commands, assertions, and results as step evidence. Keep green/guard/verification steps pending while proof fails; the agent retries repairs and checks. Harness does not launch an AI repair runner or automatically complete steps.
- For affected UI paths, exercise the browser flow and capture fresh screenshots, then inspect the images before recording proof. Report blockers without claiming completion.
- Normal browser flows, including screenshot and video runs, require zero unexpected `console.error` or `pageerror` events. Generated apps use `tests/e2e/support/browserTest.ts`; Harness suites use `test/support/browserTest.ts`. The automatic fixture saves a `browser-errors` JSON attachment when errors occur, and adds nothing on a clean run.
- Deliberate error cases call `browserErrors.expectError({ type: 'console', message: 'exact message', source: 'exact source URL', reason: 'what this test deliberately fails' })` before the action. `source` is optional; each declaration permits exactly one event. Missing, additional and unrelated errors fail. Keep application logging intact and repair unexpected errors with the same unchanged red-green regression.
- Call `browserErrors.watch(context)` before navigating manually created contexts or Electron windows. Tests using Playwright directly outside its test runner can create `browserErrorCollector()`, watch their contexts, and call `finish()` in teardown; failures include the captured diagnostics.

### Experimental Codex gateway

The local gateway is experimental. Its first desktop gate passed in a separately
signed native app copy: Claude streaming, Codex tools, follow-up history and a
same-chat Claude/OpenAI/Claude round trip. See [native picker setup and evidence](specification/features/planned/codex-native-provider-picker.md)
and [the gateway specification](specification/features/planned/codex-claude-gateway.md).
Full monitoring and quota panels remain pending.

It uses the existing Claude Code subscription login with built-in execution tools
disabled. It binds only to `127.0.0.1`, requires an owner-only token file, and makes
no changes to Codex's defaults or provider catalog:

```sh
mkdir -p .cache/codex-gateway
(umask 077; openssl rand -hex 32 > .cache/codex-gateway/token)
bun run dev -- codex serve --token-file .cache/codex-gateway/token
```

The default port is 47831; use `--port` when that port is already occupied. Keep
that file private. Native provider selection currently requires the documented
experimental app copy. Claude Code must already be logged in; the executable defaults to
`~/.local/bin/claude` and can be supplied through `HARNESS_CLAUDE_EXECUTABLE`.
The prototype offers no API billing fallback. Session/retry state is in memory;
cancelled sessions and orphaned continuations fail closed.

### Provider picker local delivery

A local plugin picker is now available for preview and manual installation. It lists
OpenAI/Claude catalogs and durably queues explicit per-session choices. It keeps active
settings unknown without desktop control and does not apply a switch or change defaults.
See [picker setup and verification limits](plugins/claude-picker/README.md).

The separate **Codex Harness Experimental** app now offers Claude Opus 5.5 directly
in its native picker and applies verified provider changes on the next turn. Its
native selection is independent of the plugin's pending queue. OpenAI remains the
launch default. Hosted web search is unavailable for Claude; phone and voice are
unverified. The original vendor app remains unchanged.
