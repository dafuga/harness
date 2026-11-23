import { test } from 'vitest';
import * as planThreadTypes from '../../src/models/planning-collaboration/PlanThread.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The PlanThread model declares types only, so its source module has no runtime values. */
const ownedTypeNames = ['ThreadAnchor', 'ArtifactReference', 'ThreadMessage', 'PlanThread'];

test('Importing the PlanThread model returns no runtime value', () => {
	const runtimeExports = Object.keys(planThreadTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in planThreadTypes);

	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'planning.model.planning-collaboration-plan-thread-types',
			symbol: 'PlanThread.types',
			state: 'importing-the-planthread-model-returns-no-runtime-value',
			evidence: 'examples-cases',
			file: 'importing-the-planthread-model-returns-no-runtime-value.json'
		},
		[
			{
				name: 'import the model from its source file',
				input: {
					module: 'packages/planning/src/models/planning-collaboration/PlanThread.types.ts'
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
