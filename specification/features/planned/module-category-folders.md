# Feature: Module Category Folders

## Overview

Harness places new modules in responsibility category folders across scaffold kinds.
The explorer shows the same revision-bound categories as headings and multi-select
filters. Categories are project data, not a fixed UI enum. Existing identities,
framework entrypoints and private ownership survive category moves.

## Acceptance Criteria

- Generators support a category for components, helpers, configs, models, services
  and every supported source scaffold; generated imports, exports and tests work.
- Clear name/responsibility matches reuse a category automatically. Ambiguity in a
  categorized project requires an explicit group instead of inventing one.
- Explicit new groups extend the project taxonomy without changing frontend code.
- Audit rejects ungrouped implementations in categorized projects; framework
  entrypoints and explicitly recorded legacy entries remain supported.
- All seven explorer collections show category headings and counts, allow multiple
  category selections combined with existing filters, and reset all selections.
- Category metadata belongs to the selected revision, never the current checkout.
- Shared/private eligibility, canonical code names, IDs and historical links remain.
- Source tabs show the real category-folder implementation files, with no symbols
  or execution-target inventory. Framework entry files retain their real paths.
- Category folder names use taxonomy ids such as `agents-providers`; display titles
  such as Agents & providers do not rename code or invent filesystem paths.
- Standard generator, audit, metadata, catalog and responsive browser coverage
  supplies unchanged red/green proof. Existing full-check blockers remain explicit.

## Future Enhancements

- Semantic category suggestions can become richer without silently moving code.

## Coverage gap

Existing generator checks expect type folders but do not assert category placement
or rewritten generated imports. Catalog checks cover search and eligibility but
not category grouping, combinations, custom categories or revision changes.
Extend these standard checks rather than introduce a separate testing path.
Source-tab coverage checked visibility but missed relocation forwarding entries
and excess symbol/runtime metadata. Shared category fixtures now include actual
group folders plus compatibility entries; standard detail and responsive browser
coverage checks the same file-only presentation across entity kinds.

## Implementation

`harness.groups.json` defines twelve current responsibility categories. Names, titles
and matching terms are project data; adding an explicit `--group` extends that data.
A clear whole-word match can select an existing category. A tie requires `--group`;
Harness does not silently guess from ambiguous names. Projects without a taxonomy
retain their entry layout until the first explicit category adoption.

Implementations now live in category folders for all supported module kinds, with
private code beside its owner. The migration ledger records 1231 moves, including
four documentation moves. Token comparison at the relocation checkpoint confirms
1227 code bodies were retained; subsequent feature edits are reviewed separately.
Thin forwarding entries preserve existing imports, published SDK paths and stable
unit identity. Framework routes and planning artifact filenames remain canonical.
Routes inherit categories from explicit route-folder bindings in the taxonomy.

Every explorer collection shows responsibility headings and counts. The existing
filter dialog supports multiple categories, search and its other filters together.
Historical collections use their selected revision's folders and taxonomy; old
revisions without category data show an explicit Uncategorized section.

## Verification notes

Standard source-architecture checks resolve registered implementation entries while
retaining their dependency, branding, single shared Select and screen assertions.
Existing public entry boundaries remain injectable for storage and process tests.
The frozen input checkpoint includes runner mapping and category configuration
manifest addresses before the separate product repair commit.

The category-folder delivery is `c4447fb640f919fc60ed0c747f7b392f0595a18c`; the main
category implementation is `f6cce71419935bb9e919aadf2c2ff1c5c8b0216b`.
The test-only checkpoint is `312289aa830b70a7050c57bfa276d25049111fb1`.
Red `84b8fbe1949cf798426af2b3a7300d523d8b8f6c337d53354ac044da3898a1ce`
and green `28c918a48d9a27d9f409586a49ab5d713e7d87ed36309b66086fa3c82e6c6992`
share the frozen corpus, command and environment. The 50 root, one catalog and
three responsive browser cases pass on the delivered source. A first green at
f6cce714 is retained; the final pair includes the Desktop compatibility repair.

Reports passes its complete normal check with 621 cases. The full root build,
18 focused CLI/package/history/browser-error integration cases, all workspace
structure audits and registry validation pass. Planning has 50 passing cases,
Collaboration and Relay pass their normal checks, Hub has 477 passing cases and
Remote has 135. Desktop's 859 passing cases include native protocol and Swift
checks; its missed public Git-read seam now passes all four isolation cases.
The preload framework build entry is restored and both native main bundles build.

The required root check has 914 passing cases, one failing ownership guard and
25 skipped live cases. The guard retains inherited entityMeasure/entityShown
fingerprint drift. Baseline comparison reproduces Desktop's snippet/type-depth,
function-card/catalog assertions and Remote's validator lint failure. Hub also
retains a route-controller lint failure; broader Desktop run timeouts remain
unresolved. These checks are not waived or represented as green. Physical-device
installation is blocked by the unresolved Desktop checks.

The selected revision's seven collections contain 315 categorized entries;
shared service membership remains 52 and helper membership remains five. Exact
source observations cover 1186 changed active units. Representative category
lookup, generator, metadata and filter timings are recorded separately; process
RSS includes runner/compiler overhead and is not per-unit allocation or peak.

