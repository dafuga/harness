import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { budgetEstablish, budgetApprove } from '../../src/cli/program/signBudget';

const unit = 'workflow.sign-budget';
const record = '6e6d8ad8-2914-4f2a-b44c-22f31fb24c8e';
const reason = 'Reviewed passing verification gates before updating limits';

async function rejection(run: () => Promise<unknown>): Promise<Error> {
	try {
		await run();
	} catch (caught) {
		return caught as Error;
	}
	throw new Error('expected the call to reject');
}

test('Rejects an establish without a reviewer', async () => {
	await withTempRepo(async (repository) => {
		const error = await rejection(() =>
			budgetEstablish({
				root: repository.root,
				record,
				reviewer: '   ',
				reason,
				all: false,
				units: [unit]
			})
		);

		expect(error.message).toContain('--reviewer must name the person who reviewed the change.');
		recordExampleCases(
			{
				unitId: 'workflow.sign-budget',
				symbol: 'budgetEstablish',
				state: 'rejects-an-establish-without-a-reviewer',
				evidence: 'examples-cases',
				file: 'rejects-an-establish-without-a-reviewer.json'
			},
			[
				{
					name: 'blank reviewer is refused for a unit selection',
					input: { record, reviewer: '   ', reason, all: false, units: [unit] },
					error: { name: error.name, message: error.message }
				}
			]
		);
	});
});

test('Rejects an approval without a reason', async () => {
	await withTempRepo(async (repository) => {
		const error = await rejection(() =>
			budgetApprove({
				root: repository.root,
				record,
				reviewer: 'Morgan Lee',
				reason: '  ',
				all: false,
				units: [unit]
			})
		);

		expect(error.message).toContain('--reason must say why the limits are acceptable.');
		recordExampleCases(
			{
				unitId: 'workflow.sign-budget',
				symbol: 'budgetApprove',
				state: 'rejects-an-approval-without-a-reason',
				evidence: 'examples-cases',
				file: 'rejects-an-approval-without-a-reason.json'
			},
			[
				{
					name: 'blank reason is refused for an approved unit',
					input: { record, reviewer: 'Morgan Lee', reason: '  ', all: false, units: [unit] },
					error: { name: error.name, message: error.message }
				}
			]
		);
	});
});
