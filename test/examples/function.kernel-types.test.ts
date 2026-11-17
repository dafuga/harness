import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { kernelContract } from '../../src/core/execution-runtimes/kernelTypes';

test('Identifies the impact kernel contract version', () => {
	const version = kernelContract;
	expect(version).toBe('impact-kernel/1');
	recordExampleCases(
		{
			unitId: 'function.kernel-types',
			symbol: 'kernelContract',
			state: 'identifies-the-impact-kernel-contract-version',
			evidence: 'examples-cases',
			file: 'identifies-the-impact-kernel-contract-version.json'
		},
		[
			{
				name: 'impact graph consumers select version one',
				input: {},
				output: version
			}
		]
	);
});
