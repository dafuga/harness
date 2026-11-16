import { test } from 'vitest';
import * as planSummaryTypes from '../../src/models/planning-collaboration/PlanSummary.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The PlanSummary model declares types only, so its source module has no runtime values. */
const ownedTypeNames = ['PlanSummary', 'PlanDetail'];

test('Importing the PlanSummary model returns no runtime value', () => {
	const runtimeExports = Object.keys(planSummaryTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in planSummaryTypes);

	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'planning.model.planning-collaboration-plan-summary-types',
			symbol: 'PlanSummary.types',
			state: 'importing-the-plansummary-model-returns-no-runtime-value',
			evidence: 'examples-cases',
			file: 'importing-the-plansummary-model-returns-no-runtime-value.json'
		},
		[
			{
				name: 'import the model from its source file',
				input: {
					module: 'packages/planning/src/models/planning-collaboration/PlanSummary.types.ts'
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
