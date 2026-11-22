import { expect, test, vi } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import { loadCliProgram } from '../../../src/cli/loadCliProgram';

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
