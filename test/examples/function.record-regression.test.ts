import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
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
