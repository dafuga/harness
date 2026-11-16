import { test } from 'vitest';
import * as harnessTypes from '../../src/models/explorer-ui/Harness.types';
import * as harnessRevisionTypes from '../../src/models/explorer-ui/HarnessRevision.types';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

test('Importing Harness type models exposes no runtime values', () => {
	const harnessExports = Object.keys(harnessTypes);
	const revisionExports = Object.keys(harnessRevisionTypes);

	expect(harnessExports).toEqual([]);
	expect(revisionExports).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.model.harness-types',
			symbol: 'Harness.types',
			state: 'importing-harness-type-models-exposes-no-runtime-values',
			evidence: 'examples-cases',
			file: 'importing-harness-type-models-exposes-no-runtime-values.json'
		},
		[
			{
				name: 'load the Harness type declarations',
				input: { module: 'Harness.types.ts' },
				output: { runtimeExports: harnessExports }
			},
			{
				name: 'load the Harness revision type declarations',
				input: { module: 'HarnessRevision.types.ts' },
				output: { runtimeExports: revisionExports }
			}
		]
	);
});
