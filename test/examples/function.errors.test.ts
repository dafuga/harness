import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	ExpectedCliError,
	fail,
	isExpectedCliError
} from '../../src/core/development-tooling/errors';

function captureFailure(message: string): { name: string; message: string } {
	try {
		fail(message);
	} catch (error) {
		if (error instanceof ExpectedCliError) {
			return { name: error.name, message: error.message };
		}
		throw error;
	}
	throw new Error('fail returned normally');
}

test('Fail throws an expected CLI error with the supplied message', () => {
	const messages = [
		'Unit function.errors has no contract section.',
		'Could not parse unit.json: unexpected end of JSON input',
		'Refusing to overwrite an existing unit.json.'
	];
	const cases = messages.map((message) => {
		const error = captureFailure(message);
		return {
			name: message,
			input: { message },
			output: error
		};
	});

	expect(cases.map(({ output }) => output)).toEqual(
		messages.map((message) => ({ name: 'ExpectedCliError', message }))
	);
	recordExampleCases(
		{
			unitId: 'function.errors',
			symbol: 'fail',
			state: 'fail-throws-an-expected-cli-error-with-the-supplied-message',
			evidence: 'examples-cases',
			file: 'fail-throws-an-expected-cli-error-with-the-supplied-message.json'
		},
		cases
	);
});

test('Recognize only expected CLI error instances', () => {
	class SpecializedCliError extends ExpectedCliError {}
	const values: unknown[] = [
		new ExpectedCliError('Unknown unit'),
		new SpecializedCliError('Special case'),
		new Error('Unexpected end of input'),
		null,
		{ name: 'ExpectedCliError', message: 'Unknown unit' }
	];
	const cases = values.map((value, index) => ({
		name: ['expected CLI error', 'subclass', 'plain error', 'null', 'lookalike object'][index],
		input: value instanceof Error ? { name: value.name, message: value.message } : value,
		output: isExpectedCliError(value)
	}));

	expect(cases.map(({ output }) => output)).toEqual([true, true, false, false, false]);
	recordExampleCases(
		{
			unitId: 'function.errors',
			symbol: 'isExpectedCliError',
			state: 'recognize-only-expected-cli-error-instances',
			evidence: 'examples-cases',
			file: 'recognize-only-expected-cli-error-instances.json'
		},
		cases
	);
});
