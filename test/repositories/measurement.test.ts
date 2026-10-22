import { taskProfile } from '../support/taskProfiles';
import { expect, test } from 'vitest';
import { kernelBenchmarkSchema } from '../../src/core/benchmarkTypes';
import { VerificationRecordValidator } from '../../src/validators/VerificationRecordValidator';
import { verificationSample } from '../support/verificationSample';

function calibration() {
	const { profile } = verificationSample();
	return {
		schemaVersion: 1,
		contract: 'impact-kernel/1',
		recordedAt: '2026-10-10T00:00:00.000Z',
		profile,
		source: { commit: null, dirty: true },
		provenance: {
			kind: 'calibration',
			verified: false,
			note: 'Observational measurements; not verification evidence and not a budget baseline.'
		},
		workloads: [],
		measurements: [],
		default: {
			runtime: 'module',
			basis: 'unmeasured',
			workload: 'graph-1k',
			profile: profile.id,
			rule: 'rule',
			candidates: [],
			excluded: []
		}
	};
}

test('a benchmark run is calibration and can never claim to be verified', async () => {
	const run = calibration();
	await taskProfile('function.benchmark-types', 'parse-kernel-calibration', () =>
		kernelBenchmarkSchema.parse(run)
	);
	expect(kernelBenchmarkSchema.safeParse(run).success).toBe(true);
	const promoted = { ...run, provenance: { ...run.provenance, verified: true } };
	expect(kernelBenchmarkSchema.safeParse(promoted).success).toBe(false);
	const relabelled = { ...run, provenance: { ...run.provenance, kind: 'verified' } };
	expect(kernelBenchmarkSchema.safeParse(relabelled).success).toBe(false);
	expect(kernelBenchmarkSchema.safeParse({ ...run, provenance: undefined }).success).toBe(false);
});

test('a measurement without a tested revision cannot enter a verification record', () => {
	const sample = verificationSample();
	const unattributed = { ...sample.measurements[0], testedRevision: null };
	const errors = new VerificationRecordValidator().validate({
		...sample,
		measurements: [unattributed]
	}).errors;
	expect(errors).toHaveLength(1);
	expect(errors[0]).toContain('record-1: measurements.0.testedRevision');
});
