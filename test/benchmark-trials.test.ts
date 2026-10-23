import { chmod, rm, writeFile, symlink, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { BenchmarkRepository } from '../src/repositories/agents-providers/BenchmarkRepository';
import { runBenchmark } from '../src/cli/program/benchmark-service/runBenchmark';
import { benchmarkMetrics } from '../src/cli/program/benchmark-service/benchmarkMetrics';
import { benchmarkFixture, fakeBenchmarkRunner } from './support/benchmark';
import type { BenchmarkRunner } from '../src/core/agents-providers/subagentBenchmarkTypes';

let fixture: Awaited<ReturnType<typeof benchmarkFixture>>;
beforeEach(async () => {
	vi.stubEnv('HARNESS_ANALYTICS_DISABLED', '1');
	fixture = await benchmarkFixture();
});
afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(fixture.root, { recursive: true, force: true });
});

test('dirty source changes are excluded from pinned trials and remain untouched', async () => {
	await writeFile(join(fixture.root, 'component.ts'), 'export const value = 99;');
	const run = await runWith(async ({ cwd }) => {
		expect(await readFile(join(cwd, 'component.ts'), 'utf8')).toContain('value = 0');
		await writeFile(join(cwd, 'component.ts'), 'export const value = 1;');
		return { session: 'pinned', usage: {} };
	});
	expect(run.trials[0].status).toBe('passed');
	expect(await readFile(join(fixture.root, 'component.ts'), 'utf8')).toContain('value = 99');
});

async function runWith(run: BenchmarkRunner['run'], signal = new AbortController().signal) {
	await writeFile(fixture.path, JSON.stringify(fixture.definition));
	const runner = fakeBenchmarkRunner(run);
	return runBenchmark({
		path: fixture.path,
		runners: { codex: runner, claude: runner },
		repository: new BenchmarkRepository(join(fixture.root, 'results')),
		signal,
		seed: 'fixed'
	});
}
test('first submission fails, same session repairs, persisted comparison distinguishes outcomes', async () => {
	const sessions: (string | undefined)[] = [];
	const run = await runWith(async (input) => {
		sessions.push(input.session);
		if (input.session) {
			expect(input.prompt).toContain('expected one');
			await writeFile(join(input.cwd, 'component.ts'), 'export const value = 1;');
		}
		return { session: 'same-session', usage: { inputTokens: 10, outputTokens: 2 } };
	});
	expect(sessions).toEqual([undefined, 'same-session']);
	expect(run.trials[0]).toMatchObject({
		status: 'passed',
		firstSubmissionPassed: false,
		repairs: 1
	});
	expect(benchmarkMetrics(run)[0]).toMatchObject({
		successes: 1,
		firstSubmissionSuccesses: 0,
		usage: { inputTokens: 20 }
	});
	const stored = await new BenchmarkRepository(join(fixture.root, 'results')).read(run.id);
	expect(stored.trials[0].submissions).toHaveLength(2);
	expect(stored.trials[0].submissions[1].patch).toContain('+export const value = 1;');
});
test('committing a modified acceptance test cannot hide protected edits', async () => {
	const run = await runWith(async ({ cwd }) => {
		await writeFile(join(cwd, 'check.ts'), 'process.exit(0);');
		const { benchmarkGit } =
			await import('../src/cli/program/benchmark-service/benchmarkWorkspace');
		await benchmarkGit(cwd, ['add', '.']);
		await benchmarkGit(cwd, [
			'-c',
			'user.name=Test',
			'-c',
			'user.email=test@example.com',
			'commit',
			'-qm',
			'tamper'
		]);
		return { session: 'tamper', usage: {} };
	});
	expect(run.trials[0].status).toBe('invalid');
	expect(run.trials[0].submissions[0].invalidFiles).toContain('check.ts');
	expect(run.trials[0].submissions[0].checks).toEqual([]);
});
test('symlink substitutions invalidate a trial', async () => {
	const run = await runWith(async ({ cwd }) => {
		await rm(join(cwd, 'component.ts'));
		await symlink(join(fixture.root, 'component.ts'), join(cwd, 'component.ts'));
		return { session: 'symlink', usage: {} };
	});
	expect(run.trials[0].status).toBe('invalid');
});
test('exhausted repairs and missing usage stay visible', async () => {
	const run = await runWith(async () => ({ session: 'failure', usage: {} }));
	expect(run.trials[0]).toMatchObject({
		status: 'failed',
		repairs: 2,
		firstSubmissionPassed: false
	});
	expect(benchmarkMetrics(run)[0]).toMatchObject({
		outcomes: { failed: 1 },
		medianSuccessfulDurationMs: null,
		usage: { inputTokens: null },
		reportedCostUsd: null
	});
});
test('runner errors are distinct from contract failures', async () => {
	const run = await runWith(async () => {
		throw new Error('runner unavailable');
	});
	expect(run.trials[0]).toMatchObject({
		status: 'error',
		error: 'runner unavailable',
		submissions: []
	});
});
test('the total trial deadline cancels an active runner', async () => {
	fixture.definition.budget.timeoutMs = 100;
	const run = await runWith(async ({ signal }) => {
		await new Promise<void>((_resolve, reject) => {
			if (signal.aborted) reject(signal.reason);
			else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
		});
		return { session: 'never', usage: {} };
	});
	expect(run.trials[0].status).toBe('timeout');
});
test('cancellation records interruption and does not start replacement trials', async () => {
	fixture.definition.budget.repetitions = 3;
	const controller = new AbortController();
	const run = await runWith(async () => {
		controller.abort(new Error('cancelled'));
		throw controller.signal.reason;
	}, controller.signal);
	expect(run.trials).toHaveLength(1);
	expect(run.trials[0].status).toBe('interrupted');
	expect(run.completedAt).toBeUndefined();
});
test('each repetition has a clean state and initial session', async () => {
	fixture.definition.budget.repetitions = 2;
	const run = await runWith(async ({ cwd, session }) => {
		expect(session).toBeUndefined();
		await writeFile(join(cwd, 'component.ts'), 'export const value = 1;');
		return { session: cwd, usage: {} };
	});
	expect(run.trials.map((trial) => trial.status)).toEqual(['passed', 'passed']);
	expect(run.trials[0].turns[0].session).not.toBe(run.trials[1].turns[0].session);
});

test('results distinguish a live trial from a stale interrupted trial', async () => {
	const run = await runWith(async () => ({ session: 'owner', usage: {} }));
	delete run.completedAt;
	run.trials[0].status = 'running';
	const repository = new BenchmarkRepository(join(fixture.root, 'results'));
	await repository.save(run);
	expect((await repository.read(run.id)).trials[0].status).toBe('running');
	delete run.ownerPid;
	await repository.save(run);
	expect((await repository.read(run.id)).trials[0].status).toBe('interrupted');
});

test('allowed executable permission changes reach the clean evaluator', async () => {
	fixture.definition.checks[0].command = 'test -x component.ts && bun check.ts';
	const run = await runWith(async ({ cwd }) => {
		await writeFile(join(cwd, 'component.ts'), 'export const value = 1;');
		await chmod(join(cwd, 'component.ts'), 0o755);
		return { session: 'mode', usage: {} };
	});
	expect(run.trials[0].status).toBe('passed');
});
