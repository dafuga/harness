import { performance } from 'node:perf_hooks';
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

/** Steady-state latency and throughput on a runtime that is already initialized. */
export async function benchSamples(
	runtime: UnitRuntime,
	request: RuntimeRequest,
	iterations: number
): Promise<WarmResult> {
	for (let warmup = 0; warmup < 3; warmup += 1) await timeCall(runtime, request);
	const samples: number[] = [];
	for (let index = 0; index < iterations; index += 1) {
		samples.push(await timeCall(runtime, request));
	}
	const total = samples.reduce((sum, value) => sum + value, 0);
	return { medianMs: median(samples), opsPerSecond: (iterations * 1000) / total, iterations };
}
