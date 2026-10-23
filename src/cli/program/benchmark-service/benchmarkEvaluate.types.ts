import type { BenchmarkDefinition } from '../../../core/agents-providers/subagentBenchmarkTypes';

export interface BenchmarkEvaluationInput {
	definition: BenchmarkDefinition;
	baseline: string;
	workspace: string;
	evaluation: string;
	files: string[];
	signal: AbortSignal;
}
