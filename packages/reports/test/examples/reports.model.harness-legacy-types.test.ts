import { test } from 'vitest';
import * as harnessLegacyTypes from '../../src/models/explorer-ui/HarnessLegacy.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

const ownedTypeNames = ['HarnessLegacyMedia', 'HarnessLegacyReport'];

test('Importing the HarnessLegacy model returns no runtime value', () => {
	const runtimeExports = Object.keys(harnessLegacyTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in harnessLegacyTypes);

	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.model.harness-legacy-types',
			symbol: 'HarnessLegacy.types',
			state: 'importing-the-harnesslegacy-model-returns-no-runtime-value',
			evidence: 'examples-cases',
			file: 'importing-the-harnesslegacy-model-returns-no-runtime-value.json'
		},
		[
			{
				name: 'import the model from its source file',
				input: {
					module: 'packages/reports/src/models/explorer-ui/HarnessLegacy.types.ts'
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
