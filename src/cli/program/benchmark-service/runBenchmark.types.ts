// @harness-uid u_a53u5f7efo
import type { BenchmarkRepository } from '../../../repositories/agents-providers/BenchmarkRepository';
import type { BenchmarkRunners } from './benchmarkDefinition';

export interface RunBenchmarkInput {
	path: string;
	runners: BenchmarkRunners;
	repository: BenchmarkRepository;
	signal: AbortSignal;
	seed?: string;
	onProgress?: (message: string) => void;
}
