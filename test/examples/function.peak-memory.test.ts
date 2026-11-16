import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { peakMemory } from '../../src/cli/program/run-kernel-bench/kernel-benchmark-service/peakMemory';

test('Returns peak resident bytes for a successful command', async () => {
	const input = { command: '/bin/echo', args: ['peak-memory-fixture'], stdin: '', timeoutMs: 5000 };
	const output = await peakMemory(input.command, input.args, input.stdin, input.timeoutMs);
	expect(output).toHaveProperty('bytes');
	if ('bytes' in output) expect(output.bytes).toBeGreaterThan(0);
	recordExampleCases(
		{
			unitId: 'function.peak-memory',
			symbol: 'peakMemory',
			state: 'returns-peak-resident-bytes-for-a-successful-command',
			evidence: 'examples-cases',
			file: 'returns-peak-resident-bytes-for-a-successful-command.json'
		},
		[{ name: 'echo exits successfully and time reports its peak', input, output }]
	);
});
