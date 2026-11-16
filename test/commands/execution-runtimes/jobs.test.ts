import { expect, test, vi } from 'vitest';
import { buildProgram } from '../../../src/cli/program';
import { loadCliProgram } from '../../../src/cli/loadCliProgram';
import { withTempDir } from '../../support/temporary';

test('jobs CLI records, reports statistics, active jobs and a JSON what-if from any directory', async () => {
	await withTempDir('harness-jobs-cli-', async (home) => {
		vi.stubEnv('HARNESS_JOBS_HOME', home);
		const output: unknown[][] = [];
		const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
			output.push(args);
		});
		const run = async (args: string[]) =>
			(await loadCliProgram(['jobs', ...args]))
				.exitOverride()
				.parseAsync(['node', 'harness', 'jobs', ...args]);
		try {
			expect((await loadCliProgram([])).helpInformation()).toContain('jobs');
			expect((await loadCliProgram([])).helpInformation()).toBe(buildProgram().helpInformation());
			await run([
				'record',
				'start',
				'--id',
				'fixture',
				'--unit',
				'u',
				'--type',
				'smell',
				'--model',
				'luna',
				'--source',
				'r',
				'--at',
				'2026-01-01T00:00:00Z',
				'--json'
			]);
			await run([
				'record',
				'end',
				'--id',
				'fixture',
				'--source',
				'r',
				'--outcome',
				'pass',
				'--at',
				'2026-01-01T00:01:00Z',
				'--json'
			]);
			await run(['stats', '--json']);
			expect(JSON.parse(String(output.at(-1)?.[0])).groups[0]).toMatchObject({
				count: 1,
				meanMs: 60000
			});
			await run([
				'eta',
				'--what-if',
				'1805',
				'--type',
				'smell',
				'--model',
				'luna',
				'--slots',
				'luna=20',
				'--json'
			]);
			expect(JSON.parse(String(output.at(-1)?.[0]))).toMatchObject({
				queued: 1805,
				p50Ms: 5460000,
				status: 'estimated'
			});
		} finally {
			spy.mockRestore();
			vi.unstubAllEnvs();
		}
	});
});
