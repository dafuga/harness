import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { runCli } from '../../src/cli/runCli';

function restoreVariable(name: string, value: string | undefined): void {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

test('Reports an unknown command as a failed exit status', async () => {
	const input = { args: ['no-such-command'], entry: 'dist/cli/index.js' };
	const output = await withTempDir('run-cli-home-', async (home) => {
		const savedArgv = process.argv;
		const savedExitCode = process.exitCode;
		const savedHome = process.env.HOME;
		const savedAgent = process.env.HARNESS_AGENT_ID;
		const savedError = console.error;
		try {
			process.argv = ['node', 'harness', ...input.args];
			process.exitCode = undefined;
			process.env.HOME = home;
			delete process.env.HARNESS_AGENT_ID;
			console.error = () => undefined;
			const resolved = await runCli(input.entry);
			expect(resolved).toBeUndefined();
			expect(process.exitCode).toBe(1);
			return { resolves: true, exitCode: process.exitCode };
		} finally {
			process.argv = savedArgv;
			process.exitCode = savedExitCode;
			console.error = savedError;
			restoreVariable('HOME', savedHome);
			restoreVariable('HARNESS_AGENT_ID', savedAgent);
		}
	});

	recordExampleCases(
		{
			unitId: 'entry.run-cli',
			symbol: 'runCli',
			state: 'reports-an-unknown-command-as-a-failed-exit-status',
			evidence: 'examples-cases',
			file: 'reports-an-unknown-command-as-a-failed-exit-status.json'
		},
		[{ name: 'unknown command resolves and sets exit status 1', input, output }]
	);
});
