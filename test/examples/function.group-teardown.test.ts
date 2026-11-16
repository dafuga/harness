import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { signalGroup } from '../../src/utils/reports-media/groupTeardown';
import { groupTeardown } from '../../src/utils/reports-media/run-isolated/groupTeardown';

test('Skips group signaling when the child has no pid', () => {
	const child = { pid: undefined } as never;
	const result = signalGroup(child, 'SIGTERM');
	 expect(result).toBeUndefined();
	recordExampleCases(
		{
			unitId: 'function.group-teardown',
			symbol: 'signalGroup',
			state: 'skips-group-signaling-when-the-child-has-no-pid',
			evidence: 'examples-cases',
			file: 'skips-group-signaling-when-the-child-has-no-pid.json'
		},
		[{ name: 'child has no process id', input: { pid: null }, output: null }]
	);
});

test('Returns no processes when descendants have settled', async () => {
	const calls: string[] = [];
	const descendants = {
		survivors: async () => {
			calls.push('survivors');
			return [];
		}
	};
	const result = await groupTeardown(
		{ pid: undefined } as never,
		descendants as never,
		{ settleMs: 0, graceMs: 0 }
	);

	expect(result).toEqual([]);
	expect(calls).toEqual(['survivors']);
	recordExampleCases(
		{
			unitId: 'function.group-teardown',
			symbol: 'groupTeardown',
			state: 'returns-no-processes-when-descendants-have-settled',
			evidence: 'examples-cases',
			file: 'returns-no-processes-when-descendants-have-settled.json'
		},
		[
			{
				name: 'no descendants remain after group cleanup',
				input: { survivors: [] },
				output: { processes: [], survivorChecks: 1 }
			}
		]
	);
});
