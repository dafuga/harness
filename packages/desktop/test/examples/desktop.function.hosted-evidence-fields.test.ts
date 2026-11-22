import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hostedEvidenceFields } from '../../src/utils/verification-evidence/hostedEvidenceFields';

test('validates hosted evidence field constraints', () => {
	const validFields = {
		string: hostedEvidenceFields.s.safeParse('hosted evidence').success,
		name: hostedEvidenceFields.name.safeParse('capture').success,
		sha: hostedEvidenceFields.sha.safeParse('a'.repeat(40)).success,
		hash: hostedEvidenceFields.hash.safeParse('b'.repeat(64)).success,
		mode: hostedEvidenceFields.mode.safeParse('commit').success,
		passed: hostedEvidenceFields.passed.safeParse('passed').success,
		finiteNumber: hostedEvidenceFields.num.safeParse(12.5).success
	};
	const rejectedFields = {
		uppercaseSha: hostedEvidenceFields.sha.safeParse('A'.repeat(40)).success,
		unknownMode: hostedEvidenceFields.mode.safeParse('branch').success,
		infiniteNumber: hostedEvidenceFields.num.safeParse(Infinity).success,
		unknownCaptureKey: hostedEvidenceFields.capture.safeParse({ unexpected: true }).success,
		unknownScenarioKey: hostedEvidenceFields.scenario.safeParse({ unexpected: true }).success,
		unknownUnitKey: hostedEvidenceFields.unit.safeParse({ unexpected: true }).success
	};

	expect(validFields).toEqual({
		string: true,
		name: true,
		sha: true,
		hash: true,
		mode: true,
		passed: true,
		finiteNumber: true
	});
	expect(Object.values(rejectedFields)).toEqual([false, false, false, false, false, false]);
	recordExampleCases(
		{
			unitId: 'desktop.function.hosted-evidence-fields',
			symbol: 'hostedEvidenceFields',
			state: 'validates-hosted-evidence-field-constraints',
			evidence: 'examples-cases',
			file: 'validates-hosted-evidence-field-constraints.json'
		},
		[
			{
				name: 'accepts documented scalar values',
				input: { string: 'hosted evidence', name: 'capture', sha: '40 lowercase hex', hash: '64 lowercase hex', mode: 'commit', passed: 'passed', number: 12.5 },
				output: validFields
			},
			{
				name: 'rejects invalid scalar values and unknown strict-object keys',
				input: { sha: '40 uppercase hex', mode: 'branch', number: 'Infinity', extraKey: true },
				output: rejectedFields
			}
		]
	);
});
