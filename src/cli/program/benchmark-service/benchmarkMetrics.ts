import type {
	BenchmarkRun,
	BenchmarkTrial
} from '../../../core/agents-providers/subagentBenchmarkTypes';

export function benchmarkMetrics(run: BenchmarkRun) {
	return run.definition.candidates.map((candidate) => {
		const trials = run.trials.filter((trial) => trial.candidate === candidate.id);
		const passed = trials.filter((trial) => trial.status === 'passed');
		return {
			candidate: candidate.id,
			configuration: candidate,
			trials: trials.length,
			firstSubmissionSuccesses: trials.filter((trial) => trial.firstSubmissionPassed).length,
			firstSubmissionSuccessRate: rate(
				trials.filter((trial) => trial.firstSubmissionPassed).length,
				trials.length
			),
			successes: passed.length,
			successRate: rate(passed.length, trials.length),
			medianSuccessfulDurationMs: median(passed.map((trial) => trial.durationMs)),
			totalDurationMs: trials.reduce((sum, trial) => sum + trial.durationMs, 0),
			totalRepairs: trials.reduce((sum, trial) => sum + trial.repairs, 0),
			outcomes: outcomeCounts(trials),
			usage: {
				inputTokens: usageTotal(trials, 'inputTokens'),
				outputTokens: usageTotal(trials, 'outputTokens'),
				cacheReadTokens: usageTotal(trials, 'cacheReadTokens')
			},
			reportedCostUsd:
				trials.length &&
				trials.every(
					(trial) =>
						!['error', 'timeout', 'interrupted', 'running'].includes(trial.status) &&
						trial.turns.at(-1)?.usage.reportedCostUsd !== undefined
				)
					? trials.reduce((sum, trial) => sum + trial.turns.at(-1)!.usage.reportedCostUsd!, 0)
					: null
		};
	});
}
function usageTotal(
	trials: BenchmarkTrial[],
	key: 'inputTokens' | 'outputTokens' | 'cacheReadTokens'
): number | null {
	const turns = trials.flatMap((trial) => trial.turns);
	if (trials.some((trial) => ['error', 'timeout', 'interrupted', 'running'].includes(trial.status)))
		return null;
	if (!turns.length || turns.some((turn) => turn.usage[key] === undefined)) return null;
	return turns.reduce((sum, turn) => sum + turn.usage[key]!, 0);
}
function outcomeCounts(trials: BenchmarkTrial[]): Record<string, number> {
	const outcomes: Record<string, number> = {};
	for (const trial of trials) outcomes[trial.status] = (outcomes[trial.status] ?? 0) + 1;
	return outcomes;
}
function median(values: number[]): number | null {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function rate(count: number, total: number): number | null {
	return total ? count / total : null;
}
