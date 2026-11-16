import { test } from 'vitest';
import * as harnessBudgetTypes from '../../src/models/explorer-ui/HarnessBudget.types';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { HarnessReview, HarnessUnitLimits } from '../../src/models/explorer-ui/HarnessBudget.types';

/** The budget model declares types only, so its source module has no runtime values. */
const ownedTypeNames = ['HarnessReview', 'HarnessFrozenLimits', 'HarnessEmittedLimits', 'HarnessUnitLimits'];

/** A made-up approval line of the ledger, typed by the model. */
const sampleReview: HarnessReview = {
	type: 'approval',
	commit: 'abc1234',
	record: 'example-record-1',
	reviewer: 'example-reviewer',
	reason: 'example reason',
	at: '2026-11-16T00:00:00Z',
	before: { lines: 100 },
	after: { lines: 120 },
	unmeasured: { coverage: 'example why' }
};

/** A made-up view of a unit's reviewed limits at one revision, typed by the model. */
const sampleLimits: HarnessUnitLimits = {
	limits: { metrics: { lines: 120 } },
	emitted: { limits: { web: 4096 } }
};

test('Imports the harness budget types with no runtime value', () => {
	const runtimeExports = Object.keys(harnessBudgetTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in harnessBudgetTypes);
	const reviewFields = Object.keys(sampleReview);

	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	expect(reviewFields).toContain('after');
	recordExampleCases(
		{
			unitId: 'reports.model.harness-budget-types',
			symbol: 'HarnessBudget.types',
			state: 'imports-the-harness-budget-types-with-no-runtime-value',
			evidence: 'examples-cases',
			file: 'imports-the-harness-budget-types-with-no-runtime-value.json'
		},
		[
			{
				name: 'import the model from its source file',
				input: {
					module: 'packages/reports/src/models/explorer-ui/HarnessBudget.types.ts'
				},
				output: { runtimeExports }
			},
			{
				name: 'look up each type the model owns in the loaded module',
				input: { names: ownedTypeNames },
				output: { runtimeValues }
			},
			{
				name: 'read the fields of a reviewed ledger line typed by the model',
				input: { review: sampleReview, limits: sampleLimits },
				output: { reviewFields, emittedWeb: sampleLimits.emitted?.limits.web }
			}
		]
	);
});
