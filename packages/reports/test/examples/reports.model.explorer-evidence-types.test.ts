import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

/** The ExplorerEvidence model declares types only, so its source module has no runtime values. */
const ownedTypeNames = [
	'CoverageStanding',
	'ExplorerSlotCoverage',
	'ExplorerStateCoverage',
	'ExplorerScenarioCoverage',
	'ExplorerCapture',
	'ExplorerSide',
	'ExplorerEvidence',
	'ExplorerChange',
	'ExplorerBehaviorRow',
	'ExplorerBehavior',
	'ExplorerArtifactBehavior',
	'ExplorerArtifact',
	'ExplorerArtifactCase',
	'ExplorerArtifactCases'
];

const stateId = 'importing-the-explorerevidence-model-returns-no-runtime-valu';

test('Importing the ExplorerEvidence model returns no runtime value', async () => {
	const loaded = await import('../../src/models/explorer-ui/ExplorerEvidence.types');
	const runtimeExports = Object.keys(loaded);
	const runtimeValues = ownedTypeNames.filter((name) => name in loaded);

	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.model.explorer-evidence-types',
			symbol: 'ExplorerEvidence.types',
			state: stateId,
			evidence: 'examples-cases',
			file: `${stateId}.json`
		},
		[
			{
				name: 'import the model from its source file',
				input: {
					module: 'packages/reports/src/models/explorer-ui/ExplorerEvidence.types.ts'
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
