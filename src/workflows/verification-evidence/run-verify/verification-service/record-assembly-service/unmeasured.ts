import type { Measurement } from '../../../../../core/verification-evidence/verificationTypes';

/** Performance and memory nothing measured are recorded as unavailable, never omitted. */
export function unmeasured(unit: string, testedRevision: string): Measurement[] {
	const base = { unit, value: null, method: 'Not measured.', workload: null, profile: null };
	const absent = (metric: string, unitOfMeasure: string, unavailable: string): Measurement => ({
		...base,
		metric,
		unitOfMeasure,
		unavailable,
		testedRevision,
		artifacts: []
	});
	return [
		absent('latency-warm-ms', 'ms', 'No benchmark measured this unit in this verification.'),
		absent(
			'memory-bytes',
			'bytes',
			'No benchmark measured this unit, and in-process memory cannot be attributed to it.'
		)
	];
}
