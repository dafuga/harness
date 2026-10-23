import type { RuntimeRequest } from '../../../../core/execution-runtimes/runtimeTypes';
import type { KernelBenchmark } from '../../../../core/development-tooling/benchmarkTypes';

export interface BenchPlan {
	/** Command line that starts this CLI, used for fresh-process samples and the HTTP server. */
	cli: string[];
	coldSamples: number;
	warmIterations: number;
}

export interface WorkloadRun {
	id: string;
	nodes: number;
	seed: number;
	request: RuntimeRequest;
}

export type Workload = KernelBenchmark['workloads'][number];
