import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { unmeasured } from '../../src/workflows/verification-evidence/run-verify/verification-service/record-assembly-service/unmeasured';

const unit = 'service.record-assembly-service-unmeasured';
const testedRevision = '0123456789abcdef0123456789abcdef01234567';

test('Records unavailable latency and memory when unmeasured', () => {
	const entries = unmeasured(unit, testedRevision);

	expect(entries.map((entry) => entry.metric)).toEqual(['latency-warm-ms', 'memory-bytes']);
	expect(entries.every((entry) => entry.value === null)).toBe(true);
	expect(entries.every((entry) => (entry.unavailable ?? '').length > 0)).toBe(true);
	recordExampleCases(
		{
			unitId: 'service.record-assembly-service-unmeasured',
			symbol: 'unmeasured',
			state: 'records-unavailable-latency-and-memory-when-unmeasured',
			evidence: 'examples-cases',
			file: 'records-unavailable-latency-and-memory-when-unmeasured.json'
		},
		[{ name: 'unit with no benchmark records two unavailable entries', input: { unit, testedRevision }, output: entries }]
	);
});

test('Copies unit and tested revision into each entry', () => {
	const entries = unmeasured(unit, testedRevision);

	expect(entries.every((entry) => entry.unit === unit)).toBe(true);
	expect(entries.every((entry) => entry.testedRevision === testedRevision)).toBe(true);
	expect(entries.every((entry) => entry.method === 'Not measured.')).toBe(true);
	expect(entries.every((entry) => entry.artifacts.length === 0)).toBe(true);
	recordExampleCases(
		{
			unitId: 'service.record-assembly-service-unmeasured',
			symbol: 'unmeasured',
			state: 'copies-unit-and-tested-revision-into-each-entry',
			evidence: 'examples-cases',
			file: 'copies-unit-and-tested-revision-into-each-entry.json'
		},
		[{ name: 'unit and revision are copied unchanged with no artifacts', input: { unit, testedRevision }, output: entries }]
	);
});
