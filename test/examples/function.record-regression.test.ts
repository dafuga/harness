import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { requireRegressionProof } from '../../src/workflows/verification-evidence/record-regression/recordRegression';

test('Ignores steps that do not require regression proof', async () => {
	const input = {
		root: '/workspace/project',
		loop: 'regression-issue-428',
		step: 'review'
	};
	await expect(requireRegressionProof(input.root, input.loop, input.step)).resolves.toBeUndefined();
	recordExampleCases(
		{
			unitId: 'function.record-regression',
			symbol: 'requireRegressionProof',
			state: 'ignores-steps-that-do-not-require-regression-proof',
			evidence: 'examples-cases',
			file: 'ignores-steps-that-do-not-require-regression-proof.json'
		},
		[
			{
				name: 'review step needs no recorded proof',
				input,
				output: { resolved: true }
			}
		]
	);
});

test('Throws ExpectedCliError when required red proof is missing', async () => {
	await withTempRepo(async ({ root }) => {
		const input = { root, loop: 'regression-issue-428', step: 'red' };
		await expect(requireRegressionProof(root, input.loop, input.step)).rejects.toThrow(
			'Record the committed failing test'
		);
		recordExampleCases(
			{
				unitId: 'function.record-regression',
				symbol: 'requireRegressionProof',
				state: 'throws-expectedclierror-when-required-red-proof-is-missing',
				evidence: 'examples-cases',
				file: 'throws-expectedclierror-when-required-red-proof-is-missing.json'
			},
			[
				{
					name: 'red step without a recorded red proof',
					input: { loop: input.loop, step: input.step },
					error: 'ExpectedCliError: Record the committed failing test'
				}
			]
		);
	});
});
