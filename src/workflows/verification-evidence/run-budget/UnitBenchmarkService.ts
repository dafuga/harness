import type { UnitBenchmark } from './UnitBenchmarkService.types';
import { createHash } from 'node:crypto';
import { fail } from '../../../core/development-tooling/errors';
import type { ComponentManifest, RuntimeKind } from '../../../core/development-tooling/unitTypes';
import type { Workload } from '../../../core/verification-evidence/verifyTypes';
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

export type { UnitBenchmark } from './UnitBenchmarkService.types';
