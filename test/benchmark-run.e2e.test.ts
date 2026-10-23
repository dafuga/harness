import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { benchmarkFixture } from './support/benchmark';
import { installBenchmarkExecutables } from './support/benchmarkExecutable';
import { runCommand, runHarness } from './support/cli';

test('native adapters run repairs, persist JSON and attribute analytics without touching source', async () => {
	const fixture = await benchmarkFixture();
	try {
		const bin = await installBenchmarkExecutables(fixture.root);
		vi.stubEnv('PATH', `${bin}:${process.env.PATH}`);
		vi.stubEnv('HARNESS_ANALYTICS_HOME', join(fixture.root, 'analytics'));
		fixture.definition.candidates.push({
			...fixture.definition.candidates[0],
			id: 'claude',
			runner: 'claude'
		});
		await writeFile(fixture.path, JSON.stringify(fixture.definition));
		const before = await runCommand(['git', 'status', '--porcelain'], fixture.root);
		const result = await runHarness(
			['benchmark', 'run', fixture.path, '--seed', 'stable', '--json'],
			fixture.root
		);
		const { run, comparison } = JSON.parse(result.stdout);
		expect(run.trials).toHaveLength(2);
		expect(
			run.trials.every(
				(trial: { status: string; repairs: number }) =>
					trial.status === 'passed' && trial.repairs === 1
			)
		).toBe(true);
		expect(comparison[0].firstSubmissionSuccesses).toBe(0);
		expect(comparison[1].reportedCostUsd).toBe(0.02);
		const stored = JSON.parse(
			(await runHarness(['benchmark', 'results', run.id, '--json'], fixture.root)).stdout
		);
		expect(stored).toEqual({ run, comparison });
		const history = JSON.parse(
			(await runHarness(['analytics', 'benchmarks', '--json'], fixture.root)).stdout
		);
		expect(history.benchmarks).toHaveLength(2);
		expect(
			history.benchmarks.every(
				(event: { agentModel: string }) => event.agentModel === 'explicit-model'
			)
		).toBe(true);
		expect(JSON.stringify(history)).not.toContain('Export value equal to 1');
		// External evidence is under the test analytics directory, not the checkout source.
		expect((await runCommand(['git', 'diff'], fixture.root)).stdout).toBe('');
		expect(before.stdout).toContain('benchmark.json');
	} finally {
		vi.unstubAllEnvs();
		await rm(fixture.root, { recursive: true, force: true });
	}
}, 60000);
