import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { AuthRecordValidator } from '../../src/validators/accounts-access/AuthRecordValidator';
import { AuthRecordCorruptError } from '../../src/validators/accounts-access/AuthRecordValidator.types';
import type { Validate, Case } from './hub.validator.auth-record.test.types';

const unitId = 'hub.validator.auth-record';
export const validator = new AuthRecordValidator();
export const corrupt = 'Hub auth record corrupt';

/** Runs each example through the real validator, asserts what came back, and records the cases. */
export function checkExamples(symbol: string, state: string, run: Validate, examples: Case[]) {
	const cases = examples.map(({ name, input }): Case => {
		try {
			return { name, input, output: run(input) };
		} catch (error) {
			expect(error).toBeInstanceOf(AuthRecordCorruptError);
			return { name, input, error: error instanceof Error ? error.message : String(error) };
		}
	});
	expect(cases).toEqual(examples);
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

const challengeRow = {
	id_hash: 'c4e6e23f5c1d40c2a2d24c6678499c18e8e8e064',
	nonce: 'nQ3zP8kV2aY7mD4s',
	csrf_hash: '4b5f8cfc80f59ca3286fa65c',
	expires_at: 1893456000000
};
const challengeRecord = {
	idHash: 'c4e6e23f5c1d40c2a2d24c6678499c18e8e8e064',
	nonce: 'nQ3zP8kV2aY7mD4s',
	csrfHash: '4b5f8cfc80f59ca3286fa65c',
	expiresAt: 1893456000000
};

test('Copies a stored challenge row into a challenge record', () => {
	checkExamples(
		'challenge',
		'copies-a-stored-challenge-row-into-a-challenge-record',
		(input) => validator.challenge(input),
		[
			{ name: 'copies every column', input: challengeRow, output: challengeRecord },
			{ name: 'rejects an empty nonce', input: { ...challengeRow, nonce: '' }, error: corrupt },
			{ name: 'rejects a null row', input: null, error: corrupt }
		]
	);
});
