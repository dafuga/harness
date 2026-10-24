import type { UnitBenchmark } from './UnitBenchmarkService.types';
export type { UnitBenchmark } from './UnitBenchmarkService.types';
import { PerformanceProfileService } from '../../../services/verification-evidence/PerformanceProfileService';
import { createHash } from 'node:crypto';
import { fail } from '../../../core/development-tooling/errors';

import type { ComponentManifest, RuntimeKind } from '../../../core/development-tooling/unitTypes';
import type { Workload } from '../../../core/verification-evidence/verifyTypes';
import type { RuntimeResponse } from '../../../core/execution-runtimes/runtimeTypes';
import type { RoundResult } from '../../../utils/development-tooling/benchSamples';
import { benchRounds, roundMeasurements } from '../../../utils/development-tooling/benchSamples';
import { comparisonContext } from '../../../utils/development-tooling/comparison-context/comparisonContext';
import { stableJson } from '../../../utils/development-tooling/stableJson';
import { UnitRuntimeService } from '../../../services/execution-runtimes/UnitRuntimeService';

/**
 * Measures a unit through its declared execution target, end to end: request validation,
 * serialization, the call and response parsing are all inside the timing.
 */
export class UnitBenchmarkService {
	constructor(private readonly root: string) {}

	async measure(
		manifest: ComponentManifest,
		workload: Workload,
		kind?: RuntimeKind
	): Promise<UnitBenchmark> {
		const runtime = new UnitRuntimeService(this.root).forUnit(manifest, kind);
		try {
			const response = await runtime.invoke(workload.request);
			if (!response.ok) {
				return fail(
					`${manifest.id} failed the workload: ${response.error.code} ${response.error.message}`
				);
			}
			const result = await benchRounds(runtime, workload.request, workload);
			return benchmarkResult(manifest.id, workload, { target: runtime.kind, result, response });
		} finally {
			await runtime.close();
		}
	}
}

function processMemory(target: RuntimeKind) {
	if (target !== 'module') return [];
	return [
		{
			metric: 'process-peak-rss-bytes',
			unitOfMeasure: 'bytes',
			value: PerformanceProfileService.peakProcessRssBytes(),
			method:
				'Peak RSS of the Harness benchmark process, normalized to bytes for this runtime, including runner overhead and earlier work; excludes separate target processes and is not callable-attributed memory.'
		}
	];
}

function boundary(workload: Workload, kind: RuntimeKind): string {
	return `${workload.rounds} rounds of ${workload.iterations} end-to-end calls through the declared ${kind} target`;
}

function benchmarkResult(
	unit: string,
	workload: Workload,
	context: { target: RuntimeKind; result: RoundResult; response: RuntimeResponse }
): UnitBenchmark {
	const { target, result, response } = context;
	const shared = {
		unit,
		workload: workload.id,
		target,
		samples: result.samples,
		comparison: comparisonContext(workload.request, workload)
	};
	return {
		unit,
		workload: workload.id,
		target,
		responseDigest: createHash('sha256').update(stableJson(response)).digest('hex'),
		measurements: [
			...roundMeasurements(result, boundary(workload, target)),
			...processMemory(target)
		].map((entry) => ({ ...shared, ...entry }))
	};
}
