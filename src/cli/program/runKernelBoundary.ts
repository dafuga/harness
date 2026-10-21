import { ProcessRuntimeAdapter } from '../../adapters/execution-runtimes/process-runtime-adapter/ProcessRuntimeAdapter';
import { representativeWorkload } from '../../core/development-tooling/benchmarkTypes';
import { fail } from '../../core/development-tooling/errors';
import type { Comparison } from '../../core/development-tooling/comparisonTypes';
import type { UnitRuntime } from '../../core/execution-runtimes/runtimeTypes';
import type { RuntimeKind } from '../../core/development-tooling/unitTypes';
import { UnitRuntimeService } from '../../services/execution-runtimes/UnitRuntimeService';
import { benchRounds, roundMeasurements } from '../../utils/development-tooling/benchSamples';
import { comparisonContext } from '../../utils/development-tooling/comparison-context/comparisonContext';
import { kernelArtifacts } from '../../utils/execution-runtimes/kernelArtifacts';
import { kernelWorkload } from '../../utils/execution-runtimes/kernelWorkload';
import { recordCapture } from '../../utils/reports-media/record-capture/recordCapture';

/** The unit that owns the public invocation boundary: adapters, validation and the kernel. */
export const boundaryUnit = 'service.unit-runtime';
const shape = { rounds: 5, iterations: 50 };
const targets: RuntimeKind[] = ['module', 'wasm', 'process'];

export interface BoundaryBenchmark {
	unit: string;
	workload: string;
	measurements: Array<{
		unit: string;
		metric: string;
		unitOfMeasure: string;
		value: number;
		method: string;
		workload: string;
		target: RuntimeKind;
		samples: number;
		comparison: Comparison;
	}>;
}

function runtimeFor(target: RuntimeKind): UnitRuntime {
	if (target !== 'process') return new UnitRuntimeService().kernel(target);
	const command = kernelArtifacts().native ?? fail('Build the kernel first: bun run build:kernel.');
	return new ProcessRuntimeAdapter({ command, args: ['--lines'], persistent: true });
}

/**
 * Measures the whole invocation boundary on the representative workload: the same runtimes
 * `harness impact` uses, with validation, serialization and adapter overhead inside the timing.
 * Under `harness verify` each target is recorded as benchmark evidence.
 */
export async function kernelBoundary(): Promise<BoundaryBenchmark> {
	const request = kernelWorkload(1000, 7);
	const comparison = comparisonContext(request, shape);
	const measurements: BoundaryBenchmark['measurements'] = [];
	for (const target of targets) {
		const runtime = runtimeFor(target);
		try {
			const result = await benchRounds(runtime, request, shape);
			const where = `${shape.rounds} rounds of ${shape.iterations} end-to-end calls through the ${target} runtime`;
			const taken = roundMeasurements(result, where).map((entry) => ({
				unit: boundaryUnit,
				...entry,
				workload: representativeWorkload,
				target,
				samples: result.samples,
				comparison
			}));
			measurements.push(...taken);
			recordCapture(
				{
					evidence: 'boundary',
					kind: 'benchmark',
					state: target,
					file: `boundary-${target}.json`,
					mediaType: 'application/json'
				},
				JSON.stringify({
					unit: boundaryUnit,
					workload: representativeWorkload,
					target,
					measurements: taken
				})
			);
		} finally {
			await runtime.close();
		}
	}
	return { unit: boundaryUnit, workload: representativeWorkload, measurements };
}
