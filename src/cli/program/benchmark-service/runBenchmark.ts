import type { RunBenchmarkInput } from './runBenchmark.types';
export type { RunBenchmarkInput } from './runBenchmark.types';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import type {
	BenchmarkRun,
	BenchmarkTrial
} from '../../../core/agents-providers/subagentBenchmarkTypes';
import { fingerprint, recordAnalytics } from '../../../workflows/reports-media/analyticsRecord';
import { prepareBenchmark } from './benchmarkDefinition';
import { snapshotBenchmark } from './benchmarkWorkspace';
import { runBenchmarkTrial } from './benchmarkTrial';
export async function runBenchmark(input: RunBenchmarkInput): Promise<BenchmarkRun> {
	const prepared = await prepareBenchmark(input.path, input.runners);
	const run: BenchmarkRun = {
		version: 1,
		id: randomUUID(),
		seed: input.seed ?? randomUUID(),
		...prepared,
		startedAt: new Date().toISOString(),
		ownerPid: process.pid,
		trials: []
	};
	const directory = input.repository.directory(run.id);
	await input.repository.save(run);
	input.onProgress?.(`Benchmark run: ${run.id}`);
	const files = await snapshotBenchmark(run.project, run.revision, join(directory, 'baseline'));
	const persist = () => input.repository.save(run);
	for (const item of benchmarkSchedule(run)) {
		if (input.signal.aborted) break;
		const trial = newBenchmarkTrial(item.candidate, item.repetition);
		input.onProgress?.(`Starting ${item.candidate}, repetition ${item.repetition}`);
		run.trials.push(trial);
		await persist();
		const candidate = run.definition.candidates.find((entry) => entry.id === item.candidate)!;
		await runBenchmarkTrial({
			run,
			trial,
			candidate,
			runner: input.runners[candidate.runner],
			directory,
			files,
			signal: input.signal,
			persist
		});
		await recordBenchmarkTrial(run, trial);
		input.onProgress?.(`${item.candidate}: ${trial.status} (${trial.durationMs} ms)`);
	}
	if (!input.signal.aborted) run.completedAt = new Date().toISOString();
	await persist();
	await rm(join(directory, 'baseline'), { recursive: true, force: true });
	return run;
}
export function benchmarkSchedule(run: BenchmarkRun) {
	return Array.from({ length: run.definition.budget.repetitions }, (_, repetition) =>
		run.definition.candidates
			.map((candidate) => ({ candidate: candidate.id, repetition: repetition + 1 }))
			.sort((a, b) => fingerprint([run.seed, a]).localeCompare(fingerprint([run.seed, b])))
	).flat();
}
function newBenchmarkTrial(candidate: string, repetition: number): BenchmarkTrial {
	return {
		id: randomUUID(),
		candidate,
		repetition,
		status: 'running',
		submissions: [],
		turns: [],
		agentDurationMs: 0,
		evaluationDurationMs: 0,
		durationMs: 0,
		repairs: 0
	};
}
async function recordBenchmarkTrial(run: BenchmarkRun, trial: BenchmarkTrial): Promise<void> {
	const candidate = run.definition.candidates.find((entry) => entry.id === trial.candidate)!;
	await recordAnalytics(
		{
			kind: 'benchmark',
			action: 'trial',
			agentModel: candidate.model,
			status: trial.status,
			durationMs: trial.durationMs,
			benchmark: {
				run: run.id,
				name: run.definition.name,
				fingerprint: run.fingerprint,
				candidate: candidate.id,
				configuration: fingerprint({ candidate, version: run.runnerVersions[candidate.id] }),
				trial: trial.id,
				repetition: trial.repetition,
				firstSubmissionPassed: trial.firstSubmissionPassed,
				repairs: trial.repairs,
				agentDurationMs: trial.agentDurationMs,
				evaluationDurationMs: trial.evaluationDurationMs
			}
		},
		run.project
	);
}
