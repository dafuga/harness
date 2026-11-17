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

test('Throws CommandBoundsError when the timeout is invalid', async () => {
	const input = { command: '/bin/echo', args: ['peak-memory-fixture'], stdin: '', timeoutMs: 0 };
	let error: unknown;
	try {
		await peakMemory(input.command, input.args, input.stdin, input.timeoutMs);
	} catch (caught) {
		error = caught;
	}
	expect(error).toMatchObject({ name: 'CommandBoundsError' });
	const detail = error instanceof Error ? { name: error.name, message: error.message } : error;
	recordExampleCases(
		{
			unitId: 'function.peak-memory',
			symbol: 'peakMemory',
			state: 'throws-commandboundserror-when-the-timeout-is-invalid',
			evidence: 'examples-cases',
			file: 'throws-commandboundserror-when-the-timeout-is-invalid.json'
		},
		[{ name: 'invalid timeout is rejected by the bounded command runner', input, error: detail }]
	);
});
