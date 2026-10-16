# Proposed per-unit folder structure

This is a future generator proposal, not the current scaffold output. `specification/units/<id>.json` remains the sole canonical unit manifest. Contracts, source ownership, dependencies, scenarios and budgets belong there; do not duplicate them in a second `unit.json`.

`plan.json` describes the design proposal, proposed contract/scenarios and approval state. Until implementation exists, only planning artifacts are created: no empty source, fake tests or active unit registration. New planned identities live in the planning index, separately from the current active/retired registry schema. After a Change request builds the unit, the generator admits the approved contract into the canonical manifest and registers its implementation. Existing active units retain their canonical contract while a proposal is reviewed.

## Shared design and discussion folders

Every unit may have these folders. PNGs are committed through Git LFS; metadata is ordinary Git. Preserve previous versions.

```text
<unit>/
├── plan.json
├── designs/
│   ├── v001/
│   │   ├── design.json
│   │   ├── prompt.md
│   │   └── <state>-<viewport>.png
│   ├── v002/
│   │   ├── design.json
│   │   ├── prompt.md
│   │   └── <state>-<viewport>.png
│   └── approvals/
│       └── <approval-id>.json
└── threads/
    └── <thread-id>/
        ├── thread.json
        └── messages.ndjson
```

`design.json`: generator/model, prompt reference, source base revision, intended state/viewport, image hashes and creation time. It does not contain its own eventual Git commit hash; the history index derives the containing commit. `plan.json`: stable identity, proposed category, title, goal, design version references and lifecycle (draft, review, approved, implemented or superseded).

`thread.json`: stable thread/target identity, original image version/hash, normalized region, pin, viewport/state and source revision. `messages.ndjson`: append-only message identities, content, time, author, Plan/Change, CLI/model and artifact references. Approval records bind exact image hashes, contract revision, reviewer and time.

Pages and visual components enumerate their applicable states and desktop/tablet/mobile viewports. A headless function/service may use a flow diagram or a written behavior proposal; it does not need fabricated visual states. Configuration designs may be written examples. Create only applicable artifacts.

## Page

```text
src/pages/activity/
├── ActivityPage.svelte
├── contract.ts
├── plan.json
├── designs/
│   ├── v001/{design.json,prompt.md,default-desktop.png,
│   │          default-tablet.png,default-mobile.png}
│   ├── v002/{design.json,prompt.md,<state>-<viewport>.png}
│   └── approvals/<approval-id>.json
├── threads/<thread-id>/{thread.json,messages.ndjson}
├── tests/
│   ├── contract.test.ts
│   ├── behavior.e2e.test.ts
│   └── visual.e2e.test.ts
├── fixtures/{default.json,loading.json,empty.json,error.json}
└── benchmarks/{render.bench.ts,profile.json}

src/routes/activity/+page.svelte
specification/units/page.activity.json
specification/scenarios/page.activity.<state>.<viewport>.json
```

The route is a thin wrapper. The page's manifest explicitly owns both the route and its page implementation. Shared components have separate manifests and are referenced, not copied. Tests generate fresh screenshots into verification evidence rather than overwriting design images.

## Component

```text
src/components/activity-feed/
├── ActivityFeed.svelte
├── contract.ts
├── plan.json
├── designs/
│   ├── v001/{design.json,prompt.md,<state>-<viewport>.png}
│   ├── v002/{design.json,prompt.md,<state>-<viewport>.png}
│   └── approvals/<approval-id>.json
├── threads/<thread-id>/{thread.json,messages.ndjson}
├── tests/
│   ├── contract.test.ts
│   ├── behavior.test.ts
│   └── visual.e2e.test.ts
├── fixtures/{default.json,loading.json,empty.json,error.json}
└── benchmarks/{render.bench.ts,profile.json}

src/components/activity-row/...
specification/units/component.activity-feed.json
specification/units/component.activity-row.json
specification/scenarios/component.activity-feed.<state>.json
```

Activity row is an ordinary component in its own peer folder. Dependency contracts express containment. There is no separate sub-component category. The component contract and scenarios enumerate applicable props, events, states and consumers.

## Shared function

```text
src/functions/filter-activity/
├── filterActivity.ts
├── contract.ts
├── plan.json
├── designs/
│   ├── v001/{design.json,prompt.md,behavior.md,flow.png}
│   ├── v002/{design.json,prompt.md,behavior.md,flow.png}
│   └── approvals/<approval-id>.json
├── threads/<thread-id>/{thread.json,messages.ndjson}
├── tests/
│   ├── contract.test.ts
│   ├── behavior.test.ts
│   └── consumers.e2e.test.ts
├── fixtures/{inputs.json,expected-results.json}
└── benchmarks/{filter.bench.ts,profile.json}

specification/units/function.filter-activity.json
specification/scenarios/function.filter-activity.consumers.json
```

`flow.png` is optional. Function history compares end-to-end inputs, outputs, assertions and behavior before/after, including affected consumers. Runtime language and adapter are declared in the canonical manifest; this TypeScript example does not prescribe one language for every function.

## Service (Rust native/Wasm example)

```text
src/services/impact/
├── Cargo.toml
├── src/lib.rs
├── contract/{input.schema.json,output.schema.json}
├── adapters/{module.ts,native.ts,wasm.ts,http.ts}
├── plan.json
├── designs/
│   ├── v001/{design.json,prompt.md,behavior.md,flow.png}
│   ├── v002/{design.json,prompt.md,behavior.md,flow.png}
│   └── approvals/<approval-id>.json
├── threads/<thread-id>/{thread.json,messages.ndjson}
├── tests/
│   ├── contract.test.ts
│   ├── parity.test.ts
│   └── behavior.e2e.test.ts
├── fixtures/{inputs.json,expected-results.json}
└── benchmarks/{invoke.bench.ts,profile.json}

specification/units/service.impact.json
specification/scenarios/service.impact.parity.json
```

Only declared execution targets get adapters. HTTP deployment is optional. Rust crates participate in the pinned root Cargo workspace/toolchain. Service scenarios compare end-to-end behavior, response examples, traces and measurements under matching environments. Each independently owned adapter can later become its own unit without overlapping ownership.

## Config

```text
src/configs/explorer/
├── schema.ts
├── defaults.json
├── contract.ts
├── plan.json
├── designs/
│   ├── v001/{design.json,prompt.md,examples.md}
│   ├── v002/{design.json,prompt.md,examples.md}
│   └── approvals/<approval-id>.json
├── threads/<thread-id>/{thread.json,messages.ndjson}
├── tests/{schema.test.ts,consumers.e2e.test.ts}
├── fixtures/{valid.json,invalid.json}
└── benchmarks/{parse.bench.ts,profile.json}

specification/units/config.explorer.json
specification/scenarios/config.explorer.consumers.json
```

Config scenarios cover consumers and invalid inputs. Omit benchmarks when no attributable performance contract exists; measurements then explicitly say unavailable.

## Repository-level records

Keep scenario manifests and workload profiles in the repository specification, accepted size/complexity/performance budgets in the existing budget system, and tested evidence on `harness-evidence` linked by `refs/notes/harness`. Source branch history contains designs, comments and approvals; it does not duplicate test media. Build outputs, binaries, caches, secrets and local CLI sessions are not committed as planning files.

Paths shown here are repository organization. The normal Harness entity view displays contract, size, performance, relationships and history; source paths remain behind Details → Source. Existing sites keep their own repository's information. Implementing this layout requires extending Harness's generators and verification, not manually refactoring current code during this design pass.
