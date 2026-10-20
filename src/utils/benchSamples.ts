import { performance } from 'node:perf_hooks';
import { warmupCalls } from '../core/comparisonTypes';
import type { RuntimeRequest, UnitRuntime } from '../core/runtimeTypes';

export interface WarmResult {
	medianMs: number;
	opsPerSecond: number;
	iterations: number;
}

export function median(values: number[]): number {
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Times one end-to-end call: the adapter serializes, invokes and parses inside `invoke`. */
export async function timeCall(runtime: UnitRuntime, request: RuntimeRequest): Promise<number> {
	const started = performance.now();
	const response = await runtime.invoke(request);
	const elapsed = performance.now() - started;
	if (!response.ok) throw new Error(`${runtime.kind} failed: ${response.error.message}`);
	return elapsed;
}

export interface RoundResult {
	/** Fastest single call: the most repeatable figure on a machine doing other work. */
	floorMs: number;
	/** Median of the round medians. */
	warmMs: number;
	opsPerSecond: number;
	samples: number;
}

/** Several rounds of end-to-end calls on an initialized runtime, after a short warm-up. */
export async function benchRounds(
	runtime: UnitRuntime,
	request: RuntimeRequest,
	shape: { rounds: number; iterations: number }
): Promise<RoundResult> {
	for (let warmup = 0; warmup < warmupCalls; warmup += 1) await timeCall(runtime, request);
	const rounds: number[][] = [];
	for (let round = 0; round < shape.rounds; round += 1) {
		const samples: number[] = [];
		for (let call = 0; call < shape.iterations; call += 1) {
			samples.push(await timeCall(runtime, request));
		}
		rounds.push(samples);
	}
	const warmMs = median(rounds.map(median));
	return {
		floorMs: Math.min(...rounds.flat()),
		warmMs,
		opsPerSecond: 1000 / warmMs,
		samples: shape.rounds * shape.iterations
	};
}

/** The three measurements every boundary benchmark reports, with how each was taken. */
export function roundMeasurements(result: RoundResult, where: string) {
	const boundary = `${where}, including request validation, serialization and response parsing.`;
	return [
		{
			metric: 'latency-floor-ms',
			unitOfMeasure: 'ms',
			value: result.floorMs,
			method: `Fastest of ${boundary}`
		},
		{
			metric: 'latency-warm-ms',
			unitOfMeasure: 'ms',
			value: result.warmMs,
			method: `Median of the round medians over ${boundary}`
		},
		{
			metric: 'throughput-ops',
			unitOfMeasure: 'ops/s',
			value: result.opsPerSecond,
			method: `Calls per second at the median over ${boundary}`
		}
	];
}

export { benchSamples } from '../cli/program/run-kernel-bench/kernel-benchmark-service/benchSamples';
