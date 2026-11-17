import { test } from 'vitest';
import type { SourceEntry } from 'collaboration';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubMetadataPaths } from '../../src/utils/development-tooling/hub-metadata/hubMetadataPaths';

const UNIT_ID = 'hub.function.hub-metadata-paths';
const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const UNIT_PATH = 'specification/units/hub.function.hub-metadata-paths.json';
const DESIGN_PATH = 'src/functions/hub-metadata-paths/designs/overview.md';
const PLAN_PATH = 'src/functions/hub-metadata-paths/plan.json';
const SERVICE_FLOW_PATH = 'src/services/svc/designs/flow.json';

function entry(type: 'blob' | 'tree', mode: string, path: string): SourceEntry {
	return { type, mode, sha: SHA, path };
}

function meta(state: string) {
	return {
		unitId: UNIT_ID,
		symbol: 'hubMetadataPaths',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Selects unit and design metadata paths in input order', () => {
	const entries = [
		entry('blob', '100644', UNIT_PATH),
		entry('blob', '100755', DESIGN_PATH),
		entry('blob', '100644', PLAN_PATH)
	];
	const paths = hubMetadataPaths(entries);

	expect(paths).toEqual([UNIT_PATH, DESIGN_PATH, PLAN_PATH]);
	recordExampleCases(meta('selects-unit-and-design-metadata-paths-in-input-order'), [
		{
			name: 'unit JSON, executable design Markdown and plan.json are selected',
			input: entries,
			output: paths
		}
	]);
});

test('Skips trees, symlinks and non-text file modes', () => {
	const skippedEntries = [
		entry('tree', '040000', DESIGN_PATH),
		entry('blob', '120000', PLAN_PATH),
		entry('blob', '100664', UNIT_PATH)
	];
	const keptEntries = [entry('blob', '100644', PLAN_PATH)];
	const skipped = hubMetadataPaths(skippedEntries);
	const kept = hubMetadataPaths(keptEntries);

	expect(skipped).toEqual([]);
	expect(kept).toEqual([PLAN_PATH]);
	recordExampleCases(meta('skips-trees-symlinks-and-non-text-file-modes'), [
		{
			name: 'tree, symlink and 100664 mode entries yield no paths',
			input: skippedEntries,
			output: skipped
		},
		{
			name: 'regular 100644 plan.json blob is kept',
			input: keptEntries,
			output: kept
		}
	]);
});

test('Rejects paths outside the metadata patterns', () => {
	const entries = [
		entry('blob', '100644', 'specification/units/nested/x.json'),
		entry('blob', '100644', 'specification/units/unit.md'),
		entry('blob', '100644', 'src/widgets/a/plan.json'),
		entry('blob', '100644', 'src/components/a/b/plan.json'),
		entry('blob', '100644', 'src/components/a/designs/shot.png'),
		entry('blob', '100644', 'src/components/a/plan.json.bak'),
		entry('blob', '100644', SERVICE_FLOW_PATH)
	];
	const paths = hubMetadataPaths(entries);

	expect(paths).toEqual([SERVICE_FLOW_PATH]);
	recordExampleCases(meta('rejects-paths-outside-the-metadata-patterns'), [
		{
			name: 'nested, wrong-root, too-deep and non-metadata files are dropped',
			input: entries,
			output: paths
		}
	]);
});
