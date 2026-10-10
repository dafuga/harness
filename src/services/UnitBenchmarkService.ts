import { createHash } from 'node:crypto';
import { fail } from '../core/errors';
import type { Comparison } from '../core/comparisonTypes';
import type { ComponentManifest, RuntimeKind } from '../core/unitTypes';
import type { Workload } from '../core/verifyTypes';
import { benchRounds, roundMeasurements } from '../utils/benchSamples';
import { comparisonContext } from '../utils/comparisonContext';
import { stableJson } from '../utils/stableJson';
import { UnitRuntimeService } from './UnitRuntimeService';

export interface UnitBenchmark {
	unit: string;
	workload: string;
	target: RuntimeKind;
	/** Hash of the unit's response, so a slowdown can be shown to leave the result unchanged. */
	responseDigest: string;
	measurements: Array<{
		unit: string;
		metric: string;
		unitOfMeasure: string;
		value: number;
		method: string;
		workload: string;
		target: RuntimeKind;
		samples: number;
		/** Derived from the request that was sent and the sampling that was used. */
		comparison: Comparison;
	}>;
}

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
			const where =
				`${workload.rounds} rounds of ${workload.iterations} end-to-end calls through the declared ` +
				`${runtime.kind} target`;
			const shared = {
				unit: manifest.id,
				workload: workload.id,
				target: runtime.kind,
				samples: result.samples,
				comparison: comparisonContext(workload.request, workload)
			};
			return {
				unit: manifest.id,
				workload: workload.id,
				target: runtime.kind,
				responseDigest: createHash('sha256').update(stableJson(response)).digest('hex'),
				measurements: roundMeasurements(result, where).map((entry) => ({ ...shared, ...entry }))
			};
		} finally {
			await runtime.close();
		}
	}
}
