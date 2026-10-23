import type {
	BenchmarkDefinition,
	BenchmarkRunner
} from '../../../core/agents-providers/subagentBenchmarkTypes';

export type BenchmarkRunners = Record<'codex' | 'claude', BenchmarkRunner>;

export interface PreparedBenchmark {
	definition: BenchmarkDefinition;
	project: string;
	revision: string;
	fingerprint: string;
	runnerVersions: Record<string, string>;
	trials: number;
}
