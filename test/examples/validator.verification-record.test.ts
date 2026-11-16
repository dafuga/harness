import { test } from 'vitest';
import { VerificationRecordValidator } from '../../src/validators/verification-evidence/VerificationRecordValidator';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

test('Rejects a value that is not a verification record', () => {
	const input = null;
	const result = new VerificationRecordValidator().validate(input);
	expect(result).toEqual({
		errors: ['record: manifest Invalid input: expected object, received null']
	});
	recordExampleCases(
		{
			unitId: 'validator.verification-record',
			symbol: 'validate',
			state: 'rejects-a-value-that-is-not-a-verification-record',
			evidence: 'examples-cases',
			file: 'rejects-a-value-that-is-not-a-verification-record.json'
		},
		[
			{
				name: 'rejects null',
				input,
				output: { errors: result.errors }
			}
		]
	);
});
