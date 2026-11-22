import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { errorMessage } from '../../src/helpers/strings/errorMessage';
import type { ThrownValue } from '../../src/helpers/strings/errorMessage.types';

const meta = {
	unitId: 'reports.helper.strings-error-message',
	symbol: 'errorMessage',
	evidence: 'examples-cases'
};

function thrownBy(run: () => unknown): { name: string; message: string } {
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

function errorWithUnreadableMessage(): Error {
	const cause = new Error('hidden');
	Object.defineProperty(cause, 'message', {
		get: () => {
			throw new RangeError('message unreadable');
		}
	});
	return cause;
}

function objectWithThrowingToString(): object {
	return {
		toString: () => {
			throw new TypeError('no text form');
		}
	};
}

test('Returns Error messages and stringifies other thrown values', () => {
	const thrown: ThrownValue[] = [new Error('Request failed'), null, 503];
	const outputs = thrown.map((cause) => errorMessage(cause));
	expect(outputs).toEqual(['Request failed', 'null', '503']);

	recordExampleCases(
		{
			...meta,
			state: 'returns-error-messages-and-stringifies-other-thrown-values',
			file: 'returns-error-messages-and-stringifies-other-thrown-values.json'
		},
		[
			{
				name: 'Error instance returns its message',
				input: { kind: 'Error', message: 'Request failed' },
				output: outputs[0]
			},
			{ name: 'null is stringified', input: null, output: outputs[1] },
			{ name: 'number is stringified', input: 503, output: outputs[2] }
		]
	);
});

test('Propagates errors from message reads or conversion', () => {
	const unreadable = errorWithUnreadableMessage();
	const inconvertible = objectWithThrowingToString();
	const readError = thrownBy(() => errorMessage(unreadable));
	const convertError = thrownBy(() => errorMessage(inconvertible));
	expect(readError).toEqual({ name: 'RangeError', message: 'message unreadable' });
	expect(convertError).toEqual({ name: 'TypeError', message: 'no text form' });

	recordExampleCases(
		{
			...meta,
			state: 'propagates-errors-from-message-reads-or-conversion',
			file: 'propagates-errors-from-message-reads-or-conversion.json'
		},
		[
			{
				name: 'Error with unreadable message rethrows the read error',
				input: { kind: 'Error', message: 'getter throws' },
				error: readError
			},
			{
				name: 'object with throwing toString rethrows the conversion error',
				input: { kind: 'object', toString: 'throws' },
				error: convertError
			}
		]
	);
});
