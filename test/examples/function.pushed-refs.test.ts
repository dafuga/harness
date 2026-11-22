import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { pushedRefs } from '../../src/cli/program/hook-run-service/pushedRefs';

test('Selects unique source tips and skips excluded updates', () => {
	const input = [
		'refs/heads/main 7d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8a9b0 refs/heads/main 9a0b1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3',
		'refs/heads/feature/login-form 3f1c9a7b2d4e8f0a61c5b9d2e7f4a8c01b6d3e52 refs/heads/feature/login-form 0000000000000000000000000000000000000000',
		'refs/heads/main 7d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8a9b0 refs/heads/main 9a0b1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3',
		'refs/heads/harness-evidence 5a9e02c7d413b8f6e1907c2a4d58fb36e0c1a792 refs/heads/harness-evidence 0000000000000000000000000000000000000000',
		'refs/tags/v1.4.0 e41d7a09c3b2f6518d0ea7c4b93f2716d8a05c3e refs/tags/v1.4.0 0000000000000000000000000000000000000000',
		'malformed line'
	].join('\n');
	const output = pushedRefs(input);
	const emptyOutput = pushedRefs('');

	expect(output).toEqual([
		'7d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8a9b0',
		'3f1c9a7b2d4e8f0a61c5b9d2e7f4a8c01b6d3e52'
	]);
	expect(emptyOutput).toEqual([]);
	recordExampleCases(
		{
			unitId: 'function.pushed-refs',
			symbol: 'pushedRefs',
			state: 'selects-unique-source-tips-and-skips-excluded-updates',
			evidence: 'examples-cases',
			file: 'selects-unique-source-tips-and-skips-excluded-updates.json'
		},
		[
			{
				name: 'keeps unique source branch tips and skips deletions, evidence, tags and malformed lines',
				input,
				output
			},
			{
				name: 'empty hook input has no source tips',
				input: '',
				output: emptyOutput
			}
		]
	);
});
