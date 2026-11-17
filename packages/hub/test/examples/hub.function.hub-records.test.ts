import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubRecords } from '../../src/utils/development-tooling/hubRecords';
import type { HubSourceContext } from '../../src/utils/development-tooling/hubSource.types';

function contextWith(paths: string[]): HubSourceContext {
	return {
		metadata: new Map(),
		source: {} as HubSourceContext['source'],
		repository: {} as HubSourceContext['repository'],
		commit: 'fixture-commit-0001',
		entries: paths.map((path) => ({ path })) as HubSourceContext['entries'],
		identity: {} as HubSourceContext['identity'],
		cache: {} as HubSourceContext['cache']
	};
}

const nonUnitPaths = ['README.md', 'specification/other/notes.json'];

test('Returns no manifests when no unit entries are listed', async () => {
	const empty = await hubRecords(contextWith([]));
	const nonUnit = await hubRecords(contextWith(nonUnitPaths));

	expect(empty).toEqual([]);
	expect(nonUnit).toEqual([]);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-records',
			symbol: 'hubRecords',
			state: 'returns-no-manifests-when-no-unit-entries-are-listed',
			evidence: 'examples-cases',
			file: 'returns-no-manifests-when-no-unit-entries-are-listed.json'
		},
		[
			{ name: 'no entries are listed', input: { entries: [] }, output: [] },
			{
				name: 'only non-unit paths are listed',
				input: { entries: nonUnitPaths },
				output: []
			}
		]
	);
});
