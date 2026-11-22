import { expect, test, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildProgram } from '../../../src/cli/program';
import { loadCliProgram } from '../../../src/cli/loadCliProgram';
import { measureWorkload } from '../../support/measureWorkload';
import { withTempDir } from '../../support/temporary';

test('jobs CLI records, reports statistics, active jobs and a JSON what-if from any directory', async () => {
	const sdk = await measureWorkload(
		'entry.index',
		'jobs-public-entry',
		() => import('../../../src/index')
	);
	expect(typeof sdk.JobsCommand).toBe('function');
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
			await recordAndRead(run, output);
			await estimateAndRead(run, output, home);
			await allModules(run, output, home);
		} finally {
			spy.mockRestore();
			vi.unstubAllEnvs();
		}
	});
});

async function recordAndRead(
	run: (args: string[]) => Promise<unknown>,
	output: unknown[][]
): Promise<void> {
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
}
async function estimateAndRead(
	run: (args: string[]) => Promise<unknown>,
	output: unknown[][],
	home: string
): Promise<void> {
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
	await run(['active', '--status-dir', home, '--json']);
	expect(JSON.parse(String(output.at(-1)?.[0])).counts.total).toBe(0);
	await run(['stats']);
	expect(output.some((row) => String(row[0]).includes('smell / luna | 1'))).toBe(true);
	await run(['eta', '--what-if', '2', '--type', 'smell', '--model', 'luna', '--slots', 'luna=1']);
	expect(output.some((row) => String(row[0]).includes('Queue ETA: estimated; 2 queued'))).toBe(
		true
	);
}

async function allModules(
	run: (args: string[]) => Promise<unknown>,
	output: unknown[][],
	home: string
): Promise<void> {
	const directory = join(home, 'specification/units');
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, 'active.json'), JSON.stringify({ status: 'active' }));
	writeFileSync(join(directory, 'retired.json'), JSON.stringify({ status: 'retired' }));
	await run([
		'eta',
		'--what-if',
		'all-modules',
		'--project',
		home,
		'--type',
		'smell',
		'--model',
		'luna',
		'--slots',
		'luna=1',
		'--json'
	]);
	expect(JSON.parse(String(output.at(-1)?.[0]))).toMatchObject({
		queued: 1,
		p50Ms: 60000,
		status: 'estimated'
	});
}
