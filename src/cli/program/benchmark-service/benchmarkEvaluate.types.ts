// @harness-uid u_4ygkfoscxo
import type { BenchmarkDefinition } from '../../../core/agents-providers/subagentBenchmarkTypes';

export { BenchmarkSetupError } from './BenchmarkSetupError';

export interface BenchmarkEvaluationInput {
	definition: BenchmarkDefinition;
	baseline: string;
	workspace: string;
	evaluation: string;
	files: string[];
	signal: AbortSignal;
}
