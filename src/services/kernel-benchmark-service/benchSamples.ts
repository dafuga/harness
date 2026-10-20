import type { WarmResult } from '../../utils/benchSamples';
import { timeCall, median } from '../../utils/benchSamples';
import type { RuntimeRequest, UnitRuntime } from '../../core/runtimeTypes';

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
