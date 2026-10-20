import { PerformanceProfileService } from '../../src/services/PerformanceProfileService';
import { evidenceRequested } from '../../src/utils/record-capture/recordCapture';
import {
	PerformanceEvidenceValidator,
	type PerformanceEvidenceInput
} from '../../src/validators/PerformanceEvidenceValidator';
import { unmeasured } from '../../src/services/record-assembly-service/unmeasured';

/** Actual operations over explicit fixture inputs; measurements are never fixture constants. */
export async function taskProfile(
	unit: string,
	workload: string,
	operation: () => unknown,
	iterations = 1
) {
	if (!evidenceRequested()) return;
	await new PerformanceProfileService().capture(
		{ unit, workload, iterations, rounds: 3, warmups: 1 },
		operation
	);
}

export async function profileEvidenceValidation(input: PerformanceEvidenceInput) {
	if (!evidenceRequested()) return;
	const units = Array.from({ length: 1000 }, (_, index) => ({
		...input.units[0],
		id: `function.title-${index}`
	}));
	const measurements = units.flatMap((unit) =>
		input.measurements.map((item) => ({ ...item, unit: unit.id }))
	);
	const validator = new PerformanceEvidenceValidator();
	await taskProfile('validator.performance-evidence', 'validate-1000-profiled-units', () =>
		validator.validate({ ...input, units, measurements })
	);
}

export async function profileMissingMeasurements() {
	const units = Array.from({ length: 1000 }, (_, index) => `function.unmeasured-${index}`);
	await taskProfile(
		'service.record-assembly-service-unmeasured',
		'missing-metrics-1000-units',
		() => units.map((unit) => unmeasured(unit, 'a'.repeat(40)))
	);
}

export async function profileProfiler() {
	const profiler = new PerformanceProfileService();
	const titles = Array.from({ length: 100 }, (_, index) => ` Item ${index} `);
	await taskProfile('service.performance-profile', 'measure-100-title-normalizations', () =>
		profiler.measure(
			{
				unit: 'service.performance-profile',
				workload: 'title-normalization-batch',
				iterations: 10,
				rounds: 1,
				warmups: 1
			},
			() => titles.map((title) => title.trim().toLowerCase())
		)
	);
}
