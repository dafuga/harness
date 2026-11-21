import { expect, test, vi } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { measureWorkload } from '../../support/measureWorkload';
import { withTempDir } from '../../support/temporary';
import { buildProgram } from '../../../src/cli/program';
import { loadCliProgram } from '../../../src/cli/loadCliProgram';

test('cheap root help matches the synchronous compatibility command surface', async () => {
	const lazy = await measureWorkload('entry.command-help', 'root-help-metadata', () =>
		loadCliProgram([])
	);
	expect(lazy.helpInformation()).toBe(buildProgram().helpInformation());
});

test('selected command registrations preserve every help surface and alias', async () => {
	const full = buildProgram();
	for (const expected of full.commands) {
		for (const name of [expected.name(), ...expected.aliases()]) {
			const lazy = await measureWorkload('entry.command-loaders', `register-${name}`, () =>
				loadCliProgram([name, '--help'])
			);
			const actual = lazy.commands.find((command) => command.name() === expected.name());
			expect(actual?.helpInformation(), name).toBe(expected.helpInformation());
		}
	}
	const helpLoop = await loadCliProgram(['help', 'loop']);
	expect(helpLoop.commands.find((c) => c.name() === 'loop')?.helpInformation()).toBe(
		full.commands.find((c) => c.name() === 'loop')?.helpInformation()
	);
});

test('Harbor tooling forwards fixed argv without provider or signing credentials', () =>
	withTempDir('harness-harbor-inspect-', async (root) => {
		const entry = join(root, 'harbor tool.cjs');
		const initialExitCode = process.exitCode;
		const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		await writeFile(
			entry,
			`
		console.log(JSON.stringify({
			args: process.argv.slice(2),
			harnessEntry: process.env.HARNESS_CLI_PATH ?? null,
			safe: !process.env.OPENAI_API_KEY && !process.env.HARBOR_PRIVATE_KEY && !process.env.NODE_OPTIONS && !process.env.BUN_OPTIONS
		}));
		if (process.argv[2] === 'doctor' && process.argv.includes('--strict')) process.exitCode = 1;`
		);
		vi.stubEnv('HARNESS_HARBOR_CLI_PATH', entry);
		vi.stubEnv('HARNESS_HARBOR_APP_SDK_PATH', entry);
		vi.stubEnv('HARNESS_HARBOR_NODE_PATH', process.execPath);
		vi.stubEnv('OPENAI_API_KEY', 'synthetic-provider-key');
		vi.stubEnv('HARBOR_PRIVATE_KEY', 'synthetic-harbor-key');
		vi.stubEnv('NODE_OPTIONS', '--require /fixture/not-imported.cjs');
		vi.stubEnv('BUN_OPTIONS', '--preload /fixture/not-imported.ts');
		vi.stubEnv('HARNESS_CLI_PATH', '/fixture/not-used.js');
		try {
			for (const { name, input, expected, sdk } of harborDispatchCases(root)) {
				const args = ['harbor', ...input];
				output.mockClear();
				const cli = await loadCliProgram(args);
				const command = cli.commands.find((item) => item.name() === 'harbor');
				expect(command).toBeDefined();
				command?.exitOverride();
				const operation = command?.commands.find((item) => item.name() === input[0]);
				expect(operation, name).toBeDefined();
				operation?.exitOverride();
				await measureWorkload('command.projects-sessions-harbor-inspection', name, () =>
					cli.parseAsync(args, { from: 'user' })
				);
				expect(output, name + ' must retain JSON').toHaveBeenCalledTimes(1);
				if (name === 'runtime-doctor') expect(process.exitCode).toBe(1);
				expect(JSON.parse(output.mock.lastCall?.[0] as string)).toStrictEqual({
					args: expected,
					harnessEntry: sdk ? resolve(process.argv[1]) : null,
					safe: true
				});
			}
		} finally {
			process.exitCode = initialExitCode;
			vi.unstubAllEnvs();
			output.mockRestore();
		}
	}));

function harborDispatchCases(root: string) {
	const rpc = 'http://127.0.0.1:18900';
	const config = join(root, 'operator config.json');
	const review = [
		'publish',
		root,
		'--commit',
		'a'.repeat(40),
		'--artifact',
		'out/app.harborapp',
		'--profile',
		config
	];
	const approved = [...review, '--approve', 'b'.repeat(64)];
	const scaffold = [
		'scaffold',
		'tool',
		join(root, 'an app'),
		'example-app',
		'Example App',
		'--mobile'
	];
	const check = ['check', root];
	const pack = ['pack', root, join(root, 'my app.harborapp')];
	const stageAndroid = [
		'stage-android',
		join(root, 'game.harborapp'),
		join(root, 'android assets')
	];
	return [
		{ name: 'version', input: ['version'], expected: ['--version'] },
		{
			name: 'chain-info',
			input: ['chain', 'info', '--url', rpc],
			expected: ['chain', 'info', '--json', '--url', rpc]
		},
		{
			name: 'agent-status',
			input: ['agent', 'status', '--config', config],
			expected: ['agent', 'status', '--config', config]
		},
		{
			name: 'service-status',
			input: ['service', 'status'],
			expected: ['service', 'status', '--json']
		},
		{
			name: 'system-service-status',
			input: ['service', 'status', 'nodeos', '--system'],
			expected: ['service', 'status', '--json', 'nodeos', '--system']
		},
		{
			name: 'runtime-doctor',
			input: ['doctor', '--service', 'nodeos', '--config', config, '--strict'],
			expected: ['doctor', '--json', '--service', 'nodeos', '--config', config, '--strict']
		},
		{ name: 'publish-review', input: review, expected: review, sdk: true },
		{ name: 'publish-approved', input: approved, expected: approved, sdk: true },
		{ name: 'templates', input: ['templates'], expected: ['templates'], sdk: true },
		{ name: 'scaffold-mobile', input: scaffold, expected: scaffold, sdk: true },
		{ name: 'check-default', input: ['check'], expected: ['check'], sdk: true },
		{ name: 'check', input: check, expected: check, sdk: true },
		{ name: 'pack', input: pack, expected: pack, sdk: true },
		{ name: 'stage-android', input: stageAndroid, expected: stageAndroid, sdk: true }
	];
}
