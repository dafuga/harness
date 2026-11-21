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

const name = 'harbor-fixture';
const rows = [
	{
		id: 'fixture',
		agent: name,
		status: 'open',
		title: 'private item title',
		updated_at: '2026-01-01T00:00:00Z'
	},
	{
		id: 'sensitive',
		agent: 'private-project',
		status: 'open',
		title: 'private',
		sensitive: true,
		updated_at: '2026-01-01T00:00:00Z'
	},
	{
		id: 'path',
		agent: '/Users/fixture/hidden',
		status: 'open',
		title: 'path',
		updated_at: '2026-01-01T00:00:00Z'
	}
];

test('project list emits the same aggregate states as the canonical tracker reader', async () => {
	const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
	let state = 'ready';
	const fetcher = vi.fn(async (input: string, options: RequestInit) => {
		expect(options).toMatchObject({ method: 'GET', credentials: 'omit', redirect: 'error' });
		expect(input).toMatch(
			/^http:\/\/127\.0\.0\.1:7701\/(items\?status=all&limit=-1|runs\?limit=500|machines)$/
		);
		if (state === 'unavailable') return new Response(null, { status: 503 });
		return Response.json(state === 'ready' && input.includes('/items?') ? rows : []);
	});
	vi.stubGlobal('fetch', fetcher);
	try {
		const expected = {
			ready: {
				schema: 1,
				status: 'ready',
				projects: [
					{
						id: name,
						title: name,
						state: 'quiet',
						counts: { open: 1, in_progress: 0, blocked: 0, done: 0 }
					}
				]
			},
			empty: { schema: 1, status: 'empty', projects: [] },
			unavailable: { schema: 1, status: 'unavailable', projects: [] }
		};
		for (const [status, result] of Object.entries(expected)) {
			state = status;
			const args = ['projects', 'list', '--json'];
			const cli = await loadCliProgram(args);
			expect(cli.commands.some((command) => command.name() === 'projects')).toBe(true);
			await measureWorkload(
				'command.projects-sessions-project-list',
				`project-list-${status}`,
				() => cli.parseAsync(args, { from: 'user' })
			);
			expect(JSON.parse(output.mock.lastCall?.[0] as string)).toStrictEqual(result);
		}
		expect(fetcher).toHaveBeenCalledTimes(9);
	} finally {
		vi.unstubAllGlobals();
		output.mockRestore();
	}
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
			safe: !process.env.OPENAI_API_KEY && !process.env.HARBOR_PRIVATE_KEY && !process.env.NODE_OPTIONS
		}));`
	);
	vi.stubEnv('HARNESS_HARBOR_CLI_PATH', entry);
	vi.stubEnv('HARNESS_HARBOR_NODE_PATH', process.execPath);
	vi.stubEnv('OPENAI_API_KEY', 'synthetic-provider-key');
	vi.stubEnv('HARBOR_PRIVATE_KEY', 'synthetic-harbor-key');
	vi.stubEnv('NODE_OPTIONS', '--require /fixture/not-imported.cjs');
	const rpc = 'http://127.0.0.1:18900';
	const config = join(root, 'operator config.json');
	try {
		const commands = [
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
			}
		];
		for (const { name, input, expected } of commands) {
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
