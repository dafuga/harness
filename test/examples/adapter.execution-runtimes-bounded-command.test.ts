import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { BoundedCommandAdapter } from '../../src/adapters/execution-runtimes/BoundedCommandAdapter';
import { BoundedCommandFailure } from '../../src/adapters/execution-runtimes/bounded-command-adapter/commandFailure';

const unitId = 'adapter.execution-runtimes-bounded-command';

test('run returns bounded stdout and stderr from a direct command', async () => {
	await withTempDir('bounded-command-examples-', async (directory) => {
		const adapter = new BoundedCommandAdapter();
		const options = { cwd: directory, timeoutMs: 1000, maxBuffer: 1024 };
		const result = await adapter.run(
			process.execPath,
			['-e', "process.stdout.write('ready'); process.stderr.write('note')"],
			options
		);
		const output = {
			code: result.code,
			stdout: result.stdout.toString('utf8'),
			stderr: result.stderr
		};
		expect(output).toEqual({ code: 0, stdout: 'ready', stderr: 'note' });
		recordExampleCases(
			{
				unitId,
				symbol: 'BoundedCommandAdapter.run',
				state: 'run-returns-bounded-stdout-and-stderr-from-a-direct-command',
				evidence: 'examples-cases',
				file: 'run-returns-bounded-stdout-and-stderr-from-a-direct-command.json'
			},
			[
				{
					name: 'direct command returns its separate output streams',
					input: { command: 'node', args: ['-e', 'write ready and note'], options },
					output
				}
			]
		);
	});
}, 20_000);

test('checked rejects a nonzero command with captured output', async () => {
	await withTempDir('bounded-command-examples-', async (directory) => {
		const adapter = new BoundedCommandAdapter();
		const options = { cwd: directory, timeoutMs: 1000, maxBuffer: 1024 };
		let failure: unknown;
		try {
			await adapter.checked(
				process.execPath,
				[
					'-e',
					"process.stdout.write('partial'); process.stderr.write('invalid'); process.exitCode = 2"
				],
				options
			);
		} catch (error) {
			failure = error;
		}
		expect(failure).toBeInstanceOf(BoundedCommandFailure);
		const result = failure as BoundedCommandFailure;
		const output = {
			name: result.name,
			message: result.message,
			stdout: result.stdout.toString('utf8'),
			stderr: result.stderr
		};
		expect(output).toEqual({
			name: 'BoundedCommandFailure',
			message: 'Command failed with exit code 2.',
			stdout: 'partial',
			stderr: 'invalid'
		});
		recordExampleCases(
			{
				unitId,
				symbol: 'BoundedCommandAdapter.checked',
				state: 'checked-rejects-a-nonzero-command-with-captured-output',
				evidence: 'examples-cases',
				file: 'checked-rejects-a-nonzero-command-with-captured-output.json'
			},
			[
				{
					name: 'exit code two preserves the captured output prefix',
					input: { command: 'node', args: ['-e', 'write partial and invalid; exit 2'], options },
					output
				}
			]
		);
	});
}, 20_000);
