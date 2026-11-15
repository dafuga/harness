// @harness-uid u_bogxsnokin
import type { Guide } from './guide';

const unitGuide: Guide = {
	topic: 'unit',
	summary: 'A unit is one responsibility with a stable identity, owned source and a contract.',
	steps: [
		'Generate the unit, or index existing source into the registry.',
		'Replace the derived responsibility and contract with declared ones when they matter.',
		'Declare dependencies that cross a runtime boundary: process, HTTP, Wasm or contract.',
		'Start with harness contracts map <path-or-folder>, search contract metadata, and read harness contracts show <id-or-path> before source.',
		'Read dependency contracts with harness contracts show; units show additionally derives source hashes, graph and test impact.',
		'Run harness units check-contract <id> when writing or changing a contract; review each heuristic finding.',
		'Run harness units guide <id>, write and commit the standard test for NEXT, run harness verify run --priority agent-test --entity <id>, and repeat the guide until DONE.',
		'Re-index after every source change and commit the manifests with the code.'
	],
	rules: [
		'Guide completion covers named unit catalog and dedicated scenario states. Guesses are advisory; declare a justified guess as a unit state to require its proof.',
		'Manifests live in specification/units, one canonical JSON file per unit.',
		'An identity never changes and is never given to different source.',
		'Moving source keeps the identity; recreating retired source revives it with its baseline.',
		'Retire a unit explicitly once its source is gone; the tombstone keeps its history.',
		'runtime.kind and runtime.entry name the default execution target; runtime.targets lists ' +
			'every applicable target, includes the default, and names each runtime kind once.',
		'An alternative implementation in other source is its own unit, linked to the original ' +
			'by a declared contract dependency.',
		'Derived responsibilities and contracts are labelled derived until a person declares them.',
		'A unit recreated from retired source records lineage to the retired identity, so ' +
			'baselines and history carry over.',
		'Manifests cap performance tolerance at 5%; only a recorded reviewer approval changes it.',
		'Derived dependencies come from imports; unresolved or computed imports are uncertain.',
		'Uncertain references are reported and widen test selection until they are declared.',
		'harness generate component stays the Svelte component scaffold; harness generate unit ' +
			'accepts any scaffold kind and also writes the manifest.'
	],
	antiPatterns: [
		'Do not edit an identity to dodge a frozen budget.',
		'Do not delete a manifest by hand; retire the unit.',
		'Do not read the whole repository when the unit contracts answer the question.'
	],
	exampleCommands: [
		'harness generate unit PriceQuote',
		'harness generate unit Billing --kind service --responsibility "Charges an invoice once."',
		'harness units index --write',
		'harness units show service.billing',
		'harness units check-contract component.price-quote',
		'harness units check-contract --all --json',
		'harness units guide component.price-quote',
		'harness verify run --priority agent-test --entity component.price-quote',
		'harness units check',
		'harness units schema ComponentManifest'
	]
};

const contractGuide: Guide = {
	topic: 'contracts',
	summary: 'Read, search, diff and trace stored contracts without indexing or searching source.',
	steps: [
		'Map an id, source file or folder to its owning contracts and recorded neighbours.',
		'List or search contracts, then show the full contract before opening implementation.',
		"Use diff for semantic snapshot changes, log for attributed commit summaries, and last for a unit's latest committed field diff."
	],
	rules: [
		'Reads specification/units JSON recursively; show and search also read stored specification/scenarios state declarations. No source files, executable state catalogs, source index or persistent search cache are read.',
		'Lookup includes active internal contracts; --include-retired also adds tombstones. History includes both active and retired raw stored unit JSON and Git metadata, never source or scenario JSON.',
		'Paths are project-root relative, including missing owned files; use --root from elsewhere. Folder matching respects slash boundaries.',
		'--area matches a source-path segment or dotted id prefix; --folder and --kind combine with it.',
		'Search is a case-sensitive literal substring by default; -i ignores case; --regex uses JavaScript expressions without slash delimiters.',
		'Ranking: identity, title, responsibility, contract fields, dependencies/states, owned names/paths. Ties sort by id; each result has its best matching field and a bounded snippet.',
		'Search defaults to 20 matches and log to 20 matching commits. Diff/show/list are unlimited; map limits root matches and includes one hop by default, with --depth 0 through 10. Last always returns one matching commit.',
		'JSON show/list/search return arrays; map returns matches, dependencies, dependents and unresolved ids. Empty list/search return []; missing show/map targets fail.',
		'Every invocation reloads current contracts and movable refs; only Git-returned immutable blobs are cached within the query. Stored metadata is not a source-freshness verdict; use units check for that.',
		'Diff defaults to HEAD -> working tree, including untracked and ignored unit JSON. A single commit compares its first parent -> commit (empty base for a root). <base>..<head> or two revisions compare commits directly; --since compares revision -> worktree; --staged compares HEAD -> index, excluding unstaged/untracked files. These selectors are exclusive.',
		'History parses raw JSON with nonempty ids, preserving historical unknown fields. Stable uid joins id/file/source renames; unchanged id is the fallback when either snapshot lacks uid. Duplicate ids/uids, invalid JSON, invalid roots/refs, missing HEAD, outside-root folders and unresolved index stages fail. Symlink files are excluded; a symlink worktree unit directory is rejected.',
		'Named metadata collections match by name, including inputs/outputs/errors, operations/initialization/snippets, storage/fields, helper contracts and config controls. Known sets (dependencies, owns source/symbols, scenarios, runtime targets and helper consumers) ignore ordering but preserve duplicate records and relation types. All examples, nested business data and unknown arrays remain ordered; string whitespace remains meaningful.',
		'Formatting-only files have changed bytes but equal decoded JSON after object-key ordering is ignored. Metadata-reorder-only files differ only in known collection order and optional formatting. Counts exclude byte-identical files. Contract and field-kind counts precede diff --limit; field filters count only matching fields.',
		'History folder/area/kind and diff --unit filters match either snapshot, including retired units. Folder also accepts stored-contract paths. --field accepts comma-separated type, description (including responsibility), examples, errors (including errorStatus), dependencies. Contracts with no selected material fields disappear; ignored-file counts apply contract filters before field filtering.',
		'Log includes reachable authored commits in topological order, with actual first-parent merge deltas. Stable uid follows renames; observed unchanged-id fallback can follow pre-uid changes. Pre-uid renames, reused ids without uid and unrelated branch identity can be ambiguous; output states these limits. --since selects revision-exclusive reachable history through HEAD. Empty log returns no semantic commits; last fails if none match.',
		'Log text is compact by default; last text includes field values. JSON retains full fields; --summary omits values in text and JSON while keeping per-contract added/removed/changed field counts and contract-kind totals. Log truncation means candidate history remains unscanned; raise --limit to continue.'
	],
	antiPatterns: [
		'Do not grep source when contract search answers the question.',
		'Do not treat missing state contracts or unresolved dependency ids as inferred knowledge.'
	],
	exampleCommands: [
		'harness contracts show command.units',
		'harness contracts show src/cli/program/UnitsCommand.ts --json',
		'harness contracts list --area development-tooling --kind command',
		'harness contracts search "RangeError|TypeError" --regex -i --limit 10 --json',
		'harness contracts map src/cli/program --depth 1 --json',
		'harness contracts diff',
		'harness contracts diff HEAD',
		'harness contracts diff HEAD~3..HEAD --summary',
		'harness contracts diff --staged --field type,description --json',
		'harness contracts log command.units --limit 5',
		'harness contracts last command.units'
	]
};

export const unitGuides: Guide[] = [unitGuide, contractGuide];
