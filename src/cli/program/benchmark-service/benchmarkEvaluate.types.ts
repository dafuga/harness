// @harness-uid u_4ygkfoscxo
import type { BenchmarkDefinition } from '../../../core/agents-providers/subagentBenchmarkTypes';

export class BenchmarkSetupError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BenchmarkSetupError';
	}
}

export interface BenchmarkEvaluationInput {
	definition: BenchmarkDefinition;
	baseline: string;
	workspace: string;
	evaluation: string;
	files: string[];
	signal: AbortSignal;
}
