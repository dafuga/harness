import { test } from 'vitest';
import * as explorerTypes from '../../src/models/explorer-ui/Explorer.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The Explorer model declares types only, so its source module has no runtime values. */
const ownedTypeNames = [
	'ExplorerScope',
	'ExplorerVerdict',
	'ExplorerEntity',
	'ExplorerSupport',
	'ExplorerRelations',
	'ExplorerHistoryRow',
	'ExplorerHistoryDetail'
];

test('Importing the Explorer types returns no runtime value', () => {
	const runtimeExports = Object.keys(explorerTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in explorerTypes);

	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.model.explorer-types',
			symbol: 'Explorer.types',
			state: 'importing-the-explorer-types-returns-no-runtime-value',
			evidence: 'examples-cases',
			file: 'importing-the-explorer-types-returns-no-runtime-value.json'
		},
		[
			{
				name: 'import the model from its source file',
				input: {
					module: 'packages/reports/src/models/explorer-ui/Explorer.types.ts'
				},
				output: { runtimeExports }
			},
			{
				name: 'look up each type the model owns in the loaded module',
				input: { names: ownedTypeNames },
				output: { runtimeValues }
			}
		]
	);
});
