import type { BenchmarkOptions } from './BenchmarkService.types';
export type { BenchmarkOptions } from './BenchmarkService.types';
import { BenchmarkRepository } from '../../../repositories/agents-providers/BenchmarkRepository';
import { benchmarkRunners, prepareBenchmark } from './benchmarkDefinition';
import { runBenchmark } from './runBenchmark';
import { benchmarkMetrics } from './benchmarkMetrics';
import { fail } from '../../../core/development-tooling/errors';
import type { BenchmarkRun } from '../../../core/agents-providers/subagentBenchmarkTypes';
export class BenchmarkService {
	async execute(operation: string, target: string, options: BenchmarkOptions): Promise<void> {
		try {
			await this.perform(operation, target, options);
		} catch (error) {
			fail(error instanceof Error ? error.message : 'Benchmark operation failed.');
		}
	}
	private async perform(
		operation: string,
		target: string,
		options: BenchmarkOptions
	): Promise<void> {
		const repository = new BenchmarkRepository();
		const runners = benchmarkRunners();
		if (operation === 'validate') {
			const preview = await prepareBenchmark(target, runners);
			console.log(JSON.stringify(preview, null, 2));
			return;
		}
		const run =
			operation === 'results'
				? await repository.read(target)
				: await this.start(target, { repository, runners, seed: options.seed });
		const result = { run, comparison: benchmarkMetrics(run) };
		console.log(options.json ? JSON.stringify(result, null, 2) : renderBenchmark(result));
		if (
			operation === 'run' &&
			(!run.completedAt || run.trials.some((trial) => trial.status !== 'passed'))
		)
			process.exitCode = 1;
	}
	private async start(
		path: string,
		options: Omit<Parameters<typeof runBenchmark>[0], 'path' | 'signal'>
	): Promise<BenchmarkRun> {
		const controller = new AbortController();
		const abort = () => controller.abort(new Error('Benchmark interrupted.'));
		process.once('SIGINT', abort);
		process.once('SIGTERM', abort);
		try {
			return await runBenchmark({
				path,
				...options,
				signal: controller.signal,
				onProgress: (message) => console.error(message)
			});
		} finally {
			process.removeListener('SIGINT', abort);
			process.removeListener('SIGTERM', abort);
		}
	}
}
function renderBenchmark(result: {
	run: BenchmarkRun;
	comparison: ReturnType<typeof benchmarkMetrics>;
}): string {
	return [
		`Benchmark: ${result.run.definition.name}`,
		`Run: ${result.run.id}`,
		`Revision: ${result.run.revision}`,
		'Candidate | Trials | First submission | Eventually passed | Median successful ms | Outcomes',
		...result.comparison.map(
			(row) =>
				`${row.candidate} | ${row.trials} | ${row.firstSubmissionSuccesses}/${row.trials} | ${row.successes}/${row.trials} | ${row.medianSuccessfulDurationMs ?? 'unknown'} | ${JSON.stringify(row.outcomes)}`
		),
		'Usage and reported cost are available with --json; unknown values are not zero.'
	].join('\n');
}
