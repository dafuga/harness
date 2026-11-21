import { expect, test, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { measureWorkload } from '../../support/measureWorkload';
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

test('Harbor inspection forwards fixed argv without provider or signing credentials', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-harbor-inspect-'));
	const entry = join(root, 'harbor tool.cjs');
	const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	await writeFile(
		entry,
		`
		console.log(JSON.stringify({
			args: process.argv.slice(2),
			safe: !process.env.OPENAI_API_KEY && !process.env.HARBOR_PRIVATE_KEY && !process.env.NODE_OPTIONS && !process.env.BUN_OPTIONS
		}));`
	);
	vi.stubEnv('HARNESS_HARBOR_CLI_PATH', entry);
	vi.stubEnv('HARNESS_HARBOR_APP_SDK_PATH', entry);
	vi.stubEnv('HARNESS_HARBOR_NODE_PATH', process.execPath);
	vi.stubEnv('OPENAI_API_KEY', 'synthetic-provider-key');
	vi.stubEnv('HARBOR_PRIVATE_KEY', 'synthetic-harbor-key');
	vi.stubEnv('NODE_OPTIONS', '--require /fixture/not-imported.cjs');
	vi.stubEnv('BUN_OPTIONS', '--preload /fixture/not-imported.ts');
	try {
		for (const { name, input, expected } of harborDispatchCases(root)) {
			const args = ['harbor', ...input];
			const cli = await loadCliProgram(args);
			expect(cli.commands.some((command) => command.name() === 'harbor')).toBe(true);
			await measureWorkload('command.projects-sessions-harbor-inspection', name, () =>
				cli.parseAsync(args, { from: 'user' })
			);
			expect(JSON.parse(output.mock.lastCall?.[0] as string)).toStrictEqual({
				args: expected,
				safe: true
			});
		}
	} finally {
		vi.unstubAllEnvs();
		output.mockRestore();
		await rm(root, { recursive: true, force: true });
	}
});

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
		{ name: 'publish-review', input: review, expected: review },
		{ name: 'publish-approved', input: approved, expected: approved }
	];
}
