import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { UnitIndexService } from '../../src/workflows/development-tooling/load-units/unit-index-service/UnitIndexService';

test('Returns an empty registry for an empty source index', () => {
	const index = {
		revision: 'example-revision',
		files: new Map()
	};
	const result = new UnitIndexService().index(index, []);
	expect(result).toEqual({
		manifests: [],
		added: [],
		updated: [],
		moved: [],
		revived: [],
		orphaned: []
	});
	recordExampleCases(
		{
			unitId: 'service.unit-index',
			symbol: 'UnitIndexService.index',
			state: 'returns-an-empty-registry-for-an-empty-source-index',
			evidence: 'examples-cases',
			file: 'returns-an-empty-registry-for-an-empty-source-index.json'
		},
		[
			{
				name: 'empty source and registry produce no changes',
				input: { revision: 'example-revision', files: [] },
				output: result
			}
		]
	);
});
