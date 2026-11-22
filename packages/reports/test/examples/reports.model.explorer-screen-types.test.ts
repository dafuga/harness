import { test } from 'vitest';
import * as explorerScreenTypes from '../../src/models/explorer-ui/ExplorerScreen.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The ExplorerScreen model declares types only, so its source module has no runtime values. */
const ownedTypeNames = ['ExplorerScreenProps', 'ExplorerScreen'];

test('Importing the explorer screen model returns no runtime value', () => {
	const runtimeExports = Object.keys(explorerScreenTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in explorerScreenTypes);

	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.model.explorer-screen-types',
			symbol: 'ExplorerScreen.types',
			state: 'importing-the-explorer-screen-model-returns-no-runtime-value',
			evidence: 'examples-cases',
			file: 'importing-the-explorer-screen-model-returns-no-runtime-value.json'
		},
		[
			{
				name: 'import the model from its source file',
				input: {
					module: 'packages/reports/src/models/explorer-ui/ExplorerScreen.types.ts'
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
