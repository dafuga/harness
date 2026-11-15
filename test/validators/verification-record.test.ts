import { expect, test } from 'vitest';
import { VerificationRecordValidator } from '../../src/validators/verification-evidence/VerificationRecordValidator';
import { unitSchema } from '../../src/workflows/inspectUnits';
import { verificationSample } from '../support/verificationSample';

function errorsOf(value: unknown): string[] {
	return new VerificationRecordValidator().validate(value).errors;
}

test('a record carries explicit tested component versions and measurement records', () => {
	const sample = verificationSample();
	expect(errorsOf(sample)).toEqual([]);
	expect(new VerificationRecordValidator().validate(sample).value).toEqual(sample);
	const pointer = {
		schemaVersion: 1,
		kind: 'harness-video-batch',
		batch: 'b'.repeat(64),
		evidence: {
			commit: 'c'.repeat(40),
			path: `video-batches/${'b'.repeat(64)}`,
			manifest: 'd'.repeat(64)
		}
	};
	expect(errorsOf({ ...sample, videoBatches: [pointer] })).toEqual([]);
	const coverage = {
		graph: 'page',
		states: 0.5,
		edges: 0.5,
		clips: 0.5,
		complete: false,
		missing: ['state:loading']
	};
	const withCoverage = (value: typeof coverage) => ({
		...sample,
		scenarios: [
			{
				id: 'page',
				status: 'failed',
				testedRevision: sample.source.commit,
				states: [],
				videoCoverage: [value]
			}
		]
	});
	expect(errorsOf(withCoverage(coverage))).toEqual([]);
	for (const field of ['states', 'edges', 'clips'])
		for (const value of [-0.1, 1.1, Infinity, NaN])
			expect(errorsOf(withCoverage({ ...coverage, [field]: value })).join(' ')).toContain(
				'videoCoverage'
			);
	const schema = unitSchema('VerificationRecord') as { required: string[] };
	expect(schema.required).toEqual(expect.arrayContaining(['components', 'measurements']));
});

test('a record without component versions or measurements is rejected', () => {
	const sample = verificationSample();
	expect(errorsOf({ ...sample, components: undefined })[0]).toContain('record-1: components');
	expect(errorsOf({ ...sample, measurements: undefined })[0]).toContain('record-1: measurements');
});

test('a measurement is either a value or an explicit unavailable reason, never neither or both', () => {
	const sample = verificationSample();
	const [size, memory] = sample.measurements;
	const withMeasurements = (measurements: unknown[]) => ({ ...sample, measurements });

	expect(errorsOf(withMeasurements([{ ...memory, unavailable: undefined }]))).toEqual([
		'record-1: measurement function.rank memory-bytes has no value and no unavailable reason'
	]);
	expect(errorsOf(withMeasurements([{ ...size, unavailable: 'Not measured.' }]))).toEqual([
		'record-1: measurement function.rank source-bytes has both a value and an unavailable reason'
	]);
});

test('measurements and budget findings must refer to a recorded component version', () => {
	const sample = verificationSample();
	const stray = { ...sample.measurements[0], unit: 'function.other' };
	expect(errorsOf({ ...sample, measurements: [stray] })).toEqual([
		'record-1: measurement names function.other, which has no recorded component version'
	]);
	const finding = {
		unit: 'function.other',
		metric: 'source-bytes',
		status: 'passed',
		baseline: 64,
		measured: 64
	};
	expect(errorsOf({ ...sample, budgets: { status: 'passed', findings: [finding] } })).toEqual([
		'record-1: budget finding names function.other, which has no recorded component version'
	]);
});
