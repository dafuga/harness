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

test('Throws TypeError when existing is not an array', () => {
	const index = { revision: 'example-revision', files: new Map() };
	expect(() => new UnitIndexService().index(index, null as never)).toThrow(TypeError);
	recordExampleCases(
		{
			unitId: 'service.unit-index',
			symbol: 'UnitIndexService.index',
			state: 'throws-typeerror-when-existing-is-not-an-array',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-existing-is-not-an-array.json'
		},
		[
			{
				name: 'null existing registry',
				input: { index: { revision: 'example-revision', files: [] }, existing: null },
				error: 'TypeError'
			}
		]
	);
});

test('Throws TypeError when a record has no dependencies array', () => {
	const malformed = { kind: 'model', status: 'active' };
	const index = { revision: 'example-revision', files: new Map() };
	expect(() => new UnitIndexService().index(index, [malformed] as never)).toThrow(TypeError);
	recordExampleCases(
		{
			unitId: 'service.unit-index',
			symbol: 'UnitIndexService.index',
			state: 'throws-typeerror-when-a-record-has-no-dependencies-array',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-a-record-has-no-dependencies-array.json'
		},
		[
			{
				name: 'record missing dependencies',
				input: {
					revision: 'example-revision',
					files: [],
					existing: [{ kind: 'model', status: 'active' }]
				},
				error: 'TypeError'
			}
		]
	);
});

test('Throws TypeError when index has no files Map', () => {
	const index = { revision: 'example-revision' };
	expect(() => new UnitIndexService().index(index as never, [])).toThrow(TypeError);
	recordExampleCases(
		{
			unitId: 'service.unit-index',
			symbol: 'UnitIndexService.index',
			state: 'throws-typeerror-when-index-has-no-files-map',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-index-has-no-files-map.json'
		},
		[
			{
				name: 'index missing files map',
				input: { revision: 'example-revision' },
				error: 'TypeError'
			}
		]
	);
});
