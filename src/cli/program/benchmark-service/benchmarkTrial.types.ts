import type {
	BenchmarkCandidate,
	BenchmarkRun,
	BenchmarkRunner,
	BenchmarkTrial
} from '../../../core/agents-providers/subagentBenchmarkTypes';

export interface BenchmarkTrialInput {
	run: BenchmarkRun;
	trial: BenchmarkTrial;
	candidate: BenchmarkCandidate;
	runner: BenchmarkRunner;
	directory: string;
	files: string[];
	signal: AbortSignal;
	persist: () => Promise<void>;
}
