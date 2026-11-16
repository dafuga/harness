import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	recordValue,
	probabilityValue,
	tokenCount
} from '../../src/validators/development-tooling/cleanCodeValue';

function capturedError(run: () => unknown): { name: string; message: string } {
	let error: unknown;
	try {
		run();
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error;
	return { name: actual.name, message: actual.message };
}

test('Accepts response records and rejects null and arrays', () => {
	const response = { findings: [] };
	const output = recordValue(response);
	expect(output).toBe(response);
	const rejected = [null, []].map((value) => ({
		name: `rejects ${JSON.stringify(value)}`,
		input: value,
		error: capturedError(() => recordValue(value))
	}));
	recordExampleCases(
		{
			unitId: 'validator.clean-code-value',
			symbol: 'recordValue',
			state: 'accepts-response-records-and-rejects-null-and-arrays',
			evidence: 'examples-cases',
			file: 'accepts-response-records-and-rejects-null-and-arrays.json'
		},
		[
			{ name: 'accepts findings record', input: response, output },
			...rejected
		]
	);
});

test('Accepts probabilities from zero through one', () => {
	const valid = [0.25, 1];
	const accepted = valid.map((value) => {
		const output = probabilityValue(value);
		expect(output).toBe(value);
		return { name: `accepts ${value}`, input: value, output };
	});
	const invalid = -0.1;
	const rejected = capturedError(() => probabilityValue(invalid));
	expect(rejected.message).toBe('Invalid Jev probability');
	recordExampleCases(
		{
			unitId: 'validator.clean-code-value',
			symbol: 'probabilityValue',
			state: 'accepts-probabilities-from-zero-through-one',
			evidence: 'examples-cases',
			file: 'accepts-probabilities-from-zero-through-one.json'
		},
		[
			...accepted,
			{ name: 'rejects negative probability', input: invalid, error: rejected }
		]
	);
});

test('Accepts nonnegative safe integer token counts', () => {
	const valid = [0, 37];
	const accepted = valid.map((value) => {
		const output = tokenCount(value);
		expect(output).toBe(value);
		return { name: `accepts ${value} tokens`, input: value, output };
	});
	const invalid = -1;
	const rejected = capturedError(() => tokenCount(invalid));
	expect(rejected.message).toBe('Invalid Jev usage');
	recordExampleCases(
		{
			unitId: 'validator.clean-code-value',
			symbol: 'tokenCount',
			state: 'accepts-nonnegative-safe-integer-token-counts',
			evidence: 'examples-cases',
			file: 'accepts-nonnegative-safe-integer-token-counts.json'
		},
		[
			...accepted,
			{ name: 'rejects negative count', input: invalid, error: rejected }
		]
	);
});
