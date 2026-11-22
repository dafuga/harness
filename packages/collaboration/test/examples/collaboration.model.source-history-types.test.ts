import { test } from 'vitest';
import * as sourceHistoryTypes from '../../src/models/git-source-history/SourceHistory.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The SourceHistory model declares types only, so its source module has no runtime values. */
const ownedTypeNames = [
	'SourceCommitFacts',
	'SourceHistoryCommit',
	'SourceHistoryPageInput',
	'SourceHistoryPage',
	'SourceHistoryAdapter'
];

test('Importing the SourceHistory model returns no runtime value', () => {
	const runtimeExports = Object.keys(sourceHistoryTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in sourceHistoryTypes);

	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'collaboration.model.source-history-types',
			symbol: 'SourceHistory.types',
			state: 'importing-the-sourcehistory-model-returns-no-runtime-value',
			evidence: 'examples-cases',
			file: 'importing-the-sourcehistory-model-returns-no-runtime-value.json'
		},
		[
			{
				name: 'import the model from its source file',
				input: {
					module: 'packages/collaboration/src/models/git-source-history/SourceHistory.types.ts'
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
