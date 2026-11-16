import { test } from 'vitest';
import { pipedOutput } from '../../src/utils/development-tooling/pipedOutput';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Console output is formatted and written to stdout', () => {
	const originalLog = console.log;
	const originalWrite = process.stdout.write;
	const writes: string[] = [];
	process.stdout.write = (chunk: string | Uint8Array) => {
		writes.push(String(chunk));
		return true;
	};
	try {
		pipedOutput();
		console.log('item %d', 7);
		console.log({ ready: true });
		expect(writes).toEqual(['item 7\n', '{ ready: true }\n']);
		recordExampleCases(
			{
				unitId: 'function.piped-output',
				symbol: 'pipedOutput',
				state: 'console-output-is-formatted-and-written-to-stdout',
				evidence: 'examples-cases',
				file: 'console-output-is-formatted-and-written-to-stdout.json'
			},
			[
				{
					name: 'formats a placeholder and appends a newline',
					input: ['item %d', 7],
					output: 'item 7\n'
				},
				{
					name: 'formats an object and appends a newline',
					input: [{ ready: true }],
					output: '{ ready: true }\n'
				}
			]
		);
	} finally {
		console.log = originalLog;
		process.stdout.write = originalWrite;
	}
});
