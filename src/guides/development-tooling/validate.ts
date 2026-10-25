import type { Guide } from './guide.types';
export const validateGuide: Guide = {
	topic: 'validate',
	summary: 'Validate and commit complete module data before CLI and app reads.',
	steps: [
		'Commit source and reviewed contracts, then run harness validate --write.',
		'Fix missing metadata. Report missing screenshots and workload observations separately; evidence gaps do not block reads.',
		'Run harness validate again; use --module or --type to narrow its report.',
		'Run harness validate --history --commit main --write to backfill source-derived facts for existing commits.',
		'Sync source evidence with harness history sync origin, then refresh metadata with harness validate --write --sync origin and rebuild prepared history.'
	],
	rules: [
		'harness.validation.json with schemaVersion 1 declares required admission. Normal project resource reads refuse missing, stale or incomplete committed metadata. Validation, indexing and repair tasks remain usable.',
		'Source commits stay immutable. Snapshots and missing-data reports are committed on refs/harness/module-data, retaining source ancestry and all prior snapshot paths.',
		'Module selectors use stable IDs. A singular type selects a manifest kind; plural catalog names select that revision’s public category.',
		'Derived source facts, direct and transitive relationships and explicit empty API lists are stored together. App and CLI readers do not search source to answer usage queries.',
		'The diagnostic cache includes producer version, exact commit/tree and pinned notes/evidence refs. Evidence changes revalidate diagnostics and reuse the source graph. Normal reads accept complete committed metadata for the same source tree while preserving the snapshot’s original evidence provenance.',
		'A backfill never invents authored contracts, screenshot bytes, passing tests, runtime measurements or approved budgets. Unrecoverable historical metadata remains invalid; evidence gaps remain named diagnostics.',
		'Use --review <json-file> --write to commit reviewed responsibility, contracts, helper examples, configuration descriptions, owned module runtime targets or preview bindings for an exact source revision. Ownership, dependencies, evidence and budgets cannot be replaced by a review. Historical review documents must name each exact source commit.',
		'A scoped --write stores the complete revision graph atomically and filters only the returned diagnostics.',
		'Outside agents must commit the wanted module contract through harness task add before pickup and satisfy validation before their changes are admitted.'
	],
	antiPatterns: [
		'Do not edit source commit history to fill metadata.',
		'Do not interpret an empty API result as unknown or a missing measurement as zero.'
	],
	exampleCommands: [
		'harness validate --json',
		'harness validate --module page.orders --json',
		'harness validate --type components',
		'harness validate page.orders --write',
		'harness validate --history --commit main --write --json',
		'harness validate --refresh --write --sync origin',
		'harness api get used-apis page.orders',
		'harness api get relations page.orders',
		'harness api get validation'
	]
};