The frozen local preview uses build
`a512448576c52a76af598e4cf4d43e69d158d40b35258d97cd8aa74743ad34ef`.
Its health endpoint identifies the delivered commit. The portable three-commit
history builds without gaps. Automated captures were inspected at 1440, 834 and
390 pixels. After Daniel reloaded the existing tab, live Codex-browser inspection
passed at 775×988. Services shows 52 classes; two category combinations show 19
and 10, search combines with those filters, and Reset restores 52. Configs shows
13 entries and two selected categories show two. A Used In link opens the correct
class detail in the same branch. Three fresh real-page captures were inspected
after font readiness; captured diagnostics contain no warnings or errors. These
manual observations supplement the automated fixture proof. The fresh Jev advisory
cannot complete without the project's dedicated credential. Full verification
remains pending, and the feature report stays active and unpublished.

The Source presentation follow-up is `f4e2068d356422f1dfc131f1ad29c6df3a47ecc1`.
Test-only `e649ba4b10cf48887648d48924433aa9bcac81ed` records red
`ecb06a25742c44d7b6e70f7938c7eb608691a6f3be904604f58e9ed2e7acc1d6`;
unchanged green is `5600cb94b4c180f27029e4e44eb21a1db427c8e971ee817a493a9b947a8a1011`.
Source shows actual category-folder implementations, retaining recorded paths for
framework entries and older uncategorized revisions. It omits forwarding aliases,
symbols, execution targets and identity/version metadata. Compatibility forwarding
files remain supported entries on disk; this presentation does not rename paths.
The confirmed category slug is `agents-providers`.

On that follow-up, Reports passes all 621 cases and its full normal check. Seven
category/Source browser cases, root audit and registry validation pass. All 42
original Source captures across seven kinds and three viewports decode and were
inspected. Actual AgentActivityService Source was inspected in the Codex browser
at 775×988; fonts are ready and captured diagnostics are empty. The new frozen
preview on port 5735 serves build
`763624832b2cc08dc81f8c1edd6b1223f301814ab7331992b2894b0ed03a2fa1`.
The earlier server remains running. Root verification again has 914 passing cases,
one inherited ownership fingerprint failure and 25 skipped live cases. Previous
workspace/Jev blockers are inherited, not rerun or waived by this UI follow-up.
Exact source observations and whole-page timing/renderer heap are retained outside
Git. Whole-process verification samples are attribution only, not a global peak.

## Review links

The explorer links below select the tested commit. The taxonomy data itself and
infrastructure audit/guidance kinds have no standalone explorer page; their source
links identify those gaps. The external evidence folder contains the full changed
unit and History link table, static observations, original captures and logs.

- [Services and category filters](http://127.0.0.1:5734/harness/branch/dafuga%2Fservice-cards/commit/c4447fb640f919fc60ed0c747f7b392f0595a18c/services)
- [Generator workflow](http://127.0.0.1:5734/harness/branch/dafuga%2Fservice-cards/commit/c4447fb640f919fc60ed0c747f7b392f0595a18c/services/workflow.generate-code) and [History](http://127.0.0.1:5734/harness/branch/dafuga%2Fservice-cards/commit/c4447fb640f919fc60ed0c747f7b392f0595a18c/services/workflow.generate-code/history)
- [Explorer index](http://127.0.0.1:5734/harness/branch/dafuga%2Fservice-cards/commit/c4447fb640f919fc60ed0c747f7b392f0595a18c/components/reports.component.harness-explorer-index) and [History](http://127.0.0.1:5734/harness/branch/dafuga%2Fservice-cards/commit/c4447fb640f919fc60ed0c747f7b392f0595a18c/components/reports.component.harness-explorer-index/history)
- [Filter controls](http://127.0.0.1:5734/harness/branch/dafuga%2Fservice-cards/commit/c4447fb640f919fc60ed0c747f7b392f0595a18c/components/reports.component.harness-explorer-controls) and [History](http://127.0.0.1:5734/harness/branch/dafuga%2Fservice-cards/commit/c4447fb640f919fc60ed0c747f7b392f0595a18c/components/reports.component.harness-explorer-controls/history)
- [Taxonomy data](../../../harness.groups.json), [audit source](../../../src/audit/development-tooling/structure-rules/moduleCategoryFindings.ts) and [authoring guidance](../../../.codex/skills/harness/SKILL.md).
- [Source presentation](http://127.0.0.1:5735/harness/branch/dafuga%2Fservice-cards/commit/f4e2068d356422f1dfc131f1ad29c6df3a47ecc1/components/reports.component.harness-entity-source) and [History](http://127.0.0.1:5735/harness/branch/dafuga%2Fservice-cards/commit/f4e2068d356422f1dfc131f1ad29c6df3a47ecc1/components/reports.component.harness-entity-source/history).
- [Actual AgentActivityService Source](http://127.0.0.1:5735/harness/branch/dafuga%2Fservice-cards/services/service.agent-activity?tab=source).
