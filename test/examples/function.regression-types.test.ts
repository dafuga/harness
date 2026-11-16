import { test } from 'vitest';
import { regressionPhaseSchema, regressionRecordSchema, regressionViewSchema } from '../../src/core/regressionTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Regression phases and views validate proof history', () => {
	const phases = ['red', 'green', 'capture'].map((phase) => ({
		phase,
		accepted: regressionPhaseSchema.safeParse(phase).success
	}));
	const view = {
		loop: 'loop-example',
		units: ['function.regression-types'],
		red: null,
		gap: 'No red proof has been recorded.'
	};
	const viewResult = regressionViewSchema.safeParse(view);
	const strictResult = regressionViewSchema.safeParse({ ...view, extra: true });
	const recordResult = regressionRecordSchema.safeParse({ schemaVersion: 1, extra: true });

	expect(phases.map(({ accepted }) => accepted)).toEqual([true, true, true]);
	expect(viewResult.success).toBe(true);
	expect(strictResult.success).toBe(false);
	expect(recordResult.success).toBe(false);
	recordExampleCases(
		{
			unitId: 'function.regression-types',
			symbol: 'regressionPhaseSchema, regressionRecordSchema, regressionViewSchema',
			state: 'regression-phases-and-views-validate-proof-history',
			evidence: 'examples-cases',
			file: 'regression-phases-and-views-validate-proof-history.json'
		},
		[
			{
				name: 'all declared regression phases parse',
				input: ['red', 'green', 'capture'],
				output: phases
			},
			{
				name: 'a loop view may show a missing red point and gap',
				input: view,
				output: { accepted: viewResult.success, loop: viewResult.success ? viewResult.data.loop : null }
			},
			{
				name: 'strict history and incomplete records reject undeclared or missing fields',
				input: { viewWithExtraKey: { ...view, extra: true }, incompleteRecord: { schemaVersion: 1, extra: true } },
				output: { viewAccepted: strictResult.success, recordAccepted: recordResult.success }
			}
		]
	);
});
