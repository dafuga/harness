import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { IncompleteBenchmarkSubmissionError } from '../../src/cli/program/benchmark-service/benchmarkEvents.types';

test('Creates an incomplete submission error', () => {
	const message = 'Provider event did not complete successfully';
	const error = new IncompleteBenchmarkSubmissionError(message);
	const output = { name: error.name, message: error.message };
	expect(error).toBeInstanceOf(Error);
	expect(output).toEqual({
		name: 'IncompleteBenchmarkSubmissionError',
		message
	});
	recordExampleCases(
		{
			unitId: 'entry.program-benchmark-service-benchmark-events-types',
			symbol: 'IncompleteBenchmarkSubmissionError',
			state: 'creates-an-incomplete-submission-error',
			evidence: 'examples-cases',
			file: 'creates-an-incomplete-submission-error.json'
		},
		[
			{
				name: 'preserves the error name and message',
				input: { message },
				output
			}
		]
	);
});
