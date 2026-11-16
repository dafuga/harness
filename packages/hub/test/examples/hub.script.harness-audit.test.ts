import { spawnSync } from 'node:child_process';
import { afterEach, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

vi.mock('node:child_process', () => ({
	spawnSync: vi.fn(() => ({ status: 0 }))
}));

const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

afterEach(() => {
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

test('Runs the app audit through the configured CLI path', async () => {
	vi.stubEnv('HARNESS_CLI_PATH', '/tmp/example-harness-cli.ts');
	await import('../../scripts/harness-audit');
	const calls = vi.mocked(spawnSync).mock.calls;
	const exitCode = exit.mock.calls[0]?.[0] ?? 1;
	expect(calls).toHaveLength(1);
	expect(calls[0]?.[0]).toBe('bun');
	expect(calls[0]?.[1]).toEqual([
		'/tmp/example-harness-cli.ts',
		'audit',
		'.',
		'--profile',
		'app'
	]);
	expect(exitCode).toBe(0);
	recordExampleCases(
		{
			unitId: 'hub.script.harness-audit',
			symbol: 'harness-audit',
			state: 'runs-the-app-audit-through-the-configured-cli-path',
			evidence: 'examples-cases',
			file: 'runs-the-app-audit-through-the-configured-cli-path.json'
		},
		[
			{
				name: 'configured app audit completes',
				input: { cliPath: '/tmp/example-harness-cli.ts' },
				output: {
					command: 'bun',
					args: ['/tmp/example-harness-cli.ts', 'audit', '.', '--profile', 'app'],
					exitCode
				}
			}
		]
	);
});
