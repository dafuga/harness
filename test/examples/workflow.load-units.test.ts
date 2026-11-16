import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { graphOf } from '../../src/workflows/development-tooling/load-units/loadUnits';
import type { LoadedUnits } from '../../src/workflows/development-tooling/load-units/loadUnits.types';

test('Builds an empty graph from a loaded snapshot', () => {
	const loaded = {
		root: '/workspace/project',
		config: {},
		index: { revision: 'example-revision', files: new Map() },
		stored: [],
		scenarios: [],
		errors: [],
		unformatted: [],
		fresh: { manifests: [], added: [], updated: [], moved: [], revived: [], orphaned: [] },
		repository: {}
	} as unknown as LoadedUnits;
	const graph = graphOf(loaded, []);

	expect(graph).toEqual({ nodes: [], edges: [], uncertain: [] });
	recordExampleCases(
		{
			unitId: 'workflow.load-units',
			symbol: 'graphOf',
			state: 'builds-an-empty-graph-from-a-loaded-snapshot',
			evidence: 'examples-cases',
			file: 'builds-an-empty-graph-from-a-loaded-snapshot.json'
		},
		[
			{
				name: 'empty index and manifest selection produce an empty graph',
				input: { revision: 'example-revision', manifests: [] },
				output: graph
			}
		]
	);
});
